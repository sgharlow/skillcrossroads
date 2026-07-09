import type { Artifact, Check, CheckResult } from "../types.js";
import type { AsyncCheck, CheckContext } from "./async.js";
import { struct01 } from "./struct-01-frontmatter.js";
import { struct02 } from "./struct-02-fields.js";
import { struct05 } from "./struct-05-references.js";
import { token01 } from "./token-01-budget.js";
import { clarity03 } from "./clarity-03-filler.js";
import { safety01 } from "./safety-01-secrets.js";
import { safety02 } from "./safety-02-permissions.js";
import { safety03 } from "./safety-03-autoinvoke.js";
import { safety04 } from "./safety-04-injection.js";
import { trigger01 } from "./trigger-01-triggering.js";

/** The v0.1 deterministic check catalog. Adding a check = adding one entry here. */
export const CHECKS: readonly Check[] = [
  struct01,
  struct02,
  struct05,
  token01,
  clarity03,
  safety01,
  safety02,
  safety03,
  safety04,
];

/** LLM-assisted checks. Run only when a model client is supplied (BYOK). */
export const ASYNC_CHECKS: readonly AsyncCheck[] = [trigger01];

export { struct01, struct02, struct05, token01, clarity03, safety01, safety02, safety03, safety04, trigger01 };
export type { AsyncCheck, CheckContext } from "./async.js";

/** Run every deterministic check against an artifact. Sync, no network. */
export function runChecks(artifact: Artifact): CheckResult[] {
  return CHECKS.map((check) => check.run(artifact));
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
  const deterministic = runChecks(artifact);
  if (!ctx.model) return deterministic;

  const llm: CheckResult[] = [];
  for (const check of ASYNC_CHECKS) {
    try {
      llm.push(await check.run(artifact, ctx));
    } catch (err) {
      ctx.onError?.(check.id, err);
    }
  }
  return [...deterministic, ...llm];
}
