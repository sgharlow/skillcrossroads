import type { Check, CheckResult } from "../types.js";
import { entryRel } from "./util.js";

/** Files that count as evals/tests for a skill: anything under evals/, eval/, tests/, test/. */
const EVAL_PATH = /^(?:evals?|tests?)\//i;
/** A body heading that establishes a verification step. */
const VERIFY_HEADING = /^#{1,6}\s*(?:verify|verification|validate|validation|self[- ]check)\b/im;

/**
 * VERIFY-01 — Evals or tests present (deterministic; skills only — single-file artifacts have no
 * file tree). Ladder of proof: real eval/test files beat a prose "## Verify" step, which beats
 * nothing. Complements the LLM VERIFY-04 (which judges the *quality* of the verification step).
 */
export const verify01: Check = {
  id: "VERIFY-01",
  category: "verifiability",
  title: "Evals or tests present",
  weight: 1,
  docs: {
    why:
      "Without evals there is no way to prove the skill does what its description claims — " +
      "every edit is a blind change, and regressions ship silently. \"It worked when I wrote " +
      "it\" is not evidence.",
    fix:
      "Add an evals/ (or tests/) folder with 2–3 test prompts and their expected outcomes. " +
      "The ladder of proof: runnable eval/test files pass; a prose \"## Verify\" section in the " +
      "body only warns (manual verification); neither fails.",
    good:
      "evals/convert-invoice.md:\n" +
      "  Prompt: \"Convert invoice.pdf to markdown\"\n" +
      "  Expect: a Markdown table with one row per line item; totals match the PDF.",
  },
  appliesTo: ["skill"],
  run(artifact): CheckResult {
    const file = entryRel(artifact);
    const base = { id: this.id, category: this.category, title: this.title, weight: this.weight };

    const evalFiles = artifact.files.filter((f) => EVAL_PATH.test(f));
    if (evalFiles.length > 0) {
      return {
        ...base,
        status: "pass",
        score: 100,
        evidence: [
          {
            file: evalFiles[0] as string,
            message: `Eval/test files present (${evalFiles.length}): the skill's claims are checkable.`,
          },
        ],
      };
    }

    const headingMatch = VERIFY_HEADING.exec(artifact.body);
    if (headingMatch) {
      const line = artifact.bodyStartLine + artifact.body.slice(0, headingMatch.index).split("\n").length - 1;
      return {
        ...base,
        status: "warn",
        score: 70,
        evidence: [
          {
            file,
            line,
            snippet: headingMatch[0].trim(),
            claimed: "the skill can be verified",
            verified: "a prose verification step, but no runnable evals/ or tests/",
            message: "Manual verification only — add eval prompts with expected outcomes to make it checkable.",
          },
        ],
        fix: "Add an evals/ folder with 2–3 test prompts and the expected assertions.",
      };
    }

    return {
      ...base,
      status: "fail",
      score: 30,
      evidence: [
        {
          file,
          line: 1,
          claimed: "the skill works",
          verified: "no evals/, tests/, or verification section found",
          message: "No way to prove the skill does what it claims.",
        },
      ],
      fix: "Add an evals/ folder (test prompts + expected outcomes) and a '## Verify' step in the body.",
    };
  },
};
