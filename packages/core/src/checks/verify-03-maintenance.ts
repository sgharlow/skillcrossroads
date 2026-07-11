import type { Check, CheckResult } from "../types.js";
import { entryRel, findLine } from "./util.js";

/** Top-level supporting files that signal maintenance hygiene. */
const CHANGELOG = /^changelog(\.md)?$/i;
const README = /^readme(\.md)?$/i;

/**
 * VERIFY-03 — Maintenance hygiene (deterministic; skills only — single-file artifacts have no
 * file tree, and their history lives in the repo around them). A skill with ANY of a `version`
 * frontmatter field, a CHANGELOG, or a README gives consumers a way to tell what changed
 * between the copy they installed and the copy upstream. None of the three → warn, never fail.
 */
export const verify03: Check = {
  id: "VERIFY-03",
  category: "verifiability",
  title: "Version, changelog, or readme present",
  weight: 0.5,
  docs: {
    why:
      "Skills get copied into other people's setups and then silently drift from upstream. " +
      "With no `version` field, no CHANGELOG, and no README, a consumer holding last month's " +
      "copy has no way to tell what changed, whether they're affected, or even which revision " +
      "they have — every update becomes a diff-the-whole-file archaeology exercise.",
    fix:
      "Add any one of the three (all is better): a `version:` field in the frontmatter, a " +
      "CHANGELOG.md listing what changed per version, or a README.md stating what the skill " +
      "does and its current state. One line of `version: 1.2.0` is the cheapest fix.",
    good:
      "---\n" +
      "name: sql-formatter\n" +
      "version: 1.2.0\n" +
      "---",
  },
  appliesTo: ["skill"],
  run(artifact): CheckResult {
    const file = entryRel(artifact);
    const base = { id: this.id, category: this.category, title: this.title, weight: this.weight };
    const fm = artifact.frontmatter;

    const version = fm?.["version"];
    const hasVersion =
      (typeof version === "string" && version.trim().length > 0) || typeof version === "number";
    const changelog = artifact.files.find((f) => CHANGELOG.test(f));
    const readme = artifact.files.find((f) => README.test(f));

    if (hasVersion) {
      const line = findLine(artifact.raw, (l) => /^\s*version\s*:/.test(l));
      return {
        ...base,
        status: "pass",
        score: 100,
        evidence: [
          {
            file,
            ...(line ? { line } : {}),
            message: `\`version: ${String(version)}\` in the frontmatter — consumers can tell which revision they have.`,
          },
        ],
      };
    }
    if (changelog || readme) {
      const found = [changelog, readme].filter((f): f is string => Boolean(f));
      return {
        ...base,
        status: "pass",
        score: 100,
        evidence: [
          {
            file: found[0] as string,
            message: `Maintenance file(s) present (${found.join(", ")}) — consumers can tell what changed.`,
          },
        ],
      };
    }

    return {
      ...base,
      status: "warn",
      score: 60,
      evidence: [
        {
          file,
          line: 1,
          claimed: "a maintained skill",
          verified: "no `version` frontmatter, no CHANGELOG(.md), no README(.md)",
          message: "No version/changelog/readme — consumers can't tell what changed between the copy they have and yours.",
        },
      ],
      fix: "Add a `version:` frontmatter field (cheapest), a CHANGELOG.md, or a README.md.",
    };
  },
};
