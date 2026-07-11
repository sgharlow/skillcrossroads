import type { Artifact, ArtifactType, Category, Check, CheckDocs, CheckResult } from "../types.js";
import type { AsyncCheck, CheckContext } from "./async.js";
import { LIVE_MCP_CHECK_META } from "../mcp-live.js";
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
import { trigger05 } from "./trigger-05-invocation-flags.js";
import { token04 } from "./token-04-recurring-cost.js";
import { verify01 } from "./verify-01-evals.js";
import { verify03 } from "./verify-03-maintenance.js";
import { clarity02 } from "./clarity-02-contradictions.js";
import { mcp01, mcp02, mcp03 } from "./mcp-config.js";
import { plugin01, plugin02, plugin03, hook01 } from "./plugin.js";

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
  token04,
  clarity03,
  // The secret scan also covers .mcp.json (inline keys in `env` blocks are the classic leak).
  { ...safety01, appliesTo: ["skill", "subagent", "command", "mcp", "plugin"] },
  safety02,
  safety03,
  safety04,
  agent01,
  cmd01,
  trigger02,
  trigger03,
  trigger05,
  verify01,
  verify03,
  mcp01,
  mcp02,
  mcp03,
  plugin01,
  plugin02,
  plugin03,
  hook01,
];

/**
 * LLM-assisted checks. Run only when a model client is supplied (BYOK). Kind-scoped at
 * registration like the deterministic catalog: TRIGGER-01 judges invocation descriptions
 * (skills + subagents; commands are explicitly invoked, matching TRIGGER-02/03); VERIFY-04,
 * CLARITY-05, and CLARITY-02 judge markdown instructions (never a JSON `.mcp.json` — a config
 * structurally has no description/body, and grading it with prose checks turned clean configs
 * into Fs).
 */
export const ASYNC_CHECKS: readonly AsyncCheck[] = [
  { ...trigger01, appliesTo: ["skill", "subagent"] },
  { ...verify04, appliesTo: ["skill", "subagent", "command"] },
  { ...clarity05, appliesTo: ["skill", "subagent", "command"] },
  { ...clarity02, appliesTo: ["skill", "subagent", "command"] },
];

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
  clarity02,
  agent01,
  cmd01,
  trigger02,
  trigger03,
  trigger05,
  verify01,
  verify03,
  token04,
  mcp01,
  mcp02,
  mcp03,
  plugin01,
  plugin02,
  plugin03,
  hook01,
};
export type { AsyncCheck, CheckContext } from "./async.js";

/**
 * Checks applicable to an artifact's kind. Markdown-artifact checks default to all markdown
 * kinds; `mcp` (a JSON config, no frontmatter/body) is WHITELIST-only — a check must name it
 * explicitly, so frontmatter/prose checks can never mis-fire on a config file.
 */
export function applicableChecks(artifact: Artifact): readonly Check[] {
  return checksForKind(artifact.type);
}

/** Same applicability rule for the LLM-assisted set (mcp is whitelist-only there too). */
export function applicableAsyncChecks(artifact: Artifact): readonly AsyncCheck[] {
  return asyncChecksForKind(artifact.type);
}

const WHITELIST_KINDS: readonly ArtifactType[] = ["mcp", "plugin"]; // JSON entries — prose checks must name them explicitly

function checksForKind(kind: ArtifactType): readonly Check[] {
  if (WHITELIST_KINDS.includes(kind)) return CHECKS.filter((c) => c.appliesTo?.includes(kind));
  return CHECKS.filter((c) => !c.appliesTo || c.appliesTo.includes(kind));
}

function asyncChecksForKind(kind: ArtifactType): readonly AsyncCheck[] {
  if (WHITELIST_KINDS.includes(kind)) return ASYNC_CHECKS.filter((c) => c.appliesTo?.includes(kind));
  return ASYNC_CHECKS.filter((c) => !c.appliesTo || c.appliesTo.includes(kind));
}

/**
 * Categories the live `--mcp-live` checks (MCPT-01/02/03) can score for an `mcp` config —
 * derived from the authoritative `LIVE_MCP_CHECK_META` so the two can never drift; a test
 * additionally pins the meta against real `gradeMcpLive` output.
 */
const LIVE_MCP_CATEGORIES: readonly Category[] = LIVE_MCP_CHECK_META.map((m) => m.category);

/**
 * Every category that CAN be scored for an artifact kind — the union of the deterministic and
 * LLM-assisted registries applicable to that kind, plus (for `mcp`) the live-introspection
 * checks. `score()` uses this to separate "structurally n/a for this kind" (never a coverage
 * hole) from "could have scored but didn't" (a genuinely partial grade — e.g. keyless LLM
 * checks, a static-only mcp scan, or a suppression hole).
 */
export function applicableCategories(kind: ArtifactType): ReadonlySet<Category> {
  const cats = new Set<Category>();
  for (const c of checksForKind(kind)) cats.add(c.category);
  for (const c of asyncChecksForKind(kind)) cats.add(c.category);
  if (kind === "mcp") for (const c of LIVE_MCP_CATEGORIES) cats.add(c);
  return cats;
}

/** One check's reference-docs entry — everything the `/docs/checks/<id>` page renders. */
export interface CheckDocEntry {
  readonly id: string;
  readonly category: Category;
  readonly title: string;
  readonly docs: CheckDocs;
  /** Kinds the check applies to, as registered. Undefined = all markdown kinds. */
  readonly appliesTo?: readonly ArtifactType[];
  /** How the check runs: deterministic, LLM-assisted (BYOK/Pro), or live MCP introspection. */
  readonly mode: "deterministic" | "llm" | "live";
}

/**
 * The full check-docs registry: every deterministic, LLM-assisted, and live check, exactly as
 * registered (kind scoping included). Feeds the hosted `/docs/checks` pages and the sitemap —
 * a new check ships with its docs page automatically (docs are a required field, so a check
 * without fix guidance cannot compile).
 */
export function allCheckDocs(): readonly CheckDocEntry[] {
  return [
    ...CHECKS.map((c): CheckDocEntry => ({ id: c.id, category: c.category, title: c.title, docs: c.docs, appliesTo: c.appliesTo, mode: "deterministic" })),
    ...ASYNC_CHECKS.map((c): CheckDocEntry => ({ id: c.id, category: c.category, title: c.title, docs: c.docs, appliesTo: c.appliesTo, mode: "llm" })),
    ...LIVE_MCP_CHECK_META.map((c): CheckDocEntry => ({ id: c.id, category: c.category, title: c.title, docs: c.docs, appliesTo: ["mcp"], mode: "live" })),
  ];
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
  for (const check of applicableAsyncChecks(artifact)) {
    try {
      llm.push(await check.run(artifact, enriched));
    } catch (err) {
      enriched.onError?.(check.id, err);
    }
  }
  return [...deterministic, ...llm];
}
