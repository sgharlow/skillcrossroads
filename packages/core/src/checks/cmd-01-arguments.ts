import type { Check, CheckResult } from "../types.js";
import { entryRel } from "./util.js";

/** Does the command body reference arguments ($ARGUMENTS or positional $1..$9)? */
export function usesArguments(body: string): boolean {
  return /\$ARGUMENTS\b/.test(body) || /\$[1-9]\b/.test(body);
}

/**
 * CMD-01 — Arguments and `argument-hint` agree (slash commands only).
 * A command that reads `$ARGUMENTS`/`$1` without an `argument-hint` is undiscoverable — `/help`
 * and the SlashCommand tool can't tell users what to pass. The reverse (a hint for arguments the
 * body never reads) promises behavior the command doesn't have.
 */
export const cmd01: Check = {
  id: "CMD-01",
  category: "clarity",
  title: "Arguments and argument-hint agree",
  weight: 1,
  appliesTo: ["command"],
  run(artifact): CheckResult {
    const file = entryRel(artifact);
    const hasHint =
      typeof artifact.frontmatter?.["argument-hint"] === "string" &&
      (artifact.frontmatter["argument-hint"] as string).trim().length > 0;
    const usesArgs = usesArguments(artifact.body);

    if (usesArgs && !hasHint) {
      return {
        id: this.id,
        category: this.category,
        title: this.title,
        weight: this.weight,
        status: "warn",
        score: 60,
        evidence: [
          {
            file,
            line: 1,
            claimed: "command reads $ARGUMENTS / positional args",
            verified: "no `argument-hint` in frontmatter",
            message: "The command takes arguments but gives users no hint what to pass.",
          },
        ],
        fix: 'Add an `argument-hint` (e.g. `argument-hint: "[file] [message]"`) so /help shows the expected input.',
      };
    }

    if (!usesArgs && hasHint) {
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
            claimed: "`argument-hint` promises arguments",
            verified: "body never references $ARGUMENTS or $1..$9",
            message: "The hint advertises arguments the command never reads.",
          },
        ],
        fix: "Use $ARGUMENTS (or $1..$9) in the body, or remove the misleading `argument-hint`.",
      };
    }

    return {
      id: this.id,
      category: this.category,
      title: this.title,
      weight: this.weight,
      status: "pass",
      score: 100,
      evidence: [
        {
          file,
          line: 1,
          message: usesArgs
            ? "Arguments are read and `argument-hint` documents them."
            : "No arguments used and none advertised — consistent.",
        },
      ],
    };
  },
};
