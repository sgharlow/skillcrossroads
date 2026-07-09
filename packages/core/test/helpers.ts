import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Artifact } from "../src/types.js";

const here = dirname(fileURLToPath(import.meta.url));

/** Absolute path to a fixture skill directory. */
export function fixture(name: string): string {
  return join(here, "fixtures", "skills", name);
}

/**
 * Build an Artifact for unit-testing a single check, filling sane defaults.
 * Useful for exercising a check's branches without touching disk.
 */
export function makeArtifact(over: Partial<Artifact> = {}): Artifact {
  const raw = over.raw ?? "---\nname: x\ndescription: y\n---\n\n# Body\n";
  return {
    type: "skill",
    root: over.root ?? "/virtual/skill",
    entryPath: over.entryPath ?? "/virtual/skill/SKILL.md",
    raw,
    frontmatter: over.frontmatter !== undefined ? over.frontmatter : { name: "x", description: "y" },
    frontmatterError: over.frontmatterError ?? null,
    body: over.body ?? "\n# Body\n",
    bodyStartLine: over.bodyStartLine ?? 5,
    files: over.files ?? [],
  };
}
