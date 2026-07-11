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
  docs: {
    why:
      "If the frontmatter is missing or fails to parse as YAML, Claude Code cannot read the " +
      "skill's name or description — the skill loads incorrectly or not at all, and it will " +
      "never fire. Everything else in the file is dead weight until this parses.",
    fix:
      "Start the file with a `---` fence on line 1, a valid `key: value` YAML mapping (at " +
      "minimum a `description`), and a closing `---` fence. Slash commands are the one " +
      "exception — frontmatter is optional there, but when present it must still parse.",
    good:
      "---\n" +
      "description: Formats SQL files. Use when the user asks to format or lint SQL.\n" +
      "---\n" +
      "# SQL Formatter",
    bad:
      "description: Formats SQL files\n" +
      "# SQL Formatter  <- no `---` fences, so nothing parses as frontmatter",
  },
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
      // Slash commands: frontmatter is OPTIONAL — a bare prompt file is a valid command.
      if (artifact.type === "command") {
        return {
          id: this.id,
          category: this.category,
          title: this.title,
          weight: this.weight,
          status: "pass",
          score: 100,
          evidence: [
            { file, line: 1, message: "No frontmatter — optional for slash commands (valid when present)." },
          ],
        };
      }
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
            claimed: `a Claude Code ${artifact.type}`,
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
