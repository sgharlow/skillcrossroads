import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, cpSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runInit } from "../src/init.js";

const SITE = "https://skillcrossroads.com";
// A known-good skill fixture — copied into each temp repo so scanLocalDir finds a real artifact.
const GOOD_SKILL = resolve("packages/core/test/fixtures/skills/good-skill");

let dir: string;
let out: string;
let err: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "sc-init-"));
  cpSync(GOOD_SKILL, join(dir, "my-skill"), { recursive: true });
  out = "";
  err = "";
  vi.spyOn(process.stdout, "write").mockImplementation((s: string | Uint8Array) => ((out += String(s)), true));
  vi.spyOn(process.stderr, "write").mockImplementation((s: string | Uint8Array) => ((err += String(s)), true));
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

describe("runInit", () => {
  it("creates a README with the badge when none exists", async () => {
    const code = await runInit([dir, "--repo", "sgharlow/demo"], SITE);
    expect(code).toBe(0);
    const readme = readFileSync(join(dir, "README.md"), "utf8");
    expect(readme).toContain("# demo");
    expect(readme).toContain("https://skillcrossroads.com/api/badge/sgharlow/demo.svg");
    expect(readme).toContain("https://skillcrossroads.com/s/sgharlow/demo");
    expect(out).toContain("Created");
  });

  it("inserts the badge under the H1 of an existing README", async () => {
    writeFileSync(join(dir, "README.md"), "# Demo Project\n\nHello world.\n");
    const code = await runInit([dir, "--repo", "sgharlow/demo"], SITE);
    expect(code).toBe(0);
    const readme = readFileSync(join(dir, "README.md"), "utf8");
    expect(readme).toBe(
      "# Demo Project\n\n[![Skill Crossroads](https://skillcrossroads.com/api/badge/sgharlow/demo.svg)]" +
        "(https://skillcrossroads.com/s/sgharlow/demo)\n\n" +
        "Claude Code artifacts graded by [Skill Crossroads](https://skillcrossroads.com) — " +
        "click the badge for the evidence-cited scorecard.\n\nHello world.\n",
    );
  });

  it("is idempotent — a second run makes no change", async () => {
    writeFileSync(join(dir, "README.md"), "# Demo\n\nBody.\n");
    await runInit([dir, "--repo", "sgharlow/demo"], SITE);
    const afterFirst = readFileSync(join(dir, "README.md"), "utf8");
    out = "";
    const code = await runInit([dir, "--repo", "sgharlow/demo"], SITE);
    expect(code).toBe(0);
    expect(readFileSync(join(dir, "README.md"), "utf8")).toBe(afterFirst);
    expect(out).toContain("already present");
  });

  it("--dry-run writes nothing", async () => {
    const code = await runInit([dir, "--repo", "sgharlow/demo", "--dry-run"], SITE);
    expect(code).toBe(0);
    expect(existsSync(join(dir, "README.md"))).toBe(false);
    expect(out).toContain("Would create");
  });

  it("--no-create errors when there is no README", async () => {
    const code = await runInit([dir, "--repo", "sgharlow/demo", "--no-create"], SITE);
    expect(code).toBe(1);
    expect(existsSync(join(dir, "README.md"))).toBe(false);
    expect(err).toContain("No README found");
  });

  it("errors with guidance when there are no artifacts to badge", async () => {
    const empty = mkdtempSync(join(tmpdir(), "sc-init-empty-"));
    try {
      const code = await runInit([empty, "--repo", "sgharlow/demo"], SITE);
      expect(code).toBe(1);
      expect(err).toContain("nothing to badge");
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("errors when no --repo and no git remote can be resolved", async () => {
    // A temp dir is not a git repo, so origin resolution fails and we ask for --repo.
    const code = await runInit([dir], SITE);
    expect(code).toBe(1);
    expect(err).toContain("owner/repo");
  });
});
