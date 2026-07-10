import type { Check, CheckResult } from "../types.js";
import { entryRel } from "./util.js";
import { getDescription } from "./trigger-02-desc-quality.js";

/** Explicit invocation cues: "use when/after/before/if", "triggers on", or quoted user phrases. */
const CUE_PATTERNS: readonly RegExp[] = [
  /\buse (?:this )?(?:when|after|before|if|for)\b/i,
  /\btriggers? (?:on|when)\b/i,
  /\bwhen the user\b/i,
  /"[^"]{3,}"/, // a quoted phrase the user would actually say
  /“[^”]{3,}”/,
];

/**
 * TRIGGER-03 — Explicit invocation cues present (deterministic heuristic).
 * Descriptions that state WHEN to fire ("Use when …", quoted user phrases) reliably out-trigger
 * pure what-it-does prose. Complementary to TRIGGER-02 (length) and dominated by the LLM
 * TRIGGER-01 verdict when a key is present.
 */
export const trigger03: Check = {
  id: "TRIGGER-03",
  category: "triggering",
  title: "Invocation cues in the description",
  weight: 0.5,
  appliesTo: ["skill", "subagent"],
  run(artifact): CheckResult {
    const file = entryRel(artifact);
    const desc = getDescription(artifact.frontmatter);
    const base = { id: this.id, category: this.category, title: this.title, weight: this.weight };

    if (!desc) {
      return {
        ...base,
        status: "fail",
        score: 0,
        evidence: [{ file, line: 1, message: "No description — no invocation cues possible." }],
        fix: "Add a description with explicit cues: 'Use when …' plus the phrases a user would say.",
      };
    }

    const hits = CUE_PATTERNS.filter((p) => p.test(desc)).length;
    const snippet = desc.length > 80 ? `${desc.slice(0, 77)}…` : desc;

    if (hits === 0) {
      return {
        ...base,
        status: "warn",
        score: 55,
        evidence: [
          {
            file,
            line: 1,
            snippet,
            claimed: "description will match user requests",
            verified: "no explicit cue ('use when …', 'triggers on …', quoted user phrases) found",
            message: "Pure what-it-does prose — the model has to guess when to invoke it.",
          },
        ],
        fix: "State the trigger explicitly: 'Use when the user says \"…\", \"…\", or wants to …'.",
      };
    }
    return {
      ...base,
      status: "pass",
      score: 100,
      evidence: [{ file, line: 1, message: `Explicit invocation cue(s) present (${hits} pattern(s) matched).` }],
    };
  },
};
