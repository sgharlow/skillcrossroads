import type { Artifact, Check, CheckResult } from "../types.js";
import { struct01 } from "./struct-01-frontmatter.js";
import { struct02 } from "./struct-02-fields.js";
import { struct05 } from "./struct-05-references.js";
import { token01 } from "./token-01-budget.js";
import { clarity03 } from "./clarity-03-filler.js";
import { safety01 } from "./safety-01-secrets.js";

/** The v0.1 deterministic check catalog. Adding a check = adding one entry here. */
export const CHECKS: readonly Check[] = [
  struct01,
  struct02,
  struct05,
  token01,
  clarity03,
  safety01,
];

export { struct01, struct02, struct05, token01, clarity03, safety01 };

/** Run every registered check against an artifact. Deterministic, no network. */
export function runChecks(artifact: Artifact): CheckResult[] {
  return CHECKS.map((check) => check.run(artifact));
}
