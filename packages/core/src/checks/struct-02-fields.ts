import type { Check, CheckResult, Evidence } from "../types.js";
import { entryRel } from "./util.js";

/**
 * STRUCT-02 — Recommended frontmatter fields present.
 * `description` is what the model reads to decide whether to invoke the skill — a skill without
 * one is effectively invisible. `name` is recommended (it falls back to the directory name).
 */
export const struct02: Check = {
  id: "STRUCT-02",
  category: "correctness",
  title: "Recommended fields present",
  weight: 1,
  run(artifact): CheckResult {
    const file = entryRel(artifact);
    const fm = artifact.frontmatter;

    if (fm === null) {
      return {
        id: this.id,
        category: this.category,
        title: this.title,
        weight: this.weight,
        status: "fail",
        score: 0,
        evidence: [{ file, line: 1, message: "No frontmatter to read fields from (see STRUCT-01)." }],
        fix: "Add frontmatter with a `description` field.",
      };
    }

    const description = fm["description"];
    const hasDescription = typeof description === "string" && description.trim().length > 0;
    const hasName = typeof fm["name"] === "string" && (fm["name"] as string).trim().length > 0;

    if (!hasDescription) {
      return {
        id: this.id,
        category: this.category,
        title: this.title,
        weight: this.weight,
        status: "fail",
        score: 0,
        evidence: [
          {
            file,
            line: 1,
            message: "Frontmatter is missing a non-empty `description`.",
            verified: "no `description` key (or it is empty)",
          },
        ],
        fix: "Add a `description` that leads with the key use case and the phrases a user would actually say.",
      };
    }

    if (!hasName) {
      const evidence: Evidence[] = [
        {
          file,
          line: 1,
          message: "`description` present, but no `name` field — the skill falls back to its directory name.",
        },
      ];
      return {
        id: this.id,
        category: this.category,
        title: this.title,
        weight: this.weight,
        status: "warn",
        score: 70,
        evidence,
        fix: "Add an explicit `name` field so the skill's identity does not depend on its folder name.",
      };
    }

    return {
      id: this.id,
      category: this.category,
      title: this.title,
      weight: this.weight,
      status: "pass",
      score: 100,
      evidence: [{ file, line: 1, message: "`name` and `description` are both present." }],
    };
  },
};
