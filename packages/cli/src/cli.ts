import { writeFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import pc from "picocolors";
import {
  auditAsync,
  scanGitHubRepo,
  scanLocalDir,
  isGitHubUrl,
  GitHubError,
  renderTerminal,
  renderHtml,
  renderBadge,
  renderMarkdown,
  renderAnnotations,
  mdCell,
  meetsMinGrade,
  ParseError,
  createAnthropicClient,
  createAnthropicTokenCounter,
  createFileCache,
  loadConfig,
  applySuppressions,
  ConfigError,
  detectKind,
  introspectMcpConfig,
  gradeMcpLive,
  score,
  type ArtifactType,
  type CrossroadsConfig,
  type CheckContext,
  type AuditResult,
  type ScannedSkill,
} from "@beacon/core";
import { runInit } from "./init.js";

const USAGE = `${pc.bold("skillcrossroads")} — Skill Crossroads, the signpost for Claude Code artifacts

${pc.bold("Usage:")}
  skillcrossroads <path-to-skill | github-url> [options]
  skillcrossroads init [path] [options]        Add the quality badge to a repo's README.

${pc.bold("Arguments:")}
  <path-to-skill>    A skill directory (containing SKILL.md), a subagent/command .md file
                     (.claude/agents/*.md, .claude/commands/*.md), or a folder of any of them.
  <github-url>       Public GitHub repo to scan by URL (no clone), e.g.
                     https://github.com/owner/repo  or  owner/repo

${pc.bold("Options:")}
  --html[=<file>]    Also write a self-contained HTML scorecard (default: <name>.beacon.html).
  --badge[=<file>]   Also write an SVG grade badge (default: <name>.beacon.svg).
  --json[=<file>]    Emit the scorecard as JSON (bare: to stdout, replacing the report;
                     with =<file>: written alongside whatever report mode is active).
  --markdown         Emit a Markdown report (for CI / PR comments).
  --annotations=<f>  Write GitHub ::warning/::error annotation lines (file:line-anchored)
                     to <f> — cat it in a CI step to get inline PR annotations.
  --min-grade=<G>    Exit non-zero if any scanned skill grades below <G> (CI gate), e.g. B or C-.
  --no-llm           Deterministic checks only; skip LLM-assisted triggering analysis.
  --kind=<k>         Artifact kind for a bare file: skill | agent | command | mcp
                     (auto-detected from agents//commands/ paths and .mcp.json when omitted).
  --mcp-live         With a .mcp.json: SPAWN each stdio server from YOUR config (explicit
                     consent), list its tools, and grade tool/param descriptions too.
  --max=<n>          Cap the number of skills scanned from a repo.
  --no-color         Disable ANSI colors.
  -h, --help         Show this help.
  -v, --version      Show version.

${pc.bold("A local path may be a single skill or a folder of skills")} (every SKILL.md is scanned).

${pc.bold("LLM-assisted checks (BYOK):")}
  Set ANTHROPIC_API_KEY to enable the triggering-quality check (TRIGGER-01).
  Override the model with BEACON_MODEL. Verdicts are cached in .beacon-cache/.

${pc.bold("Examples:")}
  skillcrossroads ./my-skill
  skillcrossroads ./skills --markdown --min-grade=B      # CI: report + gate
  skillcrossroads https://github.com/anthropics/skills
  skillcrossroads anthropics/skills --max=10
  skillcrossroads init                                   # badge this repo's README
  ANTHROPIC_API_KEY=sk-... skillcrossroads ./my-skill
`;

/** A flag that takes an optional `=value`: undefined = absent, true = present (default path), string = explicit. */
type OptionalPath = string | true | undefined;

interface Args {
  path?: string;
  json: boolean;
  markdown: boolean;
  minGrade?: string;
  kind?: string;
  jsonFile?: string;
  annotations?: string;
  mcpLive: boolean;
  html: OptionalPath;
  badge: OptionalPath;
  noLlm: boolean;
  max?: number;
  help: boolean;
  version: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = {
    json: false,
    markdown: false,
    html: undefined,
    badge: undefined,
    noLlm: false,
    mcpLive: false,
    help: false,
    version: false,
  };
  const setMax = (v: string): void => {
    args.max = Math.max(1, Number(v) || 1);
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    // A required-value flag may be given as `--flag=value` or `--flag value` (the form the GitHub
    // Action and most users type). For the space form, error (never fail open) if the value is
    // missing or is itself a flag — a silently-disabled gate is worse than a clear error.
    const takesValue = (flag: string): string | undefined => {
      if (a === flag) {
        const next = argv[i + 1];
        if (next === undefined || next.startsWith("-")) {
          process.stderr.write(pc.red(`Option ${flag} requires a value (e.g. ${flag}=B)\n`));
          process.exit(2);
        }
        i++;
        return next;
      }
      if (a.startsWith(`${flag}=`)) return a.slice(flag.length + 1);
      return undefined;
    };
    if (a === "--json") args.json = true;
    else if (a.startsWith("--json=")) args.jsonFile = a.slice("--json=".length);
    else if (a === "--annotations" || a.startsWith("--annotations=")) args.annotations = takesValue("--annotations");
    else if (a === "--markdown" || a === "--md") args.markdown = true;
    else if (a === "--min-grade" || a.startsWith("--min-grade=")) args.minGrade = takesValue("--min-grade");
    else if (a === "--kind" || a.startsWith("--kind=")) args.kind = takesValue("--kind");
    else if (a === "--max" || a.startsWith("--max=")) setMax(takesValue("--max") ?? "");
    else if (a === "-h" || a === "--help") args.help = true;
    else if (a === "-v" || a === "--version") args.version = true;
    else if (a === "--no-llm") args.noLlm = true;
    else if (a === "--mcp-live") args.mcpLive = true;
    else if (a === "--no-color" || a === "--color") continue; // picocolors reads the env
    else if (a === "--html") args.html = true;
    else if (a.startsWith("--html=")) args.html = a.slice("--html=".length);
    else if (a === "--badge") args.badge = true;
    else if (a.startsWith("--badge=")) args.badge = a.slice("--badge=".length);
    else if (a.startsWith("-")) {
      process.stderr.write(pc.red(`Unknown option: ${a}\n`));
      process.exit(2);
    } else if (args.path === undefined) args.path = a;
  }
  return args;
}

/** Filesystem-safe slug for default output filenames. */
function slug(name: string): string {
  return name.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "artifact";
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** CLI version — keep in sync with packages/cli/package.json on every `npm version` bump. */
const VERSION = "0.8.0";

/** The site whose scorecards/badges the CLI points at (override for self-hosting). */
const SITE_URL = process.env["BEACON_SITE_URL"] ?? "https://skillcrossroads.com";

function writeArtifact(kind: "html" | "svg", opt: OptionalPath, name: string, content: string): string {
  const target = typeof opt === "string" ? opt : `${slug(name)}.beacon.${kind}`;
  const abs = resolve(target);
  writeFileSync(abs, content, "utf8");
  // Diagnostics go to stderr so `--markdown`/`--json` stdout stays a clean report.
  process.stderr.write(pc.dim(`  wrote ${kind.toUpperCase()} → ${abs}\n`));
  return target;
}

/** Build the LLM check context from the environment, or an empty context (deterministic-only). */
function buildContext(noLlm: boolean, warnings: string[]): CheckContext {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (noLlm || !apiKey) return {};
  const model = createAnthropicClient({ apiKey, model: process.env["BEACON_MODEL"] });
  const tokenCounter = createAnthropicTokenCounter({ apiKey, model: process.env["BEACON_MODEL"] });
  const cache = createFileCache();
  return {
    model,
    tokenCounter,
    cache,
    onError: (id, err) => warnings.push(`${id} skipped: ${err instanceof Error ? err.message : String(err)}`),
  };
}

/** Display label: name plus a kind tag for non-skill artifacts. */
function kindLabel(r: AuditResult): string {
  const t = r.artifact.type;
  return t === "skill" ? r.name : `${r.name} [${t === "subagent" ? "agent" : t}]`;
}

/** Emit one artifact's report (terminal or markdown) + any requested HTML/badge artifacts. */
function emitSingle(result: AuditResult, args: Args): void {
  const { scorecard } = result;
  const name = kindLabel(result);
  if (args.markdown) {
    process.stdout.write(`${renderMarkdown(scorecard, { name })}\n`);
  } else {
    process.stdout.write(`\n${renderTerminal(scorecard, { name })}\n`);
  }
  if (args.html !== undefined) {
    writeArtifact("html", args.html, name, renderHtml(scorecard, { name, scannedAt: today(), homeUrl: SITE_URL }));
  }
  if (args.badge !== undefined) {
    const target = writeArtifact("svg", args.badge, name, renderBadge(scorecard));
    // Emit the one copy-paste line an author needs — this is how the badge loop actually spreads.
    // To stderr so it never pollutes a redirected `--markdown`/`--json` report.
    const rel = target.startsWith(".") || target.startsWith("/") ? target : `./${target}`;
    process.stderr.write(pc.dim(`  embed it:  `) + `![Skill Crossroads](${rel})\n`);
    process.stderr.write(
      pc.dim(`  or an always-fresh, linked badge from ${SITE_URL} once your repo is public:\n`) +
        pc.dim(`    [![Skill Crossroads](${SITE_URL}/api/badge/OWNER/REPO.svg)](${SITE_URL}/s/OWNER/REPO)\n`),
    );
  }
}

function gradeColor(grade: string): (s: string) => string {
  if (grade.startsWith("A")) return pc.green;
  if (grade.startsWith("B")) return pc.cyan;
  if (grade.startsWith("C")) return pc.yellow;
  return pc.red;
}

type ScanErr = { repoPath: string; message: string };
interface BatchMeta {
  ref?: string;
  treeSha?: string;
  truncated?: boolean;
}

/** Emit a multi-skill batch — a Markdown report (CI/PR) or a colored terminal table. */
function emitBatch(
  skills: readonly ScannedSkill[],
  errors: readonly ScanErr[],
  label: string,
  args: Args,
  meta: BatchMeta = {},
): void {
  const rows = [...skills].sort((a, b) => b.scorecard.overall - a.scorecard.overall);
  const avg = rows.length ? rows.reduce((a, s) => a + s.scorecard.overall, 0) / rows.length : 0;

  if (args.markdown) {
    const out: string[] = [];
    out.push(`### 🔦 Skill Crossroads — \`${label}\``);
    out.push("");
    out.push(`${rows.length} skills · average **${avg.toFixed(1)}/100**${meta.ref ? ` · ref \`${meta.ref}\`` : ""}`);
    out.push("");
    out.push("| Grade | Score | Skill | Path |");
    out.push("|---|---:|---|---|");
    for (const s of rows)
      out.push(`| ${s.scorecard.grade} | ${s.scorecard.overall} | ${mdCell(kindLabel(s))} | \`${mdCell(s.repoPath)}\` |`);
    out.push("");
    for (const s of rows.filter((r) => r.scorecard.results.some((x) => x.status !== "pass"))) {
      out.push(`<details><summary>${s.scorecard.grade} — ${mdCell(s.name)}</summary>\n`);
      out.push(renderMarkdown(s.scorecard, { name: s.name, level: 4 }));
      out.push(`\n</details>`);
    }
    for (const e of errors) out.push(`- ⚠ \`${mdCell(e.repoPath)}\`: ${mdCell(e.message)}`);
    process.stdout.write(`${out.join("\n")}\n`);
    return;
  }

  const refNote =
    (meta.ref ? ` · ref ${meta.ref}` : "") +
    (meta.treeSha ? ` · tree ${meta.treeSha.slice(0, 10)}` : "") +
    (meta.truncated ? " (truncated)" : "");
  process.stdout.write(`\n${pc.bold("SKILL CROSSROADS — scan")}  ${pc.dim(label)}\n` + pc.dim(`  ${rows.length} skills${refNote}\n\n`));
  for (const s of rows) {
    const g = gradeColor(s.scorecard.grade);
    process.stdout.write(
      `  ${g(pc.bold(s.scorecard.grade.padEnd(2)))}  ${String(s.scorecard.overall).padStart(5)}  ${pc.dim(s.repoPath)}  ${kindLabel(s)}\n`,
    );
  }
  process.stdout.write(pc.dim(`\n  average ${avg.toFixed(1)}/100 across ${rows.length} skills\n`));
  for (const e of errors) process.stdout.write(pc.yellow(`  ⚠ ${e.repoPath}: ${e.message}\n`));
}

async function main(): Promise<void> {
  const rawArgv = process.argv.slice(2);

  // Subcommand: `init` adds the badge to a repo's README. Routed before the scan arg parser
  // so its own flags (--repo, --dry-run, --no-create) don't collide with scan options.
  if (rawArgv[0] === "init") {
    process.exitCode = await runInit(rawArgv.slice(1), SITE_URL);
    return;
  }

  const args = parseArgs(rawArgv);

  if (args.version) {
    process.stdout.write(`skillcrossroads ${VERSION}\n`);
    return;
  }
  if (args.help || args.path === undefined) {
    process.stdout.write(USAGE);
    if (args.path === undefined && !args.help) process.exit(2);
    return;
  }

  const warnings: string[] = [];
  const ctx = buildContext(args.noLlm, warnings);
  const remote = isGitHubUrl(args.path) && !existsSync(args.path);

  // Project config (.skillcrossroads.json): local/CI scans only — hosted or remote scans never
  // apply a repo's own config (a public grade must reflect the unsuppressed rubric). Invalid
  // config is a usage error (exit 2), never silently ignored.
  let config: CrossroadsConfig | null = null;
  if (!remote) {
    try {
      const abs = resolve(args.path);
      const rootDir = existsSync(abs) && statSync(abs).isFile() ? dirname(abs) : abs;
      config = loadConfig(rootDir);
    } catch (err) {
      if (err instanceof ConfigError) {
        process.stderr.write(pc.red(`✗ ${err.message}\n`));
        process.exit(2);
      }
      throw err;
    }
  }

  let skills: ScannedSkill[] = [];
  let errors: ScanErr[] = [];
  let meta: BatchMeta = {};
  try {
    if (remote) {
      const scan = await scanGitHubRepo(args.path, ctx, { token: process.env["GITHUB_TOKEN"], max: args.max });
      skills = [...scan.skills];
      errors = [...scan.errors];
      meta = { ref: scan.ref, treeSha: scan.treeSha, truncated: scan.truncated };
    } else {
      const abs = resolve(args.path);
      const directFile = existsSync(abs) && statSync(abs).isFile();
      if (directFile) {
        // A single .md file: SKILL.md, a subagent, or a slash command. --kind wins; otherwise
        // infer from the path (agents/ vs commands/); ambiguous bare .md files need the flag.
        const flagKind: ArtifactType | undefined =
          args.kind === undefined
            ? undefined
            : args.kind === "agent" || args.kind === "subagent"
              ? "subagent"
              : args.kind === "command"
                ? "command"
                : args.kind === "mcp"
                  ? "mcp"
                  : args.kind === "skill"
                    ? "skill"
                    : (() => {
                        process.stderr.write(pc.red(`Unknown --kind: ${args.kind} (use skill | agent | command | mcp)\n`));
                        process.exit(2);
                      })();
        const kind = flagKind ?? detectKind(abs) ?? "skill";
        let res = await auditAsync(abs, ctx, kind);
        // Phase B: opt-in live introspection — spawn the user's own stdio servers, grade tools.
        if (args.mcpLive && kind === "mcp") {
          process.stderr.write(pc.dim("  --mcp-live: spawning your configured stdio servers…\n"));
          const intro = await introspectMcpConfig(res.artifact.raw);
          for (const s of intro.filter((x) => x.skipped))
            process.stderr.write(pc.dim(`  skipped "${s.server}" (url transport — stdio only)\n`));
          const live = gradeMcpLive(".mcp.json", intro);
          if (live.length > 0)
            res = { ...res, scorecard: { ...score([...res.scorecard.results, ...live], "mcp"), kind: "mcp" } };
        } else if (args.mcpLive) {
          process.stderr.write(pc.yellow("  --mcp-live ignored: the target is not a .mcp.json\n"));
        }
        skills = [{ ...res, repoPath: "." }];
      } else {
        const local = await scanLocalDir(args.path, ctx);
        skills = [...local.skills];
        errors = [...local.errors];
      }
    }
  } catch (err) {
    if (err instanceof ParseError || err instanceof GitHubError) {
      process.stderr.write(pc.red(`✗ ${err.message}\n`));
      process.exit(1);
    }
    throw err;
  }

  if (skills.length === 0) {
    if (errors.length > 0) {
      process.stderr.write(pc.red(`All ${errors.length} skill(s) failed to scan:\n`));
      for (const e of errors) process.stderr.write(pc.red(`  ✗ ${e.repoPath}: ${e.message}\n`));
    } else {
      process.stderr.write(pc.yellow(`No SKILL.md found in ${args.path}\n`));
    }
    process.exit(1);
  }

  // Apply config suppressions before any rendering/gating, so every surface shows the same card.
  if (config) skills = skills.map((s) => ({ ...s, scorecard: applySuppressions(s.scorecard, config) }));

  // Sidecar outputs (CI): a machine-readable JSON file and/or GitHub annotation lines — written
  // alongside whatever report mode is active, never replacing it.
  if (args.annotations && remote) {
    process.stderr.write(pc.yellow("  --annotations ignored: annotations need a local checkout (file paths must exist in the repo).\n"));
  }
  if (args.jsonFile) {
    const body = { target: args.path, ...meta, skills: skills.map((s) => ({ repoPath: s.repoPath, name: s.name, kind: s.artifact.type, ...s.scorecard })), errors };
    writeFileSync(resolve(args.jsonFile), `${JSON.stringify(body, null, 2)}\n`, "utf8");
    process.stderr.write(pc.dim(`  wrote JSON → ${resolve(args.jsonFile)}\n`));
  }
  if (args.annotations && !remote) {
    const prefix = args.path === "." ? "" : args.path;
    const lines = renderAnnotations(skills, prefix);
    writeFileSync(resolve(args.annotations), lines.length ? `${lines.join("\n")}\n` : "", "utf8");
    process.stderr.write(pc.dim(`  wrote ${lines.length} annotation(s) → ${resolve(args.annotations)}\n`));
  }

  // Render
  if (args.json) {
    const body =
      skills.length === 1
        ? { name: skills[0]!.name, kind: skills[0]!.artifact.type, ...skills[0]!.scorecard }
        : { target: args.path, ...meta, skills: skills.map((s) => ({ repoPath: s.repoPath, name: s.name, kind: s.artifact.type, ...s.scorecard })), errors };
    process.stdout.write(`${JSON.stringify(body, null, 2)}\n`);
  } else if (skills.length === 1) {
    emitSingle(skills[0] as AuditResult, args);
  } else {
    emitBatch(skills, errors, args.path, args, meta);
  }

  // Gate — the flag wins; otherwise the config's minGrade is the default CI gate.
  const minGrade = args.minGrade ?? config?.minGrade;
  let gateFailed = false;
  if (minGrade) {
    const failing = skills.filter((s) => !meetsMinGrade(s.scorecard.grade, minGrade));
    gateFailed = failing.length > 0;
    // Only in the human terminal mode — never pollute a `--markdown`/`--json` report (which is piped
    // to a PR comment / file). The exit code below still fires so CI gates regardless of mode.
    if (!args.json && !args.markdown) {
      if (gateFailed) {
        process.stdout.write(pc.red(`\n✗ Gate: ${failing.length}/${skills.length} skill(s) below ${minGrade}:\n`));
        for (const s of failing) process.stdout.write(pc.red(`    ${s.scorecard.grade.padEnd(2)}  ${s.repoPath}  ${s.name}\n`));
      } else {
        process.stdout.write(pc.green(`\n✓ Gate: all ${skills.length} skill(s) meet ${minGrade}.\n`));
      }
    }
  }

  if (!args.json && !args.markdown) {
    for (const w of warnings) process.stdout.write(pc.yellow(`  ⚠ ${w}\n`));
    if (!ctx.model) {
      process.stdout.write(pc.dim("  Triggering analysis skipped — set ANTHROPIC_API_KEY to enable it (BYOK).\n"));
    }
    process.stdout.write("\n");
  }

  if (gateFailed) process.exitCode = 1;
}

main().catch((err) => {
  process.stderr.write(pc.red(`skillcrossroads: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`));
  process.exit(1);
});
