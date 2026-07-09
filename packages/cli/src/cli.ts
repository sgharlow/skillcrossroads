import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
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
  mdCell,
  meetsMinGrade,
  ParseError,
  createAnthropicClient,
  createAnthropicTokenCounter,
  createFileCache,
  type CheckContext,
  type AuditResult,
  type ScannedSkill,
} from "@beacon/core";

const USAGE = `${pc.bold("beacon")} — Lighthouse for Claude Code artifacts

${pc.bold("Usage:")}
  beacon <path-to-skill | github-url> [options]

${pc.bold("Arguments:")}
  <path-to-skill>    Local skill directory (containing SKILL.md) or the SKILL.md file.
  <github-url>       Public GitHub repo to scan by URL (no clone), e.g.
                     https://github.com/owner/repo  or  owner/repo

${pc.bold("Options:")}
  --html[=<file>]    Also write a self-contained HTML scorecard (default: <name>.beacon.html).
  --badge[=<file>]   Also write an SVG grade badge (default: <name>.beacon.svg).
  --json             Emit the scorecard as JSON instead of the terminal report.
  --markdown         Emit a Markdown report (for CI / PR comments).
  --min-grade=<G>    Exit non-zero if any scanned skill grades below <G> (CI gate), e.g. B or C-.
  --no-llm           Deterministic checks only; skip LLM-assisted triggering analysis.
  --max=<n>          Cap the number of skills scanned from a repo.
  --no-color         Disable ANSI colors.
  -h, --help         Show this help.
  -v, --version      Show version.

${pc.bold("A local path may be a single skill or a folder of skills")} (every SKILL.md is scanned).

${pc.bold("LLM-assisted checks (BYOK):")}
  Set ANTHROPIC_API_KEY to enable the triggering-quality check (TRIGGER-01).
  Override the model with BEACON_MODEL. Verdicts are cached in .beacon-cache/.

${pc.bold("Examples:")}
  beacon ./my-skill
  beacon ./skills --markdown --min-grade=B      # CI: report + gate
  beacon https://github.com/anthropics/skills
  beacon anthropics/skills --max=10
  ANTHROPIC_API_KEY=sk-... beacon ./my-skill
`;

/** A flag that takes an optional `=value`: undefined = absent, true = present (default path), string = explicit. */
type OptionalPath = string | true | undefined;

interface Args {
  path?: string;
  json: boolean;
  markdown: boolean;
  minGrade?: string;
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
    else if (a === "--markdown" || a === "--md") args.markdown = true;
    else if (a === "--min-grade" || a.startsWith("--min-grade=")) args.minGrade = takesValue("--min-grade");
    else if (a === "--max" || a.startsWith("--max=")) setMax(takesValue("--max") ?? "");
    else if (a === "-h" || a === "--help") args.help = true;
    else if (a === "-v" || a === "--version") args.version = true;
    else if (a === "--no-llm") args.noLlm = true;
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

/** CLI version — single source (keep in sync with packages/cli/package.json). */
const VERSION = "0.1.0";

/** The site whose scorecards/badges the CLI points at (override for self-hosting). */
const SITE_URL = process.env["BEACON_SITE_URL"] ?? "https://beacon.dev";

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

/** Emit one skill's report (terminal or markdown) + any requested HTML/badge artifacts. */
function emitSingle(result: AuditResult, args: Args): void {
  const { scorecard, name } = result;
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
    process.stderr.write(pc.dim(`  embed it:  `) + `![Beacon](${rel})\n`);
    process.stderr.write(
      pc.dim(`  or an always-fresh, linked badge from ${SITE_URL} once your repo is public:\n`) +
        pc.dim(`    [![Beacon](${SITE_URL}/api/badge/OWNER/REPO.svg)](${SITE_URL}/s/OWNER/REPO)\n`),
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
    out.push(`### 🔦 Beacon — \`${label}\``);
    out.push("");
    out.push(`${rows.length} skills · average **${avg.toFixed(1)}/100**${meta.ref ? ` · ref \`${meta.ref}\`` : ""}`);
    out.push("");
    out.push("| Grade | Score | Skill | Path |");
    out.push("|---|---:|---|---|");
    for (const s of rows)
      out.push(`| ${s.scorecard.grade} | ${s.scorecard.overall} | ${mdCell(s.name)} | \`${mdCell(s.repoPath)}\` |`);
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
  process.stdout.write(`\n${pc.bold("BEACON — scan")}  ${pc.dim(label)}\n` + pc.dim(`  ${rows.length} skills${refNote}\n\n`));
  for (const s of rows) {
    const g = gradeColor(s.scorecard.grade);
    process.stdout.write(
      `  ${g(pc.bold(s.scorecard.grade.padEnd(2)))}  ${String(s.scorecard.overall).padStart(5)}  ${pc.dim(s.repoPath)}  ${s.name}\n`,
    );
  }
  process.stdout.write(pc.dim(`\n  average ${avg.toFixed(1)}/100 across ${rows.length} skills\n`));
  for (const e of errors) process.stdout.write(pc.yellow(`  ⚠ ${e.repoPath}: ${e.message}\n`));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.version) {
    process.stdout.write(`beacon ${VERSION}\n`);
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
      const local = await scanLocalDir(args.path, ctx);
      skills = [...local.skills];
      errors = [...local.errors];
      // Fallback: a direct SKILL.md file path, which the directory walk can't enumerate.
      if (skills.length === 0 && errors.length === 0) {
        const res = await auditAsync(args.path, ctx);
        skills = [{ ...res, repoPath: "." }];
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

  // Render
  if (args.json) {
    const body =
      skills.length === 1
        ? { name: skills[0]!.name, ...skills[0]!.scorecard }
        : { target: args.path, ...meta, skills: skills.map((s) => ({ repoPath: s.repoPath, name: s.name, ...s.scorecard })), errors };
    process.stdout.write(`${JSON.stringify(body, null, 2)}\n`);
  } else if (skills.length === 1) {
    emitSingle(skills[0] as AuditResult, args);
  } else {
    emitBatch(skills, errors, args.path, args, meta);
  }

  // Gate
  let gateFailed = false;
  if (args.minGrade) {
    const failing = skills.filter((s) => !meetsMinGrade(s.scorecard.grade, args.minGrade as string));
    gateFailed = failing.length > 0;
    if (!args.json) {
      if (gateFailed) {
        process.stdout.write(pc.red(`\n✗ Gate: ${failing.length}/${skills.length} skill(s) below ${args.minGrade}:\n`));
        for (const s of failing) process.stdout.write(pc.red(`    ${s.scorecard.grade.padEnd(2)}  ${s.repoPath}  ${s.name}\n`));
      } else {
        process.stdout.write(pc.green(`\n✓ Gate: all ${skills.length} skill(s) meet ${args.minGrade}.\n`));
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
  process.stderr.write(pc.red(`beacon: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`));
  process.exit(1);
});
