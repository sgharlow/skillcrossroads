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
  docs: {
    why:
      "The `description` is what the model reads when deciding whether to invoke your skill — " +
      "without one the skill is effectively invisible and never triggers (for commands, /help " +
      "and the SlashCommand tool show nothing). A missing `name` is softer: the skill silently " +
      "falls back to its directory name.",
    fix:
      "Add a non-empty `description` that leads with the key use case and the phrases a user " +
      "would actually say, plus an explicit `name`. Slash commands only need `description` — " +
      "they are named by their filename.",
    good:
      "---\n" +
      "name: sql-formatter\n" +
      "description: Formats SQL files. Use when the user asks to format, lint, or clean up SQL.\n" +
      "---",
    bad:
      "---\n" +
      "name: sql-formatter\n" +
      "---  <- no `description`, so the model has nothing to match against",
  },
  run(artifact): CheckResult {
    const file = entryRel(artifact);
    const fm = artifact.frontmatter;

    if (fm === null) {
      // A command with no frontmatter has no description in /help — recommended, not required.
      if (artifact.type === "command") {
        return {
          id: this.id,
          category: this.category,
          title: this.title,
          weight: this.weight,
          status: "warn",
          score: 70,
          evidence: [
            { file, line: 1, message: "No `description` — /help and the SlashCommand tool show nothing for this command." },
          ],
          fix: "Add frontmatter with a `description` so the command is discoverable.",
        };
      }
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
      // Commands: missing description degrades discoverability but the command still runs.
      const commandCase = artifact.type === "command";
      return {
        id: this.id,
        category: this.category,
        title: this.title,
        weight: this.weight,
        status: commandCase ? "warn" : "fail",
        score: commandCase ? 70 : 0,
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

    // Commands are named by their filename — `name` is not a command field.
    if (artifact.type === "command") {
      return {
        id: this.id,
        category: this.category,
        title: this.title,
        weight: this.weight,
        status: "pass",
        score: 100,
        evidence: [{ file, line: 1, message: "`description` present (commands are named by filename)." }],
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
