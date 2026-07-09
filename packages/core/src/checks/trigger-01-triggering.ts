import { basename } from "node:path";
import { RUBRIC_VERSION, type Artifact, type CheckResult, type CheckStatus, type Evidence } from "../types.js";
import type { AsyncCheck, CheckContext } from "./async.js";
import type { JsonSchema } from "../llm/types.js";
import { hashKey } from "../llm/cache.js";
import { entryRel, snippet } from "./util.js";

/** The structured verdict the model returns. Strict-schema compatible (no numeric bounds). */
export interface TriggerVerdict {
  score: number;
  wouldReliablyTrigger: boolean;
  issues: Array<{ severity: "high" | "medium" | "low"; finding: string }>;
  suggestedTriggerPhrases: string[];
}

export const VERDICT_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    score: { type: "integer", description: "0-100 triggering quality; 100 = fires reliably." },
    wouldReliablyTrigger: {
      type: "boolean",
      description: "Will the model reliably auto-invoke this skill on realistic user prompts?",
    },
    issues: {
      type: "array",
      description: "Specific reasons the description may under- or over-trigger.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          severity: { type: "string", enum: ["high", "medium", "low"] },
          finding: { type: "string" },
        },
        required: ["severity", "finding"],
      },
    },
    suggestedTriggerPhrases: {
      type: "array",
      description: "Natural-language phrases a user would say that the description should cover.",
      items: { type: "string" },
    },
  },
  required: ["score", "wouldReliablyTrigger", "issues", "suggestedTriggerPhrases"],
};

const SYSTEM = `You are Beacon's triggering-quality evaluator for Claude Code skills.
A skill's "description" is the ONLY text the model reads to decide whether to auto-invoke it.
Judge, strictly and evidence-first, whether this description will cause reliable invocation on
realistic user prompts. Reward: leading with the key use case; concrete natural-language phrases
a user would actually type; scope that matches what the skill body actually does. Penalize:
vague/generic descriptions ("helps with tasks"), missing trigger phrases, over-broad scope that
would fire on unrelated prompts, and descriptions that don't match the skill's real behavior.
Be honest and specific — no false confidence. Report your verdict via the tool.`;

function buildPrompt(name: string, description: string, bodyExcerpt: string): string {
  return `Skill name: ${name}

Description (verbatim):
"""
${description}
"""

What the skill actually does (SKILL.md body excerpt):
"""
${bodyExcerpt}
"""

Evaluate whether the description will reliably trigger this skill.`;
}

function clampScore(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** Validate the raw model output into a TriggerVerdict, or throw if unusable. */
export function parseVerdict(raw: unknown): TriggerVerdict {
  if (typeof raw !== "object" || raw === null) throw new Error("verdict is not an object");
  const o = raw as Record<string, unknown>;
  const issues = Array.isArray(o["issues"]) ? o["issues"] : [];
  const phrases = Array.isArray(o["suggestedTriggerPhrases"]) ? o["suggestedTriggerPhrases"] : [];
  return {
    score: clampScore(o["score"]),
    wouldReliablyTrigger: Boolean(o["wouldReliablyTrigger"]),
    issues: issues
      .filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
      .map((i) => ({
        severity: (["high", "medium", "low"] as const).includes(i["severity"] as never)
          ? (i["severity"] as "high" | "medium" | "low")
          : "medium",
        finding: String(i["finding"] ?? ""),
      }))
      .filter((i) => i.finding),
    suggestedTriggerPhrases: phrases.map((p) => String(p)).filter(Boolean),
  };
}

function statusForScore(score: number): CheckStatus {
  if (score >= 80) return "pass";
  if (score >= 60) return "warn";
  return "fail";
}

/** Map a verdict to a CheckResult. Pure — the unit-testable core of the check. */
export function mapVerdict(artifact: Artifact, description: string, verdict: TriggerVerdict): CheckResult {
  const file = entryRel(artifact);
  const status = statusForScore(verdict.score);
  const evidence: Evidence[] = [
    {
      file,
      line: 1,
      snippet: snippet(description, 120),
      claimed: "description as written",
      verified: verdict.wouldReliablyTrigger
        ? "likely to trigger reliably"
        : "unlikely to trigger reliably",
      message: `Triggering quality ${verdict.score}/100 — ${
        verdict.wouldReliablyTrigger ? "should fire" : "may not fire"
      } on realistic prompts.`,
    },
    ...verdict.issues.slice(0, 4).map((i) => ({
      file,
      line: 1,
      message: `[${i.severity}] ${i.finding}`,
    })),
  ];
  const fix =
    verdict.suggestedTriggerPhrases.length > 0
      ? `Lead with the key use case and add trigger phrases users would say, e.g.: ${verdict.suggestedTriggerPhrases
          .slice(0, 3)
          .map((p) => `"${p}"`)
          .join(", ")}.`
      : undefined;

  return {
    id: "TRIGGER-01",
    category: "triggering",
    title: "Description triggers reliably",
    weight: 1,
    status,
    score: verdict.score,
    evidence,
    fix: status === "pass" ? undefined : fix,
  };
}

function missingDescriptionResult(artifact: Artifact): CheckResult {
  return {
    id: "TRIGGER-01",
    category: "triggering",
    title: "Description triggers reliably",
    weight: 1,
    status: "fail",
    score: 0,
    evidence: [
      {
        file: entryRel(artifact),
        line: 1,
        message: "No `description` to evaluate — the model has nothing to trigger on (see STRUCT-02).",
      },
    ],
    fix: "Add a `description` that leads with the key use case and the phrases a user would say.",
  };
}

/**
 * TRIGGER-01 — Description triggers reliably (LLM-assisted).
 * The #1 real-world skill failure is "my skill never fires." This asks the model to judge, with
 * structured output, whether the description will cause reliable invocation. Cached by content
 * hash so re-scans of an unchanged description cost nothing.
 */
export const trigger01: AsyncCheck = {
  id: "TRIGGER-01",
  category: "triggering",
  title: "Description triggers reliably",
  weight: 1,
  async run(artifact: Artifact, ctx: CheckContext): Promise<CheckResult> {
    if (!ctx.model) throw new Error("TRIGGER-01 requires a model client");
    const fm = artifact.frontmatter;
    const description = typeof fm?.["description"] === "string" ? (fm["description"] as string).trim() : "";
    if (!description) return missingDescriptionResult(artifact);

    const name =
      typeof fm?.["name"] === "string" && (fm["name"] as string).trim()
        ? (fm["name"] as string).trim()
        : basename(artifact.root);
    const bodyExcerpt = artifact.body.slice(0, 1500);

    const key = hashKey("TRIGGER-01", RUBRIC_VERSION, ctx.model.name, name, description, bodyExcerpt);
    let raw = await ctx.cache?.get(key);
    if (raw === undefined) {
      raw = await ctx.model.generateStructured({
        system: SYSTEM,
        prompt: buildPrompt(name, description, bodyExcerpt),
        toolName: "report_verdict",
        toolDescription: "Report the triggering-quality verdict for this skill's description.",
        schema: VERDICT_SCHEMA,
      });
      await ctx.cache?.set(key, raw);
    }
    return mapVerdict(artifact, description, parseVerdict(raw));
  },
};
