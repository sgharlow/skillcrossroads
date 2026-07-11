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
  docs: {
    why:
      "The full SKILL.md is injected into context every time the skill fires, so every line is " +
      "a recurring token (and dollar) cost on every invocation — and a bloated file risks your " +
      "actual instructions being diluted or truncated. The official guidance is ~500 lines; " +
      "this check warns above 500 and fails above 750.",
    fix:
      "Cut SKILL.md to under 500 lines by moving heavy reference material into supporting " +
      "files and linking to them (progressive disclosure), so the model loads that material " +
      "only when it needs it. The evidence shows your estimated tokens and per-load cost at a " +
      "$3/Mtok reference rate.",
  },
  run(artifact, ctx): CheckResult {
    const file = entryRel(artifact);
    const lineCount = artifact.raw.split(/\r?\n/).length;
    const exact = ctx?.accurateTokens !== undefined;
    const tokens = exact ? (ctx!.accurateTokens as number) : estimateTokens(artifact.raw);
    const dollars = (tokens / 1_000_000) * REFERENCE_PRICE_PER_MTOK;
    const status = statusForLines(lineCount);
    const score = status === "pass" ? 100 : status === "warn" ? 65 : 25;

    const tokenNote = exact
      ? `${tokens.toLocaleString()} tokens (exact, count_tokens)`
      : `~${tokens.toLocaleString()} tokens (rough est.)`;
    const costNote =
      `${tokenNote}; ~$${dollars.toFixed(4)} per load at $${REFERENCE_PRICE_PER_MTOK}/Mtok reference rate`;

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
