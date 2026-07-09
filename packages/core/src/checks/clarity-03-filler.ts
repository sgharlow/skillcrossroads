import type { Check, CheckResult, CheckStatus, Evidence } from "../types.js";
import { entryRel, snippet } from "./util.js";

const DECORATIVE = "│┌┐└┘─├┤┬┴┼═║╔╗╚╝╠╣╦╩╬█░▓▒▄▀■□●○◆◇★☆=*#~_+";
const decorativeSet = new Set(DECORATIVE.split(""));

/** A markdown table separator / alignment row — legitimate, not decorative filler. */
function isTableRow(line: string): boolean {
  return /\|/.test(line) && /^[\s|:-]+$/.test(line.trim());
}

/** A line that is (almost) entirely decorative characters. */
function isBannerLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 12) return false;
  if (/^`{3,}/.test(trimmed)) return false; // code fence marker
  if (isTableRow(line)) return false;
  // A run of >= 10 identical decorative chars.
  if (/(.)\1{9,}/.test(trimmed) && decorativeSet.has(trimmed.match(/(.)\1{9,}/)![1] as string)) {
    return true;
  }
  const nonSpace = trimmed.replace(/\s/g, "");
  if (nonSpace.length === 0) return false;
  let decorative = 0;
  for (const ch of nonSpace) if (decorativeSet.has(ch)) decorative++;
  return decorative / nonSpace.length >= 0.6;
}

const PERSONA_RE =
  /\b(you are|act as)\b[^.\n]*\b(10x|rock\s?star|ninja|wizard|guru|world[- ]?class|genius|superhuman)\b/i;

function statusFor(count: number): CheckStatus {
  if (count === 0) return "pass";
  if (count <= 3) return "warn";
  return "fail";
}

/**
 * CLARITY-03 — No ASCII-art / persona filler.
 * Decorative banners and "you are a 10x ninja" persona filler burn tokens without improving
 * instructions. Flags banner lines and persona-filler phrases in the body.
 */
export const clarity03: Check = {
  id: "CLARITY-03",
  category: "clarity",
  title: "No ASCII-art / persona filler",
  weight: 1,
  run(artifact): CheckResult {
    const file = entryRel(artifact);
    const bodyLines = artifact.body.split(/\r?\n/);
    const evidence: Evidence[] = [];

    bodyLines.forEach((line, i) => {
      const lineNo = artifact.bodyStartLine + i;
      if (isBannerLine(line)) {
        evidence.push({
          file,
          line: lineNo,
          snippet: snippet(line),
          message: "Decorative ASCII-art / banner line — pure token cost, no instructional value.",
        });
      } else if (PERSONA_RE.test(line)) {
        evidence.push({
          file,
          line: lineNo,
          snippet: snippet(line),
          message: "Persona filler — does not change model behavior; consider removing.",
        });
      }
    });

    const status = statusFor(evidence.length);
    const score = status === "pass" ? 100 : status === "warn" ? 75 : 40;

    if (status === "pass") {
      return {
        id: this.id,
        category: this.category,
        title: this.title,
        weight: this.weight,
        status,
        score,
        evidence: [{ file, message: "No ASCII-art or persona filler detected." }],
      };
    }

    return {
      id: this.id,
      category: this.category,
      title: this.title,
      weight: this.weight,
      status,
      score,
      evidence,
      fix: "Delete decorative banners and persona filler; keep instructions plain and imperative.",
    };
  },
};
