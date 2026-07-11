import { basename } from "node:path";
import { RUBRIC_VERSION, type Artifact, type CheckResult, type CheckStatus, type Evidence } from "../types.js";
import type { AsyncCheck, CheckContext } from "./async.js";
import type { JsonSchema } from "../llm/types.js";
import { hashKey } from "../llm/cache.js";
import { entryRel } from "./util.js";

/** The structured verdict the model returns. Strict-schema compatible (no numeric bounds). */
export interface ConstraintVerdict {
  score: number;
  statesConstraints: boolean;
  finding: string;
  suggestion: string;
}

export const CONSTRAINT_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    score: { type: "integer", description: "0-100: how well the skill states constraints & failure modes vs only the happy path." },
    statesConstraints: {
      type: "boolean",
      description: "Does the skill state its constraints, edge cases, and likely failure modes up front?",
    },
    finding: { type: "string", description: "Which constraints/failure modes are covered, or what is missing." },
    suggestion: { type: "string", description: "How to add the missing constraints/failure-mode handling (empty if none needed)." },
  },
  required: ["score", "statesConstraints", "finding", "suggestion"],
};

const SYSTEM = `You are Beacon's robustness evaluator for Claude Code skills.
Judge whether the skill states its CONSTRAINTS and likely FAILURE MODES up front — edge cases,
invalid or missing inputs, ambiguity, limits, and "what to do when X goes wrong" — rather than
describing only the ideal happy-path flow. Skills that only describe the happy path misbehave on
real-world inputs. Reward explicit preconditions, constraints, and failure-handling guidance. Be
specific and evidence-first; no false confidence. Report via the tool.`;

function buildPrompt(name: string, description: string, bodyExcerpt: string): string {
  return `Skill name: ${name}
Description: ${description}

Instructions (SKILL.md body):
"""
${bodyExcerpt}
"""

Does this skill state its constraints and likely failure modes up front, or only the happy path?`;
}

function clampScore(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** Validate raw model output into a ConstraintVerdict, or throw if unusable. */
export function parseConstraints(raw: unknown): ConstraintVerdict {
  if (typeof raw !== "object" || raw === null) throw new Error("verdict is not an object");
  const o = raw as Record<string, unknown>;
  return {
    score: clampScore(o["score"]),
    statesConstraints: Boolean(o["statesConstraints"]),
    finding: String(o["finding"] ?? ""),
    suggestion: String(o["suggestion"] ?? ""),
  };
}

function statusForScore(score: number): CheckStatus {
  if (score >= 80) return "pass";
  if (score >= 60) return "warn";
  return "fail";
}

/** Map a verdict to a CheckResult. Pure — the unit-testable core of the check. */
export function mapConstraints(artifact: Artifact, verdict: ConstraintVerdict): CheckResult {
  const file = entryRel(artifact);
  const status = statusForScore(verdict.score);
  const evidence: Evidence[] = [
    {
      file,
      claimed: verdict.statesConstraints ? "states constraints & failure modes" : "happy-path only",
      verified: `constraint coverage ${verdict.score}/100`,
      message:
        verdict.finding ||
        (verdict.statesConstraints
          ? "States its constraints and failure modes."
          : "Describes only the happy path — no constraints or failure modes stated."),
    },
  ];
  return {
    id: "CLARITY-05",
    category: "clarity",
    title: "Constraints & failure modes stated",
    weight: 1,
    status,
    score: verdict.score,
    evidence,
    fix: status === "pass" || !verdict.suggestion ? undefined : verdict.suggestion,
  };
}

function noInstructionsResult(artifact: Artifact): CheckResult {
  return {
    id: "CLARITY-05",
    category: "clarity",
    title: "Constraints & failure modes stated",
    weight: 1,
    status: "warn",
    score: 50,
    evidence: [{ file: entryRel(artifact), message: "No instructions to evaluate for constraints or failure modes." }],
    fix: "State the skill's constraints, edge cases, and how to handle likely failure modes.",
  };
}

/**
 * CLARITY-05 — Constraints & failure modes stated (LLM-assisted).
 * Judges whether the skill states its constraints/edge-cases/failure modes up front rather than
 * only the happy path. Cached by content hash so re-scans are free.
 */
export const clarity05: AsyncCheck = {
  id: "CLARITY-05",
  category: "clarity",
  title: "Constraints & failure modes stated",
  weight: 1,
  docs: {
    why:
      "A skill that only describes the happy path misbehaves the first time reality deviates — " +
      "a missing input, an ambiguous request, a failing command. With no stated recovery plan, " +
      "the model improvises, and improvisation is where skills go wrong.",
    fix:
      "State the preconditions, limits, and edge cases up front, and say what to do when each " +
      "goes wrong: \"if X is missing, ask; if Y fails, do Z instead.\" An LLM judges the coverage " +
      "(pass at 80/100) — concrete failure-mode handling scores highest, happy-path-only prose fails.",
    bad: "Run the migration script and report success.",
    good:
      "Run the migration script. If it fails on a lock timeout, retry once. If the schema is " +
      "already current, stop and say so — never re-run a completed migration.",
  },
  async run(artifact: Artifact, ctx: CheckContext): Promise<CheckResult> {
    if (!ctx.model) throw new Error("CLARITY-05 requires a model client");
    const fm = artifact.frontmatter;
    const body = artifact.body.trim();
    if (!body) return noInstructionsResult(artifact);

    const name =
      typeof fm?.["name"] === "string" && (fm["name"] as string).trim()
        ? (fm["name"] as string).trim()
        : basename(artifact.root);
    const description = typeof fm?.["description"] === "string" ? (fm["description"] as string) : "";
    const bodyExcerpt = body.slice(0, 2500);

    const key = hashKey("CLARITY-05", RUBRIC_VERSION, SYSTEM, ctx.model.name, name, description, bodyExcerpt);
    let raw = await ctx.cache?.get(key);
    if (raw === undefined) {
      raw = await ctx.model.generateStructured({
        system: SYSTEM,
        prompt: buildPrompt(name, description, bodyExcerpt),
        toolName: "report_verdict",
        toolDescription: "Report whether this skill states its constraints and failure modes.",
        schema: CONSTRAINT_SCHEMA,
      });
      await ctx.cache?.set(key, raw);
    }
    return mapConstraints(artifact, parseConstraints(raw));
  },
};
