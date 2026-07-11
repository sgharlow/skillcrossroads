/**
 * `--suggest` — LLM fix generation (Sprint 9, item 17).
 *
 * Turns the audit's findings into concrete, reviewable rewrites: a proposed replacement for the
 * offending text (description, frontmatter field, hook command…) or explicit steps when there is
 * no single text to replace. HARD RULE: suggestions are proposals only — nothing here writes to
 * the artifact, and no caller may auto-apply them (the human reviews the diff and edits).
 *
 * One structured model call covers the top findings (cheaper and more coherent than one call per
 * finding), cached by content hash like every other LLM path — re-suggesting an unchanged
 * artifact is free.
 */
import type { Artifact, CheckContext, CheckResult, Scorecard } from "./types.js";
import { CHECKS, ASYNC_CHECKS } from "./checks/index.js";
import { hashKey } from "./llm/cache.js";

export interface FixSuggestion {
  /** The check this suggestion addresses (e.g. "TRIGGER-02"). */
  readonly checkId: string;
  /** One-line statement of the change. */
  readonly summary: string;
  /** The current offending text, when the fix is a direct replacement. */
  readonly current?: string;
  /** The proposed replacement text — the reviewable half of the diff. */
  readonly proposed?: string;
  /** Concrete steps, when no single text replacement applies. */
  readonly steps?: readonly string[];
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          checkId: { type: "string" },
          summary: { type: "string" },
          current: { type: "string" },
          proposed: { type: "string" },
          steps: { type: "array", items: { type: "string" } },
        },
        required: ["checkId", "summary"],
      },
    },
  },
  required: ["suggestions"],
} as const;

/** Worst-first, same ranking every renderer uses for "top fixes". */
function rankFindings(results: readonly CheckResult[]): CheckResult[] {
  return results
    .filter((r) => r.status !== "pass")
    .sort((a, b) => (a.status !== b.status ? (a.status === "fail" ? -1 : 1) : a.score - b.score));
}

/** The registry's own fix guidance for a check id — grounds the model in the documented remedy. */
function docsFixFor(id: string): string | undefined {
  return [...CHECKS, ...ASYNC_CHECKS].find((c) => c.id === id)?.docs.fix;
}

function findingBlock(r: CheckResult): string {
  const ev = r.evidence
    .slice(0, 3)
    .map((e) => `  - ${e.file}${e.line ? `:${e.line}` : ""} ${e.message}${e.snippet ? ` | snippet: ${e.snippet.slice(0, 200)}` : ""}`)
    .join("\n");
  const docFix = docsFixFor(r.id);
  return `${r.id} (${r.status}, score ${r.score}) — ${r.title}\n${ev}${r.fix ? `\n  documented fix: ${r.fix}` : ""}${docFix ? `\n  reference guidance: ${docFix}` : ""}`;
}

/** Clamp untrusted model output into the declared shape (never trust free-form fields). */
export function parseSuggestions(raw: unknown, allowedIds: ReadonlySet<string>): FixSuggestion[] {
  const list = (raw as { suggestions?: unknown })?.suggestions;
  if (!Array.isArray(list)) return [];
  const out: FixSuggestion[] = [];
  for (const item of list) {
    const o = item as Record<string, unknown>;
    if (typeof o?.["checkId"] !== "string" || typeof o?.["summary"] !== "string") continue;
    if (!allowedIds.has(o["checkId"])) continue; // the model may not invent findings
    out.push({
      checkId: o["checkId"],
      summary: o["summary"].slice(0, 500),
      ...(typeof o["current"] === "string" ? { current: o["current"].slice(0, 2000) } : {}),
      ...(typeof o["proposed"] === "string" ? { proposed: o["proposed"].slice(0, 4000) } : {}),
      ...(Array.isArray(o["steps"])
        ? { steps: o["steps"].filter((s): s is string => typeof s === "string").map((s) => s.slice(0, 500)).slice(0, 8) }
        : {}),
    });
  }
  return out;
}

const SYSTEM =
  "You are Skill Crossroads' fix engine. You are given a Claude Code artifact and its audit " +
  "findings. For each finding, propose the smallest concrete change that would make the check " +
  "pass WITHOUT changing what the artifact does. When the fix is a text replacement (a " +
  "description, a frontmatter field, a hook command), return the exact current text and the " +
  "exact proposed replacement. When it is structural (add a file, split content), return steps. " +
  "Never propose adding capabilities, tools, or scope the artifact does not already have.";

/**
 * Generate fix suggestions for a scorecard's findings. Requires `ctx.model` (BYOK on the CLI,
 * managed on Pro hosted scans) — returns [] without one, mirroring the LLM checks' honest-skip.
 * A model failure surfaces via `ctx.onError` and returns [] — suggestions must never break a scan.
 */
export async function suggestFixes(
  artifact: Artifact,
  card: Scorecard,
  ctx: CheckContext,
  opts: { max?: number } = {},
): Promise<FixSuggestion[]> {
  if (!ctx.model) return [];
  const findings = rankFindings(card.results).slice(0, opts.max ?? 3);
  if (findings.length === 0) return [];
  const allowed = new Set(findings.map((f) => f.id));

  const cacheKey = hashKey(
    "suggest-v1",
    ctx.model.name,
    artifact.raw,
    ...findings.map((f) => `${f.id}:${f.status}:${f.score}`),
  );
  const cached = await ctx.cache?.get(cacheKey);
  if (cached !== undefined) {
    const parsed = parseSuggestions(cached, allowed);
    if (parsed.length > 0) return parsed; // empty/corrupt entry — regenerate
  }

  const prompt = [
    `ARTIFACT (${artifact.type}) — entry file contents:`,
    "```",
    artifact.raw.slice(0, 24_000),
    "```",
    "",
    `FINDINGS (${findings.length}):`,
    ...findings.map(findingBlock),
    "",
    "Propose one suggestion per finding, in the same order.",
  ].join("\n");

  try {
    const raw = await ctx.model.generateStructured({
      system: SYSTEM,
      prompt,
      toolName: "report_fix_suggestions",
      toolDescription: "Report concrete fix suggestions for the audit findings.",
      schema: SCHEMA as unknown as Record<string, unknown>,
      // Suggestions carry current/proposed text blocks — far bigger than a verdict. The default
      // 1024-token cap truncates the tool call, which silently parses to zero suggestions.
      maxTokens: 8192,
      // An 8192-token generation can outlast the client's default 30 s verdict timeout.
      timeoutMs: 120_000,
    });
    const suggestions = parseSuggestions(raw, allowed);
    await ctx.cache?.set(cacheKey, { suggestions });
    return suggestions;
  } catch (err) {
    ctx.onError?.("SUGGEST", err);
    return [];
  }
}
