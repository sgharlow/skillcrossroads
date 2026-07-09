import { relative, sep } from "node:path";
import type { Artifact, CheckStatus, Evidence } from "../types.js";

/** Relative POSIX path of the entry file, for evidence. */
export function entryRel(artifact: Artifact): string {
  return relative(artifact.root, artifact.entryPath).split(sep).join("/");
}

// Re-export the single calibrated estimator so every check shares one divisor.
export { estimateTokens } from "../llm/tokens.js";

/** 1-indexed line number of the first line matching `predicate`, or undefined. */
export function findLine(text: string, predicate: (line: string) => boolean): number | undefined {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (predicate(lines[i] as string)) return i + 1;
  }
  return undefined;
}

/** All 1-indexed line numbers matching `predicate`. */
export function findLines(text: string, predicate: (line: string) => boolean): number[] {
  const lines = text.split(/\r?\n/);
  const out: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (predicate(lines[i] as string)) out.push(i + 1);
  }
  return out;
}

/** Trim a snippet to a sane length for terminal display. */
export function snippet(line: string, max = 100): string {
  const t = line.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function ev(e: Evidence): Evidence {
  return e;
}

/** Map a status to the conventional pass/warn/fail score band used by simple checks. */
export function bandScore(status: CheckStatus): number {
  return status === "pass" ? 100 : status === "warn" ? 70 : 0;
}
