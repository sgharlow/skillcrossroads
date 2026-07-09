import type { Check, CheckResult } from "../types.js";
import { entryRel, findLine, snippet } from "./util.js";

/** Strong signals that a skill performs an irreversible / destructive action. */
const DESTRUCTIVE =
  /\b(deploy(?:s|ing|ment)?|delet(?:e|es|ing)|drop\s+table|truncate|rm\s+-rf|force[-\s]?push|push\s+--force|reset\s+--hard|publish(?:es|ing)?|wipe|terminate|shut\s?down|auto[-\s]?send|send(?:s|ing)?\s+(?:the\s+|an?\s+)?email)\b/i;

function isDisabled(fm: Record<string, unknown> | null): boolean {
  const v = fm?.["disable-model-invocation"] ?? fm?.["disable_model_invocation"];
  return v === true || v === "true";
}

/**
 * SAFETY-03 — Dangerous auto-invocation.
 * Skills auto-invoke by model decision by default. A skill that performs a destructive or
 * irreversible action, without `disable-model-invocation: true`, can be fired by the model
 * without the user explicitly asking. Flags that combination for review.
 */
export const safety03: Check = {
  id: "SAFETY-03",
  category: "safety",
  title: "No destructive auto-invocation",
  weight: 1,
  run(artifact): CheckResult {
    const file = entryRel(artifact);
    const fm = artifact.frontmatter;
    const name = typeof fm?.["name"] === "string" ? (fm["name"] as string) : "";
    const description = typeof fm?.["description"] === "string" ? (fm["description"] as string) : "";
    // Look at identity + first part of the body (where the action is usually stated).
    const bodyHead = artifact.body.split(/\r?\n/).slice(0, 40).join("\n");
    const haystack = `${name}\n${description}\n${bodyHead}`;
    const match = DESTRUCTIVE.exec(haystack);

    if (match && !isDisabled(fm)) {
      const line = findLine(artifact.raw, (l) => DESTRUCTIVE.test(l));
      return {
        id: this.id,
        category: this.category,
        title: this.title,
        weight: this.weight,
        status: "warn",
        score: 55,
        evidence: [
          {
            file,
            ...(line ? { line } : {}),
            snippet: snippet(match[0]),
            claimed: "auto-invocable (no disable-model-invocation)",
            verified: `performs a destructive action ("${match[0]}")`,
            message: `Skill appears to "${match[0]}" but the model can auto-invoke it — a destructive action could fire without the user asking.`,
          },
        ],
        fix: "If this action is destructive/irreversible, set `disable-model-invocation: true` so it only runs when explicitly invoked.",
      };
    }

    return {
      id: this.id,
      category: this.category,
      title: this.title,
      weight: this.weight,
      status: "pass",
      score: 100,
      evidence: [
        {
          file,
          message: isDisabled(fm)
            ? "Model auto-invocation is disabled."
            : "No destructive action detected in an auto-invocable skill.",
        },
      ],
    };
  },
};
