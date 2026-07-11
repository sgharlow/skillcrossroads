import type { Check, CheckResult } from "../types.js";
import { entryRel } from "./util.js";

/** Above this, a SKILL.md with no supporting files is probably inlining reference material. */
const LEAN_LINES = 200;

/**
 * TOKEN-02 — Progressive disclosure.
 * Heavy reference material belongs in supporting files that the model loads on demand, not
 * inlined in SKILL.md (which is loaded in full every time the skill fires). Flags a large
 * SKILL.md that ships no supporting files at all.
 */
export const token02: Check = {
  id: "TOKEN-02",
  category: "token",
  title: "Progressive disclosure",
  weight: 1,
  docs: {
    why:
      "A SKILL.md over 200 body lines with zero supporting files means all of your reference " +
      "material loads into context every single time the skill fires — whether or not that " +
      "invocation needs it. You pay the full token bill on every trigger.",
    fix:
      "Split the heavy reference sections into supporting files inside the skill directory and " +
      "link to them from SKILL.md, so the model pulls them in on demand. Either a lean body " +
      "(200 lines or fewer) or at least one supporting file passes this check.",
  },
  run(artifact): CheckResult {
    const file = entryRel(artifact);
    const bodyLines = artifact.body.split(/\r?\n/).length;
    const supporting = artifact.files.length;

    if (bodyLines <= LEAN_LINES || supporting > 0) {
      return {
        id: this.id,
        category: this.category,
        title: this.title,
        weight: this.weight,
        status: "pass",
        score: 100,
        evidence: [
          {
            file,
            message:
              supporting > 0
                ? `Reference material is split across ${supporting} supporting file(s).`
                : `SKILL.md is lean (${bodyLines} body lines) — no disclosure needed.`,
          },
        ],
      };
    }

    return {
      id: this.id,
      category: this.category,
      title: this.title,
      weight: this.weight,
      status: "warn",
      score: 70,
      evidence: [
        {
          file,
          claimed: "everything inlined in SKILL.md",
          verified: `${bodyLines} body lines, 0 supporting files`,
          message: `Large SKILL.md (${bodyLines} lines) with no supporting files — all of it loads every time the skill fires.`,
        },
      ],
      fix: "Move heavy reference material into supporting files and link to them, so the model loads it only when needed.",
    };
  },
};
