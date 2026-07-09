#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pc from "picocolors";
import {
  auditAsync,
  renderTerminal,
  renderHtml,
  renderBadge,
  ParseError,
  createAnthropicClient,
  createFileCache,
  type CheckContext,
} from "@beacon/core";

const USAGE = `${pc.bold("beacon")} — Lighthouse for Claude Code artifacts

${pc.bold("Usage:")}
  beacon <path-to-skill> [options]

${pc.bold("Arguments:")}
  <path-to-skill>    Path to a skill directory (containing SKILL.md) or the SKILL.md file.

${pc.bold("Options:")}
  --html[=<file>]    Also write a self-contained HTML scorecard (default: <name>.beacon.html).
  --badge[=<file>]   Also write an SVG grade badge (default: <name>.beacon.svg).
  --json             Emit the scorecard as JSON instead of the terminal report.
  --no-llm           Deterministic checks only; skip LLM-assisted triggering analysis.
  --no-color         Disable ANSI colors.
  -h, --help         Show this help.
  -v, --version      Show version.

${pc.bold("LLM-assisted checks (BYOK):")}
  Set ANTHROPIC_API_KEY to enable the triggering-quality check (TRIGGER-01).
  Override the model with BEACON_MODEL. Verdicts are cached in .beacon-cache/.

${pc.bold("Examples:")}
  beacon ./my-skill
  beacon ./my-skill --html --badge
  beacon ./my-skill --json > report.json
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
  const cache = createFileCache();
  return {
    model,
    cache,
    onError: (id, err) => warnings.push(`${id} skipped: ${err instanceof Error ? err.message : String(err)}`),
  };
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

  let result;
  try {
    result = await auditAsync(args.path, ctx);
  } catch (err) {
    if (err instanceof ParseError) {
      process.stderr.write(pc.red(`✗ ${err.message}\n`));
      process.exit(1);
    }
    throw err;
  }

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
