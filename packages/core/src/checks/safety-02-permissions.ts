import type { Check, CheckResult, Evidence } from "../types.js";
import { entryRel } from "./util.js";

/** Parse an `allowed-tools` value (string or array) into individual tool tokens. */
export function parseAllowedTools(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[,\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

const GRANTS_ALL = (t: string): boolean => t === "*" || /^all$/i.test(t);
/** Bare `Bash` or `Bash(*)` / `Bash(:*)` — an unrestricted shell grant. */
const UNRESTRICTED_BASH = (t: string): boolean =>
  /^bash$/i.test(t) || /^bash\(\s*[:*]?\*?\s*\)$/i.test(t);

/**
 * SAFETY-02 — `allowed-tools` least-privilege.
 * A skill can grant itself broad tool access; review before trusting. Flags wildcard grants
 * (everything) and unrestricted `Bash` (arbitrary shell). Scoped grants like `Bash(git status)`
 * are fine.
 */
export const safety02: Check = {
  id: "SAFETY-02",
  category: "safety",
  title: "allowed-tools least-privilege",
  weight: 1,
  run(artifact): CheckResult {
    const file = entryRel(artifact);
    const fm = artifact.frontmatter;
    // Skills/commands declare `allowed-tools`; subagents declare `tools`.
    const raw = fm?.["allowed-tools"] ?? fm?.["allowed_tools"] ?? fm?.["tools"];
    const tools = parseAllowedTools(raw);

    if (raw === undefined || tools.length === 0) {
      // A subagent with NO `tools` list inherits EVERY tool (including Bash) — the opposite of
      // least-privilege for a delegated worker. Skills/commands run in the main permission flow,
      // so absence is fine there.
      if (artifact.type === "subagent") {
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
              line: 1,
              claimed: "no `tools` declared",
              verified: "the agent inherits every tool, including Bash",
              message: "Subagents without a `tools` list get unrestricted tool access.",
            },
          ],
          fix: "Declare a scoped `tools:` list with only what the agent needs (e.g. `tools: Read, Grep, Glob`).",
        };
      }
      return {
        id: this.id,
        category: this.category,
        title: this.title,
        weight: this.weight,
        status: "pass",
        score: 100,
        evidence: [{ file, line: 1, message: "No explicit `allowed-tools` grant to over-scope." }],
      };
    }

    const wildcards = tools.filter(GRANTS_ALL);
    const bashes = tools.filter(UNRESTRICTED_BASH);

    if (wildcards.length > 0) {
      return {
        id: this.id,
        category: this.category,
        title: this.title,
        weight: this.weight,
        status: "fail",
        score: 0,
        evidence: [
          {
            file,
            line: 1,
            snippet: wildcards.join(", "),
            claimed: `allowed-tools: ${tools.join(", ")}`,
            verified: "grants every tool (wildcard)",
            message: "`allowed-tools` grants all tools via a wildcard — the opposite of least-privilege.",
          },
        ],
        fix: "List only the specific tools the skill needs; never `*`/`all`.",
      };
    }

    if (bashes.length > 0) {
      const evidence: Evidence[] = [
        {
          file,
          line: 1,
          snippet: bashes.join(", "),
          verified: "grants unrestricted shell access",
          message: "`allowed-tools` grants unrestricted `Bash` — scope it to specific commands.",
        },
      ];
      return {
        id: this.id,
        category: this.category,
        title: this.title,
        weight: this.weight,
        status: "warn",
        score: 60,
        evidence,
        fix: "Replace bare `Bash` with scoped grants, e.g. `Bash(git status)`, `Bash(npm test)`.",
      };
    }

    return {
      id: this.id,
      category: this.category,
      title: this.title,
      weight: this.weight,
      status: "pass",
      score: 100,
      evidence: [{ file, line: 1, message: `Tool grants look scoped (${tools.length} tool(s)).` }],
    };
  },
};
