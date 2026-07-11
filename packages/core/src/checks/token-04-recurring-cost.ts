import type { Check, CheckResult } from "../types.js";
import { entryRel, estimateTokens } from "./util.js";

/**
 * Reference input-token rate (USD per 1M tokens) used ONLY to make recurring cost tangible for
 * relative comparison between artifacts. It is a reference constant, NOT live provider pricing —
 * output is always labelled "at the $3/Mtok reference rate". Swap mentally for your model's rate.
 */
export const REFERENCE_RATE_PER_MTOK = 3;

/** Above this many entry-file tokens per invocation, the recurring cost deserves a warning. */
const WARN_TOKENS = 8_000;

/**
 * TOKEN-04 — Recurring per-invocation cost estimate (deterministic, informational).
 * The entry file is injected on every invocation, so its token figure is a cost the consumer
 * pays every single time. Reports tokens per invocation and dollars per 1,000 invocations at a
 * named reference rate. Uses the exact `count_tokens` figure when present (labelled "exact"),
 * otherwise the heuristic estimate (labelled "rough est" — never presented as exact). Pass below
 * 8k tokens, warn above; never fails (TOKEN-01 owns the budget gate).
 */
export const token04: Check = {
  id: "TOKEN-04",
  category: "token",
  title: "Recurring per-invocation cost",
  weight: 0.5,
  docs: {
    why:
      "The entry file loads into context on EVERY invocation — its token count is not a " +
      "one-time cost but a bill your consumers pay each time the artifact fires. At scale that " +
      "compounds: an 8k-token skill invoked 1,000 times has burned 8M input tokens (~$24 at a " +
      "$3/Mtok reference rate) before doing any work.",
    fix:
      "Treat the per-invocation figure as a budget line, not trivia. Below 8k tokens this " +
      "check is informational; above it, cut the entry file — move reference material into " +
      "supporting files so the recurring cost drops on every future invocation. The dollar " +
      "figure uses a fixed $3/Mtok reference rate for relative comparison, not live pricing.",
  },
  appliesTo: ["skill", "subagent", "command"],
  run(artifact, ctx): CheckResult {
    const file = entryRel(artifact);
    const exact = ctx?.accurateTokens !== undefined;
    const tokens = exact ? (ctx!.accurateTokens as number) : estimateTokens(artifact.raw);
    const perThousand = (tokens * 1_000 * REFERENCE_RATE_PER_MTOK) / 1_000_000;

    const tokenNote = exact
      ? `${tokens.toLocaleString()} tokens (exact, count_tokens)`
      : `~${tokens.toLocaleString()} tokens (rough est.)`;
    const costNote = `~$${perThousand.toFixed(2)} per 1,000 invocations at the $${REFERENCE_RATE_PER_MTOK}/Mtok reference rate`;
    const warn = tokens > WARN_TOKENS;

    return {
      id: this.id,
      category: this.category,
      title: this.title,
      weight: this.weight,
      status: warn ? "warn" : "pass",
      score: warn ? 70 : 100,
      evidence: [
        {
          file,
          claimed: "a one-time authoring cost",
          verified: `${tokenNote} per invocation`,
          message: warn
            ? `Every invocation carries this: ${tokenNote} per invocation — ${costNote}.`
            : `Recurring cost: ${tokenNote} per invocation — ${costNote}.`,
        },
      ],
      fix: warn
        ? "Cut the entry file below ~8k tokens — move reference material into supporting files so every future invocation gets cheaper."
        : undefined,
    };
  },
};
