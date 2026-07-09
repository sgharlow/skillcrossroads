#!/usr/bin/env node
import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import pc from "picocolors";
import {
  auditAsync,
  scanGitHubRepo,
  isGitHubUrl,
  GitHubError,
  renderTerminal,
  renderHtml,
  renderBadge,
  ParseError,
  createAnthropicClient,
  createAnthropicTokenCounter,
  createFileCache,
  type CheckContext,
  type AuditResult,
  type RepoScanResult,
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
  --no-llm           Deterministic checks only; skip LLM-assisted triggering analysis.
  --max=<n>          Cap the number of skills scanned from a repo.
  --no-color         Disable ANSI colors.
  -h, --help         Show this help.
  -v, --version      Show version.

${pc.bold("LLM-assisted checks (BYOK):")}
  Set ANTHROPIC_API_KEY to enable the triggering-quality check (TRIGGER-01).
  Override the model with BEACON_MODEL. Verdicts are cached in .beacon-cache/.

${pc.bold("Examples:")}
  beacon ./my-skill
  beacon ./my-skill --html --badge
  beacon https://github.com/anthropics/skills
  beacon anthropics/skills --max=10
  ANTHROPIC_API_KEY=sk-... beacon ./my-skill
`;

/** A flag that takes an optional `=value`: undefined = absent, true = present (default path), string = explicit. */
type OptionalPath = string | true | undefined;

interface Args {
  path?: string;
  json: boolean;
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
    html: undefined,
    badge: undefined,
    noLlm: false,
    help: false,
    version: false,
  };
  for (const a of argv) {
    if (a === "--json") args.json = true;
    else if (a === "-h" || a === "--help") args.help = true;
    else if (a === "-v" || a === "--version") args.version = true;
    else if (a === "--no-llm") args.noLlm = true;
    else if (a.startsWith("--max=")) args.max = Math.max(1, Number(a.slice("--max=".length)) || 1);
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

function writeArtifact(kind: "html" | "svg", opt: OptionalPath, name: string, content: string): void {
  const target = typeof opt === "string" ? opt : `${slug(name)}.beacon.${kind}`;
  const abs = resolve(target);
  writeFileSync(abs, content, "utf8");
  process.stdout.write(pc.dim(`  wrote ${kind.toUpperCase()} → ${abs}\n`));
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

/** Emit one skill's report + any requested HTML/badge artifacts. */
function emitSingle(result: AuditResult, args: Args): void {
  const { scorecard, name } = result;
  if (args.json) {
    process.stdout.write(`${JSON.stringify({ name, ...scorecard }, null, 2)}\n`);
  } else {
    process.stdout.write(`\n${renderTerminal(scorecard, { name })}\n`);
  }
  if (args.html !== undefined) {
    writeArtifact("html", args.html, name, renderHtml(scorecard, { name, scannedAt: today() }));
  }
  if (args.badge !== undefined) {
    writeArtifact("svg", args.badge, name, renderBadge(scorecard));
  }
}

function gradeColor(grade: string): (s: string) => string {
  if (grade.startsWith("A")) return pc.green;
  if (grade.startsWith("B")) return pc.cyan;
  if (grade.startsWith("C")) return pc.yellow;
  return pc.red;
}

/** Emit a batch table for a multi-skill repo scan. */
function emitBatch(scan: RepoScanResult, url: string): void {
  const rows = [...scan.skills].sort((a, b) => b.scorecard.overall - a.scorecard.overall);
  process.stdout.write(
    `\n${pc.bold("BEACON — repo scan")}  ${pc.dim(url)}\n` +
      pc.dim(`  ref ${scan.ref} · tree ${scan.treeSha.slice(0, 10)} · ${rows.length} skills${scan.truncated ? " (truncated)" : ""}\n\n`),
  );
  for (const s of rows) {
    const g = gradeColor(s.scorecard.grade);
    const grade = g(pc.bold(s.scorecard.grade.padEnd(2)));
    const score = String(s.scorecard.overall).padStart(5);
    process.stdout.write(`  ${grade}  ${score}  ${pc.dim(s.repoPath)}  ${s.name}\n`);
  }
  const avg = rows.length ? rows.reduce((a, s) => a + s.scorecard.overall, 0) / rows.length : 0;
  process.stdout.write(pc.dim(`\n  average ${avg.toFixed(1)}/100 across ${rows.length} skills\n`));
  for (const e of scan.errors) {
    process.stdout.write(pc.yellow(`  ⚠ ${e.repoPath}: ${e.message}\n`));
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.version) {
    process.stdout.write("beacon 0.1.0\n");
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

  try {
    if (remote) {
      const scan = await scanGitHubRepo(args.path, ctx, {
        token: process.env["GITHUB_TOKEN"],
        max: args.max,
      });
      if (scan.skills.length === 0) {
        if (scan.errors.length > 0) {
          process.stderr.write(pc.red(`All ${scan.errors.length} skill(s) failed to scan:\n`));
          for (const e of scan.errors) process.stderr.write(pc.red(`  ✗ ${e.repoPath}: ${e.message}\n`));
        } else {
          process.stderr.write(pc.yellow(`No SKILL.md found in ${args.path}\n`));
        }
        process.exit(1);
      }
      if (args.json) {
        process.stdout.write(
          `${JSON.stringify(
            {
              repo: args.path,
              ref: scan.ref,
              treeSha: scan.treeSha,
              skills: scan.skills.map((s) => ({ repoPath: s.repoPath, name: s.name, ...s.scorecard })),
              errors: scan.errors,
            },
            null,
            2,
          )}\n`,
        );
      } else if (scan.skills.length === 1) {
        emitSingle(scan.skills[0] as AuditResult, args);
      } else {
        emitBatch(scan, args.path);
      }
    } else {
      emitSingle(await auditAsync(args.path, ctx), args);
    }
  } catch (err) {
    if (err instanceof ParseError || err instanceof GitHubError) {
      process.stderr.write(pc.red(`✗ ${err.message}\n`));
      process.exit(1);
    }
    throw err;
  }

  if (!args.json) {
    for (const w of warnings) process.stdout.write(pc.yellow(`  ⚠ ${w}\n`));
    if (!ctx.model) {
      process.stdout.write(
        pc.dim("  Triggering analysis skipped — set ANTHROPIC_API_KEY to enable it (BYOK).\n"),
      );
    }
    process.stdout.write("\n");
  }
}

main().catch((err) => {
  process.stderr.write(pc.red(`beacon: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`));
  process.exit(1);
});
