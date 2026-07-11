import { basename } from "node:path";
import { RUBRIC_VERSION, type Artifact, type CheckResult, type CheckStatus, type Evidence } from "../types.js";
import type { AsyncCheck, CheckContext } from "./async.js";
import type { JsonSchema } from "../llm/types.js";
import { hashKey } from "../llm/cache.js";
import { entryRel } from "./util.js";

/** The structured verdict the model returns. Strict-schema compatible (no numeric bounds). */
export interface ContradictionVerdict {
  score: number;
  consistent: boolean;
  contradictions: string[];
  suggestion: string;
}

export const CONTRADICTION_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    score: { type: "integer", description: "0-100: how internally consistent the instructions are (100 = no contradictions or drift)." },
    consistent: {
      type: "boolean",
      description: "Are the instructions free of internal contradictions, stale references, and duplicate conflicting rules?",
    },
    contradictions: {
      type: "array",
      items: { type: "string" },
      description: "Each entry is a short quote-pair of the conflicting statements (e.g. '\"always X\" vs \"never X\"'). Empty if consistent.",
    },
    suggestion: { type: "string", description: "How to reconcile the conflicts (empty if none needed)." },
  },
  required: ["score", "consistent", "contradictions", "suggestion"],
};

/**
 * How much of the body the model judges. Large enough to cover almost every real SKILL.md in
 * one pass; when the body exceeds it, the evidence discloses "first N chars evaluated" so a
 * pass never claims whole-file consistency it didn't check.
 */
export const BODY_SLICE_CHARS = 24_000;

const SYSTEM = `You are Beacon's consistency evaluator for Claude Code skills.
Judge whether the instructions CONTRADICT THEMSELVES or have drifted: "always X" in one place and
"never X" in another, steps that reference sections or files that no longer exist in the text,
duplicate rules that conflict, or an example that violates the stated rules. A model following
contradictory instructions picks one side unpredictably — the author loses control of behavior.
Quote both sides of every conflict you report (short quote-pairs). Be specific and evidence-first;
no false confidence. Report via the tool.`;

