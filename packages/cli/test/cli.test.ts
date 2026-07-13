/**
 * Exec-the-built-CLI tests: `main()` runs on import of cli.ts, so these behaviors (version
 * printing, arg parsing/exit codes, USAGE text) are only observable by spawning the compiled
 * `dist/cli.js` as a real process — the same idiom the `beacon` root script and the GitHub
 * Action use. Requires `npm run build` (or `tsc --build packages/cli/tsconfig.json`) to have
 * run first so dist/cli.js is current.
 */
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CLI = resolve("packages/cli/dist/cli.js");
const PKG_JSON = resolve("packages/cli/package.json");
const GOOD_SKILL = resolve("packages/core/test/fixtures/skills/good-skill");

function run(args: string[]): { code: number | null; stdout: string; stderr: string } {
  const res = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
  return { code: res.status, stdout: res.stdout, stderr: res.stderr };
}

describe("skillcrossroads --version", () => {
  it("prints the version from packages/cli/package.json, never a hardcoded copy", () => {
    // Read package.json ourselves — this is the whole point: never hardcode the expected number
    // either, or a stale test would pass right alongside a stale CLI constant.
    const pkg = JSON.parse(readFileSync(PKG_JSON, "utf8")) as { version: string };
    const { code, stdout } = run(["--version"]);
    expect(code).toBe(0);
    expect(stdout.trim()).toBe(`skillcrossroads ${pkg.version}`);
  });

  it("-v is an alias for --version", () => {
    const pkg = JSON.parse(readFileSync(PKG_JSON, "utf8")) as { version: string };
    const { stdout } = run(["-v"]);
    expect(stdout.trim()).toBe(`skillcrossroads ${pkg.version}`);
  });
});

describe("--help / USAGE text", () => {
  it("documents the --md alias for --markdown", () => {
    const { stdout } = run(["--help"]);
    expect(stdout).toContain("--markdown (--md)");
  });
});

describe("init --no-color", () => {
  it("is accepted (not rejected as an unknown option) and init still exits 0", () => {
    // Isolated temp fixture (not this repo's own tree) so the test doesn't depend on the live
    // repo's git remote / README state — mirrors init.test.ts's own harness idiom.
    const dir = mkdtempSync(join(tmpdir(), "sc-cli-nocolor-"));
    try {
      cpSync(GOOD_SKILL, join(dir, "my-skill"), { recursive: true });
      const { code, stderr } = run(["init", dir, "--repo", "sgharlow/demo", "--dry-run", "--no-color"]);
      expect(stderr).not.toContain("Unknown option");
      expect(code).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("--mcp-live on a directory target", () => {
  it("prints the same ignored notice a bare-file non-.mcp.json target gets", () => {
    const { stderr } = run([GOOD_SKILL, "--mcp-live"]);
    expect(stderr).toContain("--mcp-live ignored: the target is not a .mcp.json");
  });
});

describe("nonexistent path vs. empty-but-existing directory", () => {
  it("reports a distinct message for a path that doesn't exist", () => {
    const missing = resolve("this-path-does-not-exist-xyz-cli-test");
    const { code, stderr } = run([missing]);
    expect(code).toBe(1);
    expect(stderr).toContain(`Path does not exist: ${missing}`);
    expect(stderr).not.toContain("No SKILL.md found");
  });

  it("keeps the original message for an empty-but-existing directory", () => {
    const empty = mkdtempSync(join(tmpdir(), "sc-cli-empty-"));
    try {
      const { code, stderr } = run([empty]);
      expect(code).toBe(1);
      expect(stderr).toContain(`No SKILL.md found in ${empty}`);
      expect(stderr).not.toContain("Path does not exist");
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
