import type { Artifact, Category, CheckResult } from "../types.js";
import type { ModelClient } from "../llm/types.js";
import type { Cache } from "../llm/cache.js";

/** Runtime context passed to LLM-assisted checks. */
export interface CheckContext {
  /** The model client to use. When absent, async checks are skipped (deterministic-only mode). */
  readonly model?: ModelClient;
  /** Optional verdict cache. */
  readonly cache?: Cache;
  /** Called when an async check errors, so callers can report it without failing the scan. */
  onError?(checkId: string, err: unknown): void;
}

/** An LLM-assisted check. Async and may call the model — kept distinct from the sync `Check`. */
export interface AsyncCheck {
  readonly id: string;
  readonly category: Category;
  readonly title: string;
  readonly weight: number;
  run(artifact: Artifact, ctx: CheckContext): Promise<CheckResult>;
}
