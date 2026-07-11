import type { Check, CheckResult, Evidence } from "../types.js";
import { entryRel, findLine, snippet } from "./util.js";

/** The two invocation-control frontmatter flags this check audits. */
const FLAG_KEYS = ["disable-model-invocation", "user-invocable"] as const;

function flagLine(raw: string, key: string): number | undefined {
  return findLine(raw, (l) => new RegExp(`^\\s*${key}\\s*:`).test(l));
}

function flagEvidence(artifact: { raw: string }, file: string, key: string, rest: Omit<Evidence, "file" | "line" | "snippet">): Evidence {
  const line = flagLine(artifact.raw, key);
  const rawLine = line ? artifact.raw.split(/\r?\n/)[line - 1] : undefined;
  return {
    file,
    ...(line ? { line } : {}),
    ...(rawLine ? { snippet: snippet(rawLine) } : {}),
    ...rest,
  };
}

/**
 * TRIGGER-05 — Invocation-flag consistency (deterministic).
 * `disable-model-invocation` and `user-invocable` control WHO can invoke the artifact. A
 * non-boolean value (the classic YAML string `"true"`) silently misconfigures the flag; the
 * combination `user-invocable: false` + `disable-model-invocation: true` means NOBODY can ever
 * invoke it — pure dead weight in every session.
 */
export const trigger05: Check = {
  id: "TRIGGER-05",
  category: "triggering",
  title: "Invocation flags are consistent",
  weight: 0.5,
  docs: {
    why:
      "`disable-model-invocation` and `user-invocable` decide who can fire the artifact — and " +
      "YAML is unforgiving here. A quoted `\"true\"` is a string, not a boolean, so the flag " +
      "silently does not do what you think. Worse, setting `user-invocable: false` AND " +
      "`disable-model-invocation: true` together locks EVERYONE out: the artifact can never be " +
      "invoked by the user or the model, yet still loads into every session as dead weight.",
    fix:
      "Use bare YAML booleans (`true`/`false`, never quoted strings) for both flags, and make " +
      "sure at least one invocation path stays open. If nothing should ever invoke it, delete " +
      "the artifact instead of shipping an uninvocable one.",
    good:
      "---\n" +
      "name: deploy-prod\n" +
      "disable-model-invocation: true   # user-invocable stays true (the default)\n" +
      "---",
    bad:
      "---\n" +
      "user-invocable: false\n" +
      "disable-model-invocation: \"true\"   # a string AND, with the line above, uninvocable by anyone\n" +
      "---",
  },
  appliesTo: ["skill", "subagent", "command"],
  run(artifact): CheckResult {
    const file = entryRel(artifact);
    const fm = artifact.frontmatter;
    const base = { id: this.id, category: this.category, title: this.title, weight: this.weight };

    const disable = fm?.["disable-model-invocation"];
    const userInvocable = fm?.["user-invocable"];

    // (b) Both paths closed: the artifact is structurally uninvocable — dead weight.
    if (userInvocable === false && disable === true) {
      return {
        ...base,
        status: "fail",
        score: 0,
        evidence: [
          flagEvidence(artifact, file, "user-invocable", {
            claimed: "an invocable artifact",
            verified: "user-invocable: false — the user can never invoke it",
            message: "`user-invocable: false` combined with `disable-model-invocation: true` means no one can ever invoke this artifact.",
          }),
          flagEvidence(artifact, file, "disable-model-invocation", {
            verified: "disable-model-invocation: true — the model can never invoke it either",
            message: "Both invocation paths are closed — the artifact is dead weight loaded into every session.",
          }),
        ],
        fix: "Re-open one invocation path (drop one of the two flags), or delete the artifact if nothing should invoke it.",
      };
    }

    // (a) Present but not a boolean — a string "true"/"false" silently misconfigures the flag.
    const nonBoolean = FLAG_KEYS.filter((key) => {
      const v = fm?.[key];
      return v !== undefined && v !== null && typeof v !== "boolean";
    });
    if (nonBoolean.length > 0) {
      return {
        ...base,
        status: "warn",
        score: 55,
        evidence: nonBoolean.map((key) =>
          flagEvidence(artifact, file, key, {
            claimed: `${key} configured`,
            verified: `value is ${JSON.stringify(fm?.[key])} (${typeof fm?.[key]}), not a boolean`,
            message: `\`${key}\` is not a YAML boolean — a quoted "true"/"false" is a string and silently misconfigures the flag.`,
          }),
        ),
        fix: "Use bare YAML booleans for invocation flags: `disable-model-invocation: true`, not `\"true\"`.",
      };
    }

    // (c) Valid booleans or absent (defaults apply).
    const present = FLAG_KEYS.filter((key) => fm?.[key] !== undefined);
    return {
      ...base,
      status: "pass",
      score: 100,
      evidence: [
        present.length > 0
          ? flagEvidence(artifact, file, present[0] as string, {
              message: `Invocation flag(s) ${present.map((k) => `\`${k}\``).join(", ")} are valid booleans; at least one invocation path is open.`,
            })
          : { file, line: 1, message: "No invocation flags set — defaults apply (user- and model-invocable)." },
      ],
    };
  },
};
