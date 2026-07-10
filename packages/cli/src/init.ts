/**
 * `skillcrossroads init` — put the always-fresh quality badge into a repo's README, one command.
 *
 * This closes the gap the badge loop actually depends on: getting the badge *in*. It scans the
 * repo to confirm there are gradeable artifacts (and shows the grade), resolves the GitHub
 * owner/repo from the git remote (or `--repo`), then inserts the badge under the README's H1 —
 * or creates a minimal README if there is none. It NEVER commits: the user reviews the diff and
 * commits. Read-only toward everything except the one README file it writes.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import pc from "picocolors";
import { scanLocalDir, badgeMarkdown, parseGitHubSlug, insertBadge, newReadme, type ScannedSkill } from "@beacon/core";

const INIT_USAGE = `${pc.bold("skillcrossroads init")} — add the Skill Crossroads badge to a repo's README

${pc.bold("Usage:")}
  skillcrossroads init [path] [options]

${pc.bold("What it does:")}
  Scans [path] (default ".") for Claude Code artifacts, resolves the repo's GitHub owner/repo
  from its git remote, and inserts an always-fresh badge under the README's first heading.
  It does not commit — review the change and commit it yourself.

${pc.bold("Options:")}
  --repo <owner/repo>  Override the owner/repo (else read from 'git remote get-url origin').
  --no-create          Don't create a README if one is missing (error instead).
  --dry-run            Show what would change; write nothing.
  -h, --help           Show this help.
`;

interface InitArgs {
  path: string;
  repo?: string;
  create: boolean;
  dryRun: boolean;
  help: boolean;
}

function parseInitArgs(argv: readonly string[]): InitArgs {
  const args: InitArgs = { path: ".", create: true, dryRun: false, help: false };
  let sawPath = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "-h" || a === "--help") args.help = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--no-create") args.create = false;
    else if (a === "--repo" || a.startsWith("--repo=")) {
      const v = a.startsWith("--repo=") ? a.slice("--repo=".length) : argv[++i];
      if (!v || v.startsWith("-")) {
        process.stderr.write(pc.red("Option --repo requires a value (e.g. --repo owner/name)\n"));
        process.exit(2);
      }
      args.repo = v;
    } else if (a.startsWith("-")) {
      process.stderr.write(pc.red(`Unknown option: ${a}\n`));
      process.exit(2);
    } else if (!sawPath) {
      args.path = a;
      sawPath = true;
    }
  }
  return args;
}

/** Resolve owner/repo from `--repo` or the git origin remote. Returns null if it can't. */
function resolveSlug(dir: string, override?: string): { owner: string; repo: string } | null {
  if (override) {
    const parts = override.split("/").filter(Boolean);
    if (parts.length === 2) return { owner: parts[0] as string, repo: parts[1] as string };
    process.stderr.write(pc.red(`--repo must be "owner/repo" (got "${override}")\n`));
    process.exit(2);
  }
  try {
    const remote = execFileSync("git", ["-C", dir, "remote", "get-url", "origin"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return parseGitHubSlug(remote);
  } catch {
    return null; // not a git repo, or no 'origin' remote
  }
}

/** Find a README file at the directory root (any case / .md / .markdown), or null. */
function findReadme(dir: string): string | null {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }
  const match = entries.find((e) => /^readme(\.md|\.markdown)?$/i.test(e));
  return match ? join(dir, match) : null;
}

function gradeSummary(skills: readonly ScannedSkill[]): string {
  const rows = [...skills].sort((a, b) => b.scorecard.overall - a.scorecard.overall);
  const top = rows
    .slice(0, 3)
    .map((s) => `${s.scorecard.grade} ${s.name}`)
    .join(", ");
  const more = rows.length > 3 ? `, +${rows.length - 3} more` : "";
  return `${rows.length} artifact${rows.length === 1 ? "" : "s"} — ${top}${more}`;
}

/** Run `init`. Returns the process exit code. */
export async function runInit(argv: readonly string[], siteUrl: string): Promise<number> {
  const args = parseInitArgs(argv);
  if (args.help) {
    process.stdout.write(INIT_USAGE);
    return 0;
  }

  const dir = resolve(args.path);
  if (!existsSync(dir)) {
    process.stderr.write(pc.red(`✗ Path not found: ${dir}\n`));
    return 1;
  }

  // 1. Confirm there's something worth badging (deterministic scan — no key needed).
  const { skills } = await scanLocalDir(dir);
  if (skills.length === 0) {
    process.stderr.write(
      pc.yellow(`No Claude Code artifacts found in ${args.path} — nothing to badge.\n`) +
        pc.dim(`  (Looked for SKILL.md dirs, .claude/agents, .claude/commands, and .mcp.json.)\n`),
    );
    return 1;
  }

  // 2. Resolve the GitHub owner/repo the badge URL points at.
  const slug = resolveSlug(dir, args.repo);
  if (!slug) {
    process.stderr.write(
      pc.red("✗ Couldn't determine the GitHub owner/repo.\n") +
        pc.dim("  This repo has no GitHub 'origin' remote (or it isn't on github.com).\n") +
        pc.dim("  Pass it explicitly:  skillcrossroads init --repo owner/name\n"),
    );
    return 1;
  }

  const block = badgeMarkdown({ siteUrl, owner: slug.owner, repo: slug.repo });
  process.stdout.write(
    `\n${pc.bold("Skill Crossroads init")}  ${pc.dim(`${slug.owner}/${slug.repo}`)}\n` +
      pc.dim(`  ${gradeSummary(skills)}\n\n`),
  );

  // 3. Insert into an existing README, or create one.
  const readmePath = findReadme(dir);
  let targetPath: string;
  let nextContent: string;
  let action: "insert" | "create" | "noop";

  if (readmePath) {
    const current = readFileSync(readmePath, "utf8");
    const res = insertBadge(current, block);
    targetPath = readmePath;
    nextContent = res.content;
    action = res.changed ? "insert" : "noop";
  } else if (args.create) {
    targetPath = join(dir, "README.md");
    nextContent = newReadme(slug.repo, block);
    action = "create";
  } else {
    process.stderr.write(
      pc.yellow("No README found and --no-create was set.\n") +
        pc.dim("  Re-run without --no-create to create a minimal README, or add one yourself.\n"),
    );
    return 1;
  }

  if (action === "noop") {
    process.stdout.write(pc.green(`✓ Badge already present in ${readmePath}. Nothing to do.\n\n`));
    return 0;
  }

  const verb = action === "create" ? "Would create" : "Would update";
  if (args.dryRun) {
    process.stdout.write(
      pc.bold(`${verb} ${targetPath}`) +
        `\n\n${pc.dim("badge block:")}\n${block}\n\n` +
        pc.dim("  (dry run — no file written)\n\n"),
    );
    return 0;
  }

  writeFileSync(targetPath, nextContent, "utf8");
  process.stdout.write(
    pc.green(`✓ ${action === "create" ? "Created" : "Updated"} ${targetPath}\n`) +
      pc.dim(`  Review the change and commit it:\n`) +
      `    git add ${action === "create" ? "README.md" : "$(git rev-parse --show-prefix)README*"} && git commit -m "docs: add Skill Crossroads quality badge"\n\n` +
      pc.dim(`  The badge re-scans and updates itself — it stays current with no further action.\n\n`),
  );
  return 0;
}
