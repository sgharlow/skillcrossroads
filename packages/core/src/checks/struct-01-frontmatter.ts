import type { Check, CheckResult } from "../types.js";
import { entryRel } from "./util.js";

/**
 * STRUCT-01 — Valid YAML frontmatter.
 * A skill must open with a `---`-fenced YAML mapping. Missing or malformed frontmatter means
 * the skill will not load correctly.
 */
export const struct01: Check = {
  id: "STRUCT-01",
  category: "correctness",
  title: "Valid YAML frontmatter",
  weight: 1,
  run(artifact): CheckResult {
    const file = entryRel(artifact);

    if (artifact.frontmatterError) {
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
            message: `Frontmatter failed to parse: ${artifact.frontmatterError}`,
            verified: "YAML parser rejected the frontmatter block",
          },
        ],
        fix: "Fix the YAML so it is a valid `key: value` mapping between the opening and closing `---` fences.",
      };
    }

    if (artifact.frontmatter === null) {
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
            message: "No YAML frontmatter block found at the top of the file.",
            claimed: "a Claude Code skill",
            verified: "file does not begin with a `---` frontmatter fence",
          },
        ],
        fix: "Add a `---`-fenced YAML block at the very top with at least a `description` field.",
      };
    }

    return {
      id: this.id,
      category: this.category,
      title: this.title,
      weight: this.weight,
      status: "pass",
      score: 100,
      evidence: [{ file, line: 1, message: "Frontmatter parses as a valid YAML mapping." }],
    };
  },
};
