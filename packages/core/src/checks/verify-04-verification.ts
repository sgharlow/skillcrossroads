import { basename } from "node:path";
import { RUBRIC_VERSION, type Artifact, type CheckResult, type CheckStatus, type Evidence } from "../types.js";
import type { AsyncCheck, CheckContext } from "./async.js";
import type { JsonSchema } from "../llm/types.js";
import { hashKey } from "../llm/cache.js";
import { entryRel } from "./util.js";

/** The structured verdict the model returns. Strict-schema compatible (no numeric bounds). */
export interface VerifyVerdict {
  score: number;
  verifies: boolean;
  finding: string;
  suggestion: string;
}

export const VERIFY_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    score: { type: "integer", description: "0-100: how well the skill builds in verification before finishing." },
    verifies: {
      type: "boolean",
      description: "Does the skill instruct the model to verify/validate/sanity-check its work before finishing?",
    },
    finding: { type: "string", description: "What verification the skill does, or what is missing." },
    suggestion: { type: "string", description: "How to add a verification step (empty if none needed)." },
  },
  required: ["score", "verifies", "finding", "suggestion"],
};

const SYSTEM = `You are Beacon's verifiability evaluator for Claude Code skills.
Judge whether the skill's instructions tell the model to VERIFY its own work before finishing —
e.g. validate the output, re-read/confirm the result, run tests, sanity-check against the request,
or catch its own likely failure modes — rather than assuming the happy path succeeded. A skill that
just produces output and stops, with no self-check, should score low. Reward concrete, actionable
verification steps. Be specific and evidence-first; no false confidence. Report via the tool.`;

function buildPrompt(name: string, description: string, bodyExcerpt: string): string {
  return `Skill name: ${name}
Description: ${description}

Instructions (SKILL.md body):
"""
${bodyExcerpt}
"""

Does this skill instruct the model to verify/validate/sanity-check its work before finishing?`;
}

function clampScore(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** Validate raw model output into a VerifyVerdict, or throw if unusable. */
export function parseVerify(raw: unknown): VerifyVerdict {
  if (typeof raw !== "object" || raw === null) throw new Error("verdict is not an object");
  const o = raw as Record<string, unknown>;
  return {
    score: clampScore(o["score"]),
    verifies: Boolean(o["verifies"]),
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
export function mapVerify(artifact: Artifact, verdict: VerifyVerdict): CheckResult {
  const file = entryRel(artifact);
  const status = statusForScore(verdict.score);
  const evidence: Evidence[] = [
    {
      file,
      claimed: verdict.verifies ? "instructs a verification step" : "no verification step",
      verified: `verifiability ${verdict.score}/100`,
      message: verdict.finding || (verdict.verifies ? "Instructs the model to verify its work." : "No verification step — the skill assumes the happy path."),
    },
  ];
  return {
    id: "VERIFY-04",
    category: "verifiability",
    title: "Verification step present",
    weight: 1,
    status,
    score: verdict.score,
    evidence,
    fix: status === "pass" || !verdict.suggestion ? undefined : verdict.suggestion,
  };
}

function noInstructionsResult(artifact: Artifact): CheckResult {
  return {
    id: "VERIFY-04",
    category: "verifiability",
    title: "Verification step present",
    weight: 1,
    status: "warn",
    score: 50,
    evidence: [{ file: entryRel(artifact), message: "No instructions to evaluate for a verification step." }],
    fix: "Add a step that validates the output before finishing (e.g. re-read the result, run the tests, confirm success).",
  };
}

/**
 * VERIFY-04 — Verification step present (LLM-assisted).
 * The first check for the Verifiability & Maintainability category: does the skill instruct the
 * model to check its own work before finishing? Cached by content hash so re-scans are free.
 */
export const verify04: AsyncCheck = {
  id: "VERIFY-04",
  category: "verifiability",
  title: "Verification step present",
  weight: 1,
  async run(artifact: Artifact, ctx: CheckContext): Promise<CheckResult> {
    if (!ctx.model) throw new Error("VERIFY-04 requires a model client");
    const fm = artifact.frontmatter;
    const body = artifact.body.trim();
    if (!body) return noInstructionsResult(artifact);

    const name =
      typeof fm?.["name"] === "string" && (fm["name"] as string).trim()
        ? (fm["name"] as string).trim()
        : basename(artifact.root);
    const description = typeof fm?.["description"] === "string" ? (fm["description"] as string) : "";
    const bodyExcerpt = body.slice(0, 2500);

    const key = hashKey("VERIFY-04", RUBRIC_VERSION, ctx.model.name, name, description, bodyExcerpt);
    let raw = await ctx.cache?.get(key);
    if (raw === undefined) {
      raw = await ctx.model.generateStructured({
        system: SYSTEM,
        prompt: buildPrompt(name, description, bodyExcerpt),
        toolName: "report_verdict",
        toolDescription: "Report whether this skill instructs a verification step before finishing.",
        schema: VERIFY_SCHEMA,
      });
      await ctx.cache?.set(key, raw);
    }
    return mapVerify(artifact, parseVerify(raw));
  },
};
