import type { Check, CheckResult, Evidence } from "../types.js";
import { entryRel, snippet } from "./util.js";

/** A Claude Code dynamic-context shell block: !`command`. */
const DYNAMIC_BLOCK = /!`([^`]+)`/g;
/** Argument/variable interpolation that flows user input into the shell. */
const INTERPOLATION = /\$ARGUMENTS\b|\$\{[^}]+\}|\$[1-9]\b|\$@\b|\$\*/;

/**
 * SAFETY-04 — Shell-injection surface in `!` dynamic-context blocks.
 * A `!`-prefixed dynamic block runs a shell command and injects its output. Interpolating
 * user-controlled arguments (`$ARGUMENTS`, `$1`, `${...}`) directly into that command is a
 * shell-injection surface.
 */
export const safety04: Check = {
  id: "SAFETY-04",
  category: "safety",
  title: "No shell-injection in `!` blocks",
  weight: 1,
  run(artifact): CheckResult {
    const file = entryRel(artifact);
    const lines = artifact.raw.split(/\r?\n/);
    const findings: Evidence[] = [];

    lines.forEach((line, i) => {
      DYNAMIC_BLOCK.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = DYNAMIC_BLOCK.exec(line)) !== null) {
        const cmd = m[1] as string;
        if (INTERPOLATION.test(cmd)) {
          findings.push({
            file,
            line: i + 1,
            snippet: snippet(`!\`${cmd}\``),
            verified: "user arguments interpolated into a shell command",
            message: "Dynamic `!` block interpolates user input into a shell command — a shell-injection surface.",
          });
        }
      }
    });

    if (findings.length > 0) {
      return {
        id: this.id,
        category: this.category,
        title: this.title,
        weight: this.weight,
        status: "fail",
        score: 0,
        evidence: findings,
        fix: "Don't pass `$ARGUMENTS`/`$1`/`${…}` straight into a shell command. Validate/quote the input, or avoid the dynamic block.",
      };
    }

    return {
      id: this.id,
      category: this.category,
      title: this.title,
      weight: this.weight,
      status: "pass",
      score: 100,
      evidence: [{ file, message: "No unsafe interpolation in `!` dynamic blocks." }],
    };
  },
};
