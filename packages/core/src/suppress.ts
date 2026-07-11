/**
 * `.skillcrossroads.json` — project config for CI/local scans: suppress specific checks (with a
 * mandatory reason) and set a default `minGrade`.
 *
 * Design rules:
 *  - Suppression is a PURE post-audit transform (`applySuppressions`) — `audit()`'s contract is
 *    untouched, and the re-scored card carries a `suppressed` list so every surface discloses it.
 *  - SAFETY-* checks can NEVER be suppressed (structural safety over convention: a config must
 *    not be able to hide a hardcoded secret or an injection finding from the grade).
 *  - Invalid config is a hard error, never silently ignored — a typo'd suppression that silently
 *    does nothing is worse than a crash (fail closed, like the CLI's flag parsing).
 *  - v1 scope: honored by the CLI and the GitHub Action. Hosted web scans of third-party repos do
 *    NOT apply repo configs (a public badge must reflect the unsuppressed rubric).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { score } from "./score.js";
import type { Scorecard, Suppression } from "./types.js";

export const CONFIG_FILENAME = ".skillcrossroads.json";

export interface CrossroadsConfig {
  readonly suppressions: readonly Suppression[];
  /** Default CI gate, used when the CLI is not given --min-grade. */
  readonly minGrade?: string;
}

export class ConfigError extends Error {}

/** Parse + validate config JSON text. Throws ConfigError with a precise message on any problem. */
export function parseConfig(text: string): CrossroadsConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new ConfigError(`${CONFIG_FILENAME} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ConfigError(`${CONFIG_FILENAME} must be a JSON object`);
  }
  const obj = raw as Record<string, unknown>;
  const suppressions: Suppression[] = [];
  if (obj["ignore"] !== undefined) {
    if (!Array.isArray(obj["ignore"])) throw new ConfigError(`"ignore" must be an array`);
    for (const [i, entry] of (obj["ignore"] as unknown[]).entries()) {
      if (typeof entry !== "object" || entry === null) throw new ConfigError(`"ignore"[${i}] must be an object`);
      const e = entry as Record<string, unknown>;
      const id = e["id"];
      const reason = e["reason"];
      if (typeof id !== "string" || !id.trim()) throw new ConfigError(`"ignore"[${i}].id must be a check id string`);
      if (typeof reason !== "string" || !reason.trim())
        throw new ConfigError(`"ignore"[${i}] ("${id}") needs a non-empty "reason" — unexplained suppressions are not allowed`);
      if (/^SAFETY-/i.test(id.trim()))
        throw new ConfigError(`"${id}" cannot be suppressed — Safety & Security checks always run and always count`);
      suppressions.push({ id: id.trim().toUpperCase(), reason: reason.trim() });
    }
  }
  let minGrade: string | undefined;
  if (obj["minGrade"] !== undefined) {
    if (typeof obj["minGrade"] !== "string") throw new ConfigError(`"minGrade" must be a string (e.g. "B")`);
    minGrade = obj["minGrade"];
  }
  return { suppressions, minGrade };
}

/**
 * Load config for a scan rooted at `scanRoot`: the scan root itself first, then `cwd` (so a repo
 * root config governs a nested skills folder invoked from the repo root). Returns null when no
 * config exists — the common case costs two existsSync calls.
 */
export function loadConfig(scanRoot: string, cwd: string = process.cwd()): CrossroadsConfig | null {
  for (const dir of [scanRoot, cwd]) {
    const p = join(dir, CONFIG_FILENAME);
    if (existsSync(p)) return parseConfig(readFileSync(p, "utf8"));
  }
  return null;
}

/**
 * Apply suppressions to a scorecard: drop the suppressed checks' results, re-score from the
 * remainder (same pure `score()` pipeline), and attach the disclosure list. Suppression ids that
 * matched nothing are dropped from the disclosure (they changed nothing — but the config
 * validator has already guaranteed they were well-formed).
 */
export function applySuppressions(card: Scorecard, config: CrossroadsConfig | null): Scorecard {
  if (!config || config.suppressions.length === 0) return card;
  const ids = new Set(config.suppressions.map((s) => s.id));
  const kept = card.results.filter((r) => !ids.has(r.id.toUpperCase()));
  if (kept.length === card.results.length) return card;
  const applied = config.suppressions.filter((s) => card.results.some((r) => r.id.toUpperCase() === s.id));
  // Re-scoring must not drop kind — renderers key honesty gates (percentile) on it.
  return { ...score(kept, card.kind), kind: card.kind, suppressed: applied };
}
