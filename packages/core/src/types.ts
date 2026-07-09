/**
 * Beacon core domain types.
 *
 * The whole engine is a pure pipeline over these:
 *   parse(dir) → Artifact → runChecks → CheckResult[] → score → Scorecard → renderTerminal
 */

/** The kinds of Claude Code artifacts Beacon can grade. v0.1 implements `skill` only. */
export type ArtifactType = "skill" | "subagent" | "mcp" | "plugin";

/** The six rubric categories (Build Bible §3.4). */
export type Category =
  | "correctness"
  | "triggering"
  | "clarity"
  | "token"
  | "safety"
  | "verifiability";

/** Human-facing category labels + rubric weights (must sum to 1.0). */
export interface CategoryMeta {
  readonly key: Category;
  readonly label: string;
  readonly weight: number;
}

export const CATEGORIES: readonly CategoryMeta[] = [
  { key: "correctness", label: "Correctness & Structure", weight: 0.2 },
  { key: "triggering", label: "Triggering & Discoverability", weight: 0.22 },
  { key: "clarity", label: "Clarity & Instructions", weight: 0.18 },
  { key: "token", label: "Token & Context Cost", weight: 0.15 },
  { key: "safety", label: "Safety & Security", weight: 0.15 },
  { key: "verifiability", label: "Verifiability & Maintainability", weight: 0.1 },
] as const;

/** The versioned rubric identifier. A bump is a content/announcement event — never silent. */
export const RUBRIC_VERSION = "1.0";

/** A parsed artifact — the input to every check. */
export interface Artifact {
  readonly type: ArtifactType;
  /** Absolute path to the artifact's root directory. */
  readonly root: string;
  /** Absolute path to the entry file (e.g. `SKILL.md`). */
  readonly entryPath: string;
  /** The entry file's full raw contents. */
  readonly raw: string;
  /** Parsed YAML frontmatter, or null if absent/unparseable. */
  readonly frontmatter: Record<string, unknown> | null;
  /** Error message if frontmatter was present but failed to parse. */
  readonly frontmatterError: string | null;
  /** The markdown body (everything after the frontmatter block). */
  readonly body: string;
  /** 1-indexed line in the entry file where the body starts. */
  readonly bodyStartLine: number;
  /** Supporting files present under `root` (relative POSIX paths), excluding the entry file. */
  readonly files: readonly string[];
}

export type CheckStatus = "pass" | "warn" | "fail";

/** A single piece of file-and-line evidence backing a check result. */
export interface Evidence {
  /** Relative path (from artifact root) of the file the evidence is in. */
  readonly file: string;
  /** 1-indexed line number, when locatable. */
  readonly line?: number;
  /** The offending (or confirming) snippet, trimmed. */
  readonly snippet?: string;
  /** What the artifact claims / appears to intend. */
  readonly claimed?: string;
  /** What Beacon actually verified. */
  readonly verified?: string;
  /** Plain-language description of the finding. */
  readonly message: string;
}

/** The output of running one check against an artifact. */
export interface CheckResult {
  readonly id: string;
  readonly category: Category;
  readonly title: string;
  /** Relative weight of this check within its category (checks in a category are averaged, weighted). */
  readonly weight: number;
  readonly status: CheckStatus;
  /** 0–100 for this check. */
  readonly score: number;
  readonly evidence: readonly Evidence[];
  /** Actionable fix suggestion, shown in "top fixes". */
  readonly fix?: string;
}

/** A check module. Deterministic in v0.1: no network, no LLM. */
export interface Check {
  readonly id: string;
  readonly category: Category;
  readonly title: string;
  readonly weight: number;
  run(artifact: Artifact): CheckResult;
}

/** Per-category rollup within a scorecard. */
export interface CategoryScore {
  readonly key: Category;
  readonly label: string;
  readonly weight: number;
  /** 0–100, or null when no checks evaluated this category (v0.1). */
  readonly score: number | null;
  readonly evaluated: boolean;
  readonly results: readonly CheckResult[];
  readonly warnCount: number;
  readonly failCount: number;
}

/** The final graded scorecard. */
export interface Scorecard {
  readonly rubricVersion: string;
  /** 0–100 overall, computed over evaluated categories with renormalized weights. */
  readonly overall: number;
  readonly grade: string;
  readonly categories: readonly CategoryScore[];
  readonly results: readonly CheckResult[];
  /** True if at least one category had no checks (overall is a partial grade). */
  readonly partial: boolean;
}
