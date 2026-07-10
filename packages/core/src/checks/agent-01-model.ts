import type { Check, CheckResult } from "../types.js";
import { entryRel } from "./util.js";

/** Aliases Claude Code accepts for a subagent's `model` field. */
const MODEL_ALIASES = new Set(["sonnet", "opus", "haiku", "inherit"]);

/**
 * AGENT-01 — Declared model is valid (subagents only).
 * A typo'd `model:` (e.g. "sonet", "claude-oups") fails at runtime, silently breaking every
 * delegation to the agent. Valid values: an alias (sonnet/opus/haiku/inherit) or a full
 * `claude-*` model id. An absent field is fine — the agent inherits the default.
 */
export const agent01: Check = {
  id: "AGENT-01",
  category: "correctness",
  title: "Declared model is valid",
  weight: 1,
  appliesTo: ["subagent"],
  run(artifact): CheckResult {
    const file = entryRel(artifact);
    const model = artifact.frontmatter?.["model"];

    if (model === undefined || model === null) {
      return {
        id: this.id,
        category: this.category,
        title: this.title,
        weight: this.weight,
        status: "pass",
        score: 100,
        evidence: [{ file, line: 1, message: "No `model` override — the agent inherits the default model." }],
      };
    }

    const value = String(model).trim();
    const valid = MODEL_ALIASES.has(value.toLowerCase()) || /^claude-[a-z0-9.-]+$/i.test(value);
    if (valid) {
      return {
        id: this.id,
        category: this.category,
        title: this.title,
        weight: this.weight,
        status: "pass",
        score: 100,
        evidence: [{ file, line: 1, message: `\`model: ${value}\` is a recognized alias or claude-* id.` }],
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
          snippet: `model: ${value}`,
          claimed: `model "${value}"`,
          verified: "not a known alias (sonnet/opus/haiku/inherit) or claude-* model id",
          message: "Unrecognized `model` value — delegation to this agent will fail at runtime.",
        },
      ],
      fix: "Use `sonnet`, `opus`, `haiku`, `inherit`, or a full `claude-*` model id.",
    };
  },
};
