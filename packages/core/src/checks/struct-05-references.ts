import type { Check, CheckResult, Evidence } from "../types.js";
import { entryRel, snippet } from "./util.js";

/** Strip a `#fragment` and `?query` from a reference target. */
function cleanTarget(raw: string): string {
  return raw.split("#")[0]!.split("?")[0]!.trim();
}

function isExternalOrAnchor(target: string): boolean {
  if (target === "") return true;
  if (target.startsWith("#")) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return true; // http:, https:, mailto:, etc.
  if (target.startsWith("//")) return true;
  return false;
}

/**
 * Collect local relative-path references from markdown link syntax `](target)` and from
 * backticked paths that contain a slash and a file extension. Returns [target, lineNumber].
 */
function collectReferences(raw: string): Array<{ target: string; line: number }> {
  const refs: Array<{ target: string; line: number }> = [];
  const lines = raw.split(/\r?\n/);
  const linkRe = /\]\(([^)]+)\)/g;
  const codePathRe = /`(\.{0,2}\/[^`\s]+?\.[a-z0-9]{1,5})`/gi;

  lines.forEach((line, i) => {
    let m: RegExpExecArray | null;
    linkRe.lastIndex = 0;
    while ((m = linkRe.exec(line)) !== null) {
      refs.push({ target: m[1] as string, line: i + 1 });
    }
    codePathRe.lastIndex = 0;
    while ((m = codePathRe.exec(line)) !== null) {
      refs.push({ target: m[1] as string, line: i + 1 });
    }
  });
  return refs;
}

/**
 * STRUCT-05 — Supporting-file references resolve.
 * Flags links/paths in SKILL.md that point to files not present in the skill directory — the
 * "references a converter that does not exist" class of bug. Progressive disclosure only works
 * if the referenced files are actually there.
 */
export const struct05: Check = {
  id: "STRUCT-05",
  category: "correctness",
  title: "Supporting-file references resolve",
  weight: 1,
  run(artifact): CheckResult {
    const file = entryRel(artifact);
    const present = new Set(artifact.files.map((f) => f.toLowerCase()));
    // Directory prefixes that exist (so a link to a folder resolves).
    const dirs = new Set<string>();
    for (const f of artifact.files) {
      const parts = f.split("/");
      for (let i = 1; i < parts.length; i++) {
        dirs.add(parts.slice(0, i).join("/").toLowerCase());
      }
    }

    const missing: Evidence[] = [];
    const seen = new Set<string>();

    for (const { target, line } of collectReferences(artifact.raw)) {
      const clean = cleanTarget(target);
      if (isExternalOrAnchor(clean)) continue;
      if (clean.startsWith("/")) continue; // absolute OS/site path — out of scope for v0.1
      // Normalize `./x` and `x` relative to the skill root. We do not resolve `..` escapes;
      // treat them as out of scope (can't validate outside the artifact).
      if (clean.startsWith("../")) continue;
      const rel = clean.replace(/^\.\//, "").replace(/\/+$/, "").toLowerCase();
      if (rel === "" || seen.has(`${rel}@${line}`)) continue;
      seen.add(`${rel}@${line}`);

      const resolves = present.has(rel) || dirs.has(rel);
      if (!resolves) {
        missing.push({
          file,
          line,
          snippet: snippet(clean),
          claimed: `references \`${clean}\``,
          verified: "no such file or directory in the skill",
          message: `Reference to \`${clean}\` does not resolve to a file in the skill directory.`,
        });
      }
    }

    if (missing.length > 0) {
      return {
        id: this.id,
        category: this.category,
        title: this.title,
        weight: this.weight,
        status: "fail",
        score: 0,
        evidence: missing,
        fix: "Add the missing file(s), fix the path, or remove the dead reference.",
      };
    }

    return {
      id: this.id,
      category: this.category,
      title: this.title,
      weight: this.weight,
      status: "pass",
      score: 100,
      evidence: [{ file, message: "All local file references resolve to files in the skill." }],
    };
  },
};
