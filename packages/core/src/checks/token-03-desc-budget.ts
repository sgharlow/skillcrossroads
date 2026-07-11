import type { Check, CheckResult } from "../types.js";
import { entryRel, estimateTokens } from "./util.js";

/** The skill-listing description cap; beyond it the description risks truncation/being dropped. */
const DESC_CAP = 1536;
const DESC_WARN = 1024;

/**
 * TOKEN-03 — Description budget footprint.
 * The `description` is always loaded into the model's skill listing — it costs budget on every
 * turn, whether or not the skill fires. Flags descriptions near or over the ~1,536-char cap.
 */
export const token03: Check = {
  id: "TOKEN-03",
  category: "token",
  title: "Description budget footprint",
  weight: 1,
  docs: {
    why:
      "Unlike the body, the `description` is loaded into the model's skill listing on every " +
      "turn — even when the skill never fires — so its length is an always-on context tax. " +
      "Past the ~1,536-char listing cap it risks being truncated or dropped entirely, which " +
      "can stop the skill from ever triggering.",
    fix:
      "Trim the `description` to the essential trigger phrases: this check warns above 1,024 " +
      "chars and fails above 1,536. Move examples and detail into the SKILL.md body, which " +
      "only loads when the skill actually fires.",
  },
  run(artifact): CheckResult {
    const file = entryRel(artifact);
    const fm = artifact.frontmatter;
    const description = typeof fm?.["description"] === "string" ? (fm["description"] as string) : "";
    const len = description.length;
    const tokens = estimateTokens(description);

    if (len === 0) {
      return {
        id: this.id,
        category: this.category,
        title: this.title,
        weight: this.weight,
        status: "pass",
        score: 100,
        evidence: [{ file, line: 1, message: "No description to weigh (flagged by STRUCT-02)." }],
      };
    }

    const base = {
      id: this.id,
      category: this.category,
      title: this.title,
      weight: this.weight,
    } as const;

    if (len > DESC_CAP) {
      return {
        ...base,
        status: "fail",
        score: 0,
        evidence: [
          {
            file,
            line: 1,
            claimed: `description ${len} chars`,
            verified: `over the ~${DESC_CAP}-char listing cap`,
            message: `Description is ${len} chars (~${tokens} tokens) — beyond the ~${DESC_CAP}-char cap, so it risks truncation or being dropped from the budget.`,
          },
        ],
        fix: "Trim the description to the essential trigger phrases; keep it well under 1,536 chars.",
      };
    }

    if (len > DESC_WARN) {
      return {
        ...base,
        status: "warn",
        score: 70,
        evidence: [
          {
            file,
            line: 1,
            message: `Description is ${len} chars (~${tokens} tokens) — heavy for something loaded every turn.`,
          },
        ],
        fix: "Tighten the description; it is always-on budget cost.",
      };
    }

    return {
      ...base,
      status: "pass",
      score: 100,
      evidence: [{ file, line: 1, message: `Description is ${len} chars (~${tokens} tokens) — within budget.` }],
    };
  },
};
