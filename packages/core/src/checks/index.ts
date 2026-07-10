import type { Artifact, Check, CheckResult } from "../types.js";
import type { AsyncCheck, CheckContext } from "./async.js";
import { struct01 } from "./struct-01-frontmatter.js";
import { struct02 } from "./struct-02-fields.js";
import { struct05 } from "./struct-05-references.js";
import { token01 } from "./token-01-budget.js";
import { token02 } from "./token-02-disclosure.js";
import { token03 } from "./token-03-desc-budget.js";
import { clarity03 } from "./clarity-03-filler.js";
import { safety01 } from "./safety-01-secrets.js";
import { safety02 } from "./safety-02-permissions.js";
import { safety03 } from "./safety-03-autoinvoke.js";
import { safety04 } from "./safety-04-injection.js";
import { trigger01 } from "./trigger-01-triggering.js";
import { verify04 } from "./verify-04-verification.js";
import { clarity05 } from "./clarity-05-constraints.js";
import { agent01 } from "./agent-01-model.js";
import { cmd01 } from "./cmd-01-arguments.js";
import { trigger02 } from "./trigger-02-desc-quality.js";
import { trigger03 } from "./trigger-03-cues.js";
import { verify01 } from "./verify-01-evals.js";

/**
 * The deterministic check catalog. Adding a check = adding one entry here.
 * Kind-scoping: checks without `appliesTo` run on every artifact kind; skill-structure checks
 * (supporting files / progressive disclosure) are scoped to skills at registration — single-file
 * artifacts (subagents, commands) have no supporting-file tree to judge.
 */
export const CHECKS: readonly Check[] = [
  struct01,
  struct02,
  { ...struct05, appliesTo: ["skill"] },
  token01,
  { ...token02, appliesTo: ["skill"] },
  token03,
  clarity03,
  safety01,
  safety02,
  safety03,
  safety04,
  agent01,
  cmd01,
  trigger02,
  trigger03,
  verify01,
];

/** LLM-assisted checks. Run only when a model client is supplied (BYOK). */
export const ASYNC_CHECKS: readonly AsyncCheck[] = [trigger01, verify04, clarity05];

export {
  struct01,
  struct02,
  struct05,
  token01,
  token02,
  token03,
  clarity03,
  safety01,
  safety02,
  safety03,
  safety04,
  trigger01,
  verify04,
  clarity05,
  agent01,
  cmd01,
  trigger02,
  trigger03,
  verify01,
};
export type { AsyncCheck, CheckContext } from "./async.js";

/** Checks applicable to an artifact's kind (absent `appliesTo` = applies to all kinds). */
export function applicableChecks(artifact: Artifact): readonly Check[] {
  return CHECKS.filter((c) => !c.appliesTo || c.appliesTo.includes(artifact.type));
}

/** Run every applicable deterministic check against an artifact. Sync, no network. `ctx` is optional. */
export function runChecks(artifact: Artifact, ctx?: CheckContext): CheckResult[] {
  return applicableChecks(artifact).map((check) => check.run(artifact, ctx));
}

/**
 * Run deterministic checks plus (if `ctx.model` is set) LLM-assisted checks. A failing async
 * check is reported via `ctx.onError` and dropped — the affected category stays unevaluated
 * rather than tanking the grade, matching deterministic-only behavior.
 */
export async function runChecksAsync(
  artifact: Artifact,
  ctx: CheckContext = {},
): Promise<CheckResult[]> {
  // Precompute the exact token count once (free count_tokens call) so TOKEN-01 can report it.
  let accurateTokens = ctx.accurateTokens;
  if (accurateTokens === undefined && ctx.tokenCounter) {
    try {
      accurateTokens = await ctx.tokenCounter.count(artifact.raw);
    } catch (err) {
      ctx.onError?.("TOKEN-01", err);
    }
  }
  const enriched: CheckContext = accurateTokens === undefined ? ctx : { ...ctx, accurateTokens };

  const deterministic = runChecks(artifact, enriched);
  if (!enriched.model) return deterministic;

  const llm: CheckResult[] = [];
  for (const check of ASYNC_CHECKS) {
    try {
      llm.push(await check.run(artifact, enriched));
    } catch (err) {
      enriched.onError?.(check.id, err);
    }
  }
  return [...deterministic, ...llm];
}
