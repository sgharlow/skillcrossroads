import type { Check, CheckResult, CheckStatus } from "../types.js";
import { entryRel, estimateTokens } from "./util.js";

/** Official spec guidance: keep SKILL.md under ~500 lines. */
const LINE_GUIDANCE = 500;
const LINE_WARN = 750;

/**
 * Reference input price used only to make token cost tangible. Provider- and model-agnostic;
 * labelled as an estimate in output. Swap per your model. ($ per 1M input tokens.)
 */
const REFERENCE_PRICE_PER_MTOK = 3;

function statusForLines(lines: number): CheckStatus {
  if (lines <= LINE_GUIDANCE) return "pass";
  if (lines <= LINE_WARN) return "warn";
  return "fail";
}

/**
 * TOKEN-01 — Body under line/token budget.
 * A bloated SKILL.md burns context every time the skill triggers and risks being truncated.
 * Reports line count against the ~500-line guidance plus an estimated token + $ recurring cost.
 */
export const token01: Check = {
  id: "TOKEN-01",
  category: "token",
  title: "Body under line/token budget",
  weight: 1,
  run(artifact): CheckResult {
    const file = entryRel(artifact);
    const lineCount = artifact.raw.split(/\r?\n/).length;
    const tokens = estimateTokens(artifact.raw);
    const dollars = (tokens / 1_000_000) * REFERENCE_PRICE_PER_MTOK;
    const status = statusForLines(lineCount);
    const score = status === "pass" ? 100 : status === "warn" ? 65 : 25;

    const costNote =
      `~${tokens.toLocaleString()} tokens (est., ~4 chars/token); ` +
      `~$${dollars.toFixed(4)} per load at $${REFERENCE_PRICE_PER_MTOK}/Mtok reference rate`;

    const message =
      status === "pass"
        ? `SKILL.md is ${lineCount} lines — within the ~${LINE_GUIDANCE}-line guidance. ${costNote}.`
        : `SKILL.md is ${lineCount} lines — over the ~${LINE_GUIDANCE}-line guidance. ${costNote}.`;

    return {
      id: this.id,
      category: this.category,
      title: this.title,
      weight: this.weight,
      status,
      score,
      evidence: [
        {
          file,
          claimed: `${LINE_GUIDANCE}-line guidance`,
          verified: `${lineCount} lines`,
          message,
        },
      ],
      fix:
        status === "pass"
          ? undefined
          : "Move heavy reference material into supporting files and link to them (progressive disclosure), keeping SKILL.md lean.",
    };
  },
};
