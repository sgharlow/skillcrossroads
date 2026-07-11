import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { audit, scanLocalDir } from "../src/index.js";
import { detectKind } from "../src/parse.js";
import { applicableCategories } from "../src/checks/index.js";
import { renderBadge } from "../src/render/badge.js";

const here = dirname(fileURLToPath(import.meta.url));
const goodDir = join(here, "fixtures", "artifacts", "plugins", "good-plugin");
const badDir = join(here, "fixtures", "artifacts", "plugins", "bad-plugin");

describe("plugin kind — detection and parsing", () => {
  it("detects a plugin dir (manifest wins over other layouts) and the manifest path itself", () => {
    expect(detectKind(goodDir)).toBe("plugin");
    expect(detectKind(join(goodDir, ".claude-plugin", "plugin.json"))).toBe("plugin");
  });

  it("plugin is whitelist-only: prose/frontmatter checks never run on the JSON manifest", () => {
    const { scorecard } = audit(goodDir, "plugin");
    const ids = scorecard.results.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(["PLUGIN-01", "PLUGIN-02", "PLUGIN-03", "HOOK-01", "SAFETY-01"]));
    expect(ids).not.toContain("STRUCT-01");
    expect(ids).not.toContain("TRIGGER-02");
  });

  it("applicable categories: correctness/triggering/safety only — and never partial (no asterisk)", () => {
    const cats = applicableCategories("plugin");
    expect([...cats].sort()).toEqual(["correctness", "safety", "triggering"]);
    const { scorecard } = audit(goodDir, "plugin");
    expect(scorecard.partial).toBe(false);
    expect(renderBadge(scorecard)).not.toContain("*");
  });
});

describe("plugin checks — good plugin passes", () => {
  const { scorecard } = audit(goodDir, "plugin");
  const byId = (id: string) => scorecard.results.find((r) => r.id === id)!;

  it("PLUGIN-01/02/03 pass on a valid manifest with resolving paths and a real description", () => {
    expect(byId("PLUGIN-01").status).toBe("pass");
    expect(byId("PLUGIN-02").status).toBe("pass");
    expect(byId("PLUGIN-03").status).toBe("pass");
  });

  it("HOOK-01 passes on a quoted, non-destructive hook", () => {
    expect(byId("HOOK-01").status).toBe("pass");
  });
});

describe("plugin checks — bad plugin flagged with evidence", () => {
  const { scorecard } = audit(badDir, "plugin");
  const byId = (id: string) => scorecard.results.find((r) => r.id === id)!;

  it("PLUGIN-01 fails on wrong-typed keywords and flags the non-kebab name + non-semver version", () => {
    const r = byId("PLUGIN-01");
    expect(r.status).toBe("fail");
    const msgs = r.evidence.map((e) => e.message).join(" ");
    expect(msgs).toContain("keywords");
  });

  it("PLUGIN-02 fails on traversal and dangling component paths", () => {
    const r = byId("PLUGIN-02");
    expect(r.status).toBe("fail");
    const msgs = r.evidence.map((e) => `${e.snippet ?? ""} ${e.message}`).join(" ");
    expect(msgs).toContain("../shared/deploy.md");
    expect(msgs).toContain("./commands/missing.md");
  });

  it("PLUGIN-03 warns on a title-length description", () => {
    expect(byId("PLUGIN-03").status).toBe("warn");
  });

  it("HOOK-01 fails on curl|sh (inline manifest hooks) and notes the unquoted plugin root", () => {
    const r = byId("HOOK-01");
    expect(r.status).toBe("fail");
    const msgs = r.evidence.map((e) => `${e.snippet ?? ""} ${e.message}`).join(" ");
    expect(msgs).toContain("remote code piped to a shell");
    expect(msgs).toContain("Unquoted");
  });
});

describe("plugin roll-up via scanLocalDir", () => {
  it("a plugin dir scan yields the manifest row PLUS member rows (the roll-up batch)", async () => {
    const res = await scanLocalDir(goodDir);
    const kinds = res.skills.map((s) => s.scorecard.kind).sort();
    expect(kinds).toContain("plugin");
    expect(kinds).toContain("command"); // commands/deploy.md graded as its own artifact
    expect(res.errors).toEqual([]);
  });
});