function buildPrompt(name: string, description: string, bodyExcerpt: string): string {
  return `Skill name: ${name}
Description: ${description}

Instructions (SKILL.md body):
"""
${bodyExcerpt}
"""

Do these instructions contradict themselves or show internal drift, or are they consistent?`;
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Validate raw model output into a ContradictionVerdict, or THROW if degenerate. A missing/
 * non-numeric score or a non-boolean `consistent` is a model failure (e.g. a truncated tool
 * call), not a verdict — coercing it to score 0 would tank the grade, violating
 * runChecksAsync's onError-and-drop contract. Throwing lets the check be dropped honestly.
 */
export function parseContradictions(raw: unknown): ContradictionVerdict {
  if (typeof raw !== "object" || raw === null) throw new Error("verdict is not an object");
  const o = raw as Record<string, unknown>;
  const score = o["score"];
  if (typeof score !== "number" || !Number.isFinite(score)) throw new Error("verdict score is missing or not numeric");
  const consistent = o["consistent"];
  if (typeof consistent !== "boolean") throw new Error("verdict consistent flag is not a boolean");
  return {
    score: clampScore(score),
    consistent,
    contradictions: Array.isArray(o["contradictions"]) ? o["contradictions"].map((c) => String(c)) : [],
    suggestion: String(o["suggestion"] ?? ""),
  };
}

function statusForScore(score: number): CheckStatus {
  if (score >= 80) return "pass";
  if (score >= 60) return "warn";
  return "fail";
}

/** Map a verdict to a CheckResult. Pure — the unit-testable core of the check. */
export function mapContradictions(
  artifact: Artifact,
  verdict: ContradictionVerdict,
  opts: { evaluatedChars?: number } = {},
): CheckResult {
  const file = entryRel(artifact);
  const status = statusForScore(verdict.score);
  const evidence: Evidence[] = [
    {
      file,
      claimed: verdict.consistent ? "internally consistent instructions" : "instructions that agree with themselves",
      verified: `consistency ${verdict.score}/100${verdict.contradictions.length > 0 ? `, ${verdict.contradictions.length} conflict(s)` : ""}`,
      message: verdict.consistent
        ? "No internal contradictions or drift detected."
        : "The instructions contradict themselves — the model will pick one side unpredictably.",
    },
    // One receipt per conflict: the quote-pair IS the evidence.
    ...verdict.contradictions.slice(0, 5).map(
      (pair): Evidence => ({ file, snippet: pair, message: `Conflicting statements: ${pair}` }),
    ),
    // Honesty note: a pass over a truncated body must never claim whole-file consistency.
    ...(opts.evaluatedChars !== undefined
      ? [
          {
            file,
            message: `first ${opts.evaluatedChars.toLocaleString("en-US")} chars evaluated — the body exceeds the judged excerpt, so the remainder was not checked for consistency.`,
          } satisfies Evidence,
        ]
      : []),
  ];
  return {
    id: "CLARITY-02",
    category: "clarity",
    title: "No internal contradictions",
    weight: 1,
    status,
    score: verdict.score,
    evidence,
    fix: status === "pass" || !verdict.suggestion ? undefined : verdict.suggestion,
  };
}

function noInstructionsResult(artifact: Artifact): CheckResult {
  return {
    id: "CLARITY-02",
    category: "clarity",
    title: "No internal contradictions",
    weight: 1,
    status: "warn",
    score: 50,
    evidence: [{ file: entryRel(artifact), message: "No instructions to evaluate for internal contradictions." }],
    fix: "Write the instruction body — an empty artifact cannot be checked for consistency.",
  };
}

/**
 * CLARITY-02 — No internal contradictions (LLM-assisted).
 * Judges whether the instructions contradict themselves ("always X" then "never X", steps
 * referencing removed sections, duplicate conflicting rules). Cached by content hash so
 * re-scans are free.
 */
export const clarity02: AsyncCheck = {
  id: "CLARITY-02",
  category: "clarity",
  title: "No internal contradictions",
  weight: 1,
  docs: {
    why:
      "Instructions accrete: a rule gets added at the top, its opposite survives at the bottom, " +
      "a step keeps pointing at a section that was deleted two edits ago. A model given " +
      "\"always X\" and \"never X\" does not error — it silently picks one, and which one changes " +
      "run to run. Contradictory instructions are the most invisible way to lose control of an " +
      "artifact's behavior.",
    fix:
      "Reconcile every conflict the evidence quotes: keep one rule, delete its rival, and fix " +
      "steps that reference removed sections. An LLM judges consistency (pass at 80/100) and " +
      "quotes both sides of each conflict it finds, so you can search for the exact text.",
    bad:
      "## Rules\n- Always commit after every change.\n…(200 lines later)…\n- Never commit; leave staging to the user.",
    good:
      "## Rules\n- Never commit; leave staging to the user. (One rule, stated once — no rival elsewhere.)",
  },
  async run(artifact: Artifact, ctx: CheckContext): Promise<CheckResult> {
    if (!ctx.model) throw new Error("CLARITY-02 requires a model client");
    const fm = artifact.frontmatter;
    const body = artifact.body.trim();
    if (!body) return noInstructionsResult(artifact);

    const name =
      typeof fm?.["name"] === "string" && (fm["name"] as string).trim()
        ? (fm["name"] as string).trim()
        : basename(artifact.root);
    const description = typeof fm?.["description"] === "string" ? (fm["description"] as string) : "";
    const bodyExcerpt = body.slice(0, BODY_SLICE_CHARS);
    // Disclose truncation: a pass on an excerpt must never claim whole-file consistency.
    const mapOpts = body.length > BODY_SLICE_CHARS ? { evaluatedChars: BODY_SLICE_CHARS } : {};

    const key = hashKey("CLARITY-02", RUBRIC_VERSION, SYSTEM, ctx.model.name, name, description, bodyExcerpt);
    const cached = await ctx.cache?.get(key);
    if (cached !== undefined) return mapContradictions(artifact, parseContradictions(cached), mapOpts);

    const raw = await ctx.model.generateStructured({
      system: SYSTEM,
      prompt: buildPrompt(name, description, bodyExcerpt),
      toolName: "report_verdict",
      toolDescription: "Report whether these instructions contradict themselves.",
      schema: CONTRADICTION_SCHEMA,
      // The default verdict-sized cap can truncate the tool call mid-JSON on long excerpts —
      // which parses degenerate and must never be cached as a false FAIL.
      maxTokens: 4096,
    });
    // Validate BEFORE caching: a degenerate verdict throws (runChecksAsync drops the check via
    // onError) and nothing is cached — a transient model failure must never persist as a FAIL.
    const verdict = parseContradictions(raw);
    await ctx.cache?.set(key, raw);
    return mapContradictions(artifact, verdict, mapOpts);
  },
};
