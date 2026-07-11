import type { Artifact, ArtifactType, Category, CheckDocs, CheckResult, CheckContext } from "../types.js";

export type { CheckContext } from "../types.js";

/** An LLM-assisted check. Async and may call the model — kept distinct from the sync `Check`. */
export interface AsyncCheck {
  readonly id: string;
  readonly category: Category;
  readonly title: string;
  readonly weight: number;
  /** Artifact kinds this check applies to. Absent = all markdown kinds (never `mcp`). */
  readonly appliesTo?: readonly ArtifactType[];
  /** Reference docs — the `/docs/checks/<id>` page content. */
  readonly docs: CheckDocs;
  run(artifact: Artifact, ctx: CheckContext): Promise<CheckResult>;
}
