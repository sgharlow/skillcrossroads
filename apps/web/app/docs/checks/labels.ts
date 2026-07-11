import type { ArtifactType } from "@beacon/core";

/** Human labels for artifact kinds on the check-reference pages. */
export const KIND_LABELS: Record<ArtifactType, string> = {
  skill: "skills",
  subagent: "subagents",
  command: "slash commands",
  mcp: "MCP configs",
  plugin: "plugins",
};

export const MODE_LABELS = {
  deterministic: "deterministic",
  llm: "LLM-assisted",
  live: "live (--mcp-live)",
} as const;

/** "skills · subagents" — absent appliesTo means every markdown kind (never mcp). */
export function kindsLabel(appliesTo: readonly ArtifactType[] | undefined): string {
  if (!appliesTo) return [KIND_LABELS.skill, KIND_LABELS.subagent, KIND_LABELS.command].join(" · ");
  return appliesTo.map((k) => KIND_LABELS[k]).join(" · ");
}
