import type { Artifact, Category, CheckResult, CheckContext } from "../types.js";

export type { CheckContext } from "../types.js";

/** An LLM-assisted check. Async and may call the model — kept distinct from the sync `Check`. */
export interface AsyncCheck {
  readonly id: string;
  readonly category: Category;
  readonly title: string;
  readonly weight: number;
  run(artifact: Artifact, ctx: CheckContext): Promise<CheckResult>;
}
