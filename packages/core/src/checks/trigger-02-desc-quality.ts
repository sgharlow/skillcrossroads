import type { Check, CheckResult, Evidence } from "../types.js";
import { entryRel } from "./util.js";

/** The description string, trimmed, or null. */
export function getDescription(fm: Record<string, unknown> | null): string | null {
  const d = fm?.["description"];
  return typeof d === "string" && d.trim() ? d.trim() : null;
}

/**
 * TRIGGER-02 — Description shape (deterministic heuristic).
 * The #1 real-world failure is a description that reads like a TITLE — too short to anchor the
 * model's invocation decision. This is the deterministic floor under the LLM triggering check
 * (TRIGGER-01): length bands only, evidence-cited, no false precision about *semantics*.
 * Weighted below TRIGGER-01 so the LLM verdict dominates when a key is present.
 */
export const trigger02: Check = {
  id: "TRIGGER-02",
  category: "triggering",
  title: "Description long enough to anchor invocation",
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
        evidence: [{ file, line: 1, message: "No description — nothing for the model to match against." }],
        fix: "Add a description that leads with the use case and the phrases a user would say.",
      };
    }

    const len = desc.length;
    const snippet = len > 80 ? `${desc.slice(0, 77)}…` : desc;
    const ev = (message: string, verified: string): Evidence[] => [
      { file, line: 1, snippet, claimed: "description will trigger invocation", verified, message },
    ];

    if (len < 40) {
      return {
        ...base,
        status: "fail",
        score: 20,
        evidence: ev(
          "Description reads like a title — too short to describe when to invoke.",
          `${len} chars — under the 40-char title-length threshold`,
        ),
        fix: "Expand it: what the artifact does, WHEN to use it, and 2–3 phrases a user would actually say.",
      };
    }
    if (len < 100) {
      return {
        ...base,
        status: "warn",
        score: 65,
        evidence: ev(
          "Description is thin — likely under-specifies when to invoke.",
          `${len} chars — under the ~100-char reliable-trigger band`,
        ),
        fix: "Add the concrete use case and user phrasing (e.g. 'Use when the user says …').",
      };
    }
    return {
      ...base,
      status: "pass",
      score: 100,
      evidence: [{ file, line: 1, message: `Description is substantive (${len} chars).` }],
    };
  },
};
