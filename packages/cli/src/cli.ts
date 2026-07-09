#!/usr/bin/env node
import pc from "picocolors";
import { audit, renderTerminal, ParseError } from "@beacon/core";

const USAGE = `${pc.bold("beacon")} — Lighthouse for Claude Code artifacts

${pc.bold("Usage:")}
  beacon <path-to-skill> [options]

${pc.bold("Arguments:")}
  <path-to-skill>   Path to a skill directory (containing SKILL.md) or the SKILL.md file.

${pc.bold("Options:")}
  --json            Emit the scorecard as JSON instead of the terminal report.
  --no-color        Disable ANSI colors.
  -h, --help        Show this help.
  -v, --version     Show version.

${pc.bold("Examples:")}
  beacon ./my-skill
  beacon ./my-skill --json > report.json
`;

interface Args {
  path?: string;
  json: boolean;
  help: boolean;
  version: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { json: false, help: false, version: false };
  for (const a of argv) {
    if (a === "--json") args.json = true;
    else if (a === "-h" || a === "--help") args.help = true;
    else if (a === "-v" || a === "--version") args.version = true;
    else if (a === "--no-color" || a === "--color") continue; // handled by picocolors env
    else if (a.startsWith("-")) {
      process.stderr.write(pc.red(`Unknown option: ${a}\n`));
      process.exit(2);
    } else if (args.path === undefined) args.path = a;
  }
  return args;
}

function main(): void {
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

  let result;
  try {
    result = audit(args.path);
  } catch (err) {
    if (err instanceof ParseError) {
      process.stderr.write(pc.red(`✗ ${err.message}\n`));
      process.exit(1);
    }
    throw err;
  }

  if (args.json) {
    process.stdout.write(
      `${JSON.stringify({ name: result.name, ...result.scorecard }, null, 2)}\n`,
    );
    return;
  }

  process.stdout.write(`\n${renderTerminal(result.scorecard, { name: result.name })}\n\n`);
}

main();
