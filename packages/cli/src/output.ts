/**
 * Single-artifact output: report + HTML/badge artifacts + the `--suggest` section.
 * Split from cli.ts so it is importable in tests (cli.ts runs `main()` on import).
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pc from "picocolors";
import {
  renderTerminal,
  renderHtml,
  renderBadge,
  renderMarkdown,
  suggestFixes,
  badgeUrls,
  badgeMarkdownLine,
  type AuditResult,
  type CheckContext,
  type FixSuggestion,
} from "@beacon/core";

/** A flag that takes an optional `=value`: undefined = absent, true = present (default path), string = explicit. */
export type OptionalPath = string | true | undefined;

/**
 * Strip ANSI escape sequences and control characters (everything except `\n` and `\t`) from
 * model-derived text. Suggestion text is model output over an UNTRUSTED artifact — a hostile
 * skill can steer the model into emitting `\x1b[`/`\x9b` sequences that rewrite or hide
 * terminal output. Exported for tests.
 */
export function sanitizeText(text: string): string {
  return (
    text
      // CSI sequences — `ESC [` or the single-byte CSI `\x9b`, params + intermediates + final.
      .replace(/(?:\x1b\[|\x9b)[0-?]*[ -/]*[@-~]/g, "")
      // Other ESC-introduced sequences (OSC, charset selects, …): ESC + one byte.
      .replace(/\x1b[@-_A-Za-z]/g, "")
      // Any remaining control chars except \n (\x0A) and \t (\x09), including DEL.
      .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "")
  );
}

/** Filesystem-safe slug for default output filenames. */
function slug(name: string): string {
  return name.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "artifact";
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Display label: name plus a kind tag for non-skill artifacts. */
export function kindLabel(r: AuditResult): string {
  const t = r.artifact.type;
  return t === "skill" ? r.name : `${r.name} [${t === "subagent" ? "agent" : t}]`;
}

function writeArtifact(kind: "html" | "svg", opt: OptionalPath, name: string, content: string): string {
  const target = typeof opt === "string" ? opt : `${slug(name)}.beacon.${kind}`;
  const abs = resolve(target);
  writeFileSync(abs, content, "utf8");
  // Diagnostics go to stderr so `--markdown`/`--json` stdout stays a clean report.
  process.stderr.write(pc.dim(`  wrote ${kind.toUpperCase()} → ${abs}\n`));
  return target;
}

export interface SingleOutputOptions {
  markdown: boolean;
  html: OptionalPath;
  badge: OptionalPath;
  siteUrl: string;
  /** Precomputed `--suggest` proposals — rendered into the HTML scorecard when present. */
  suggestions?: readonly FixSuggestion[];
}

/** Emit one artifact's report (terminal or markdown) + any requested HTML/badge artifacts. */
export function emitSingle(result: AuditResult, opts: SingleOutputOptions): void {
  const { scorecard } = result;
  const name = kindLabel(result);
  const siteUrl = opts.siteUrl;
  if (opts.markdown) {
    process.stdout.write(`${renderMarkdown(scorecard, { name, siteUrl })}\n`);
  } else {
    process.stdout.write(`\n${renderTerminal(scorecard, { name, siteUrl })}\n`);
  }
  if (opts.html !== undefined) {
    writeArtifact(
      "html",
      opts.html,
      name,
      renderHtml(scorecard, {
        name,
        scannedAt: today(),
        homeUrl: siteUrl,
        siteUrl,
        ...(opts.suggestions ? { suggestions: opts.suggestions } : {}),
      }),
    );
  }
  if (opts.badge !== undefined) {
    const target = writeArtifact("svg", opts.badge, name, renderBadge(scorecard));
    // Emit the one copy-paste line an author needs — this is how the badge loop actually spreads.
    // To stderr so it never pollutes a redirected `--markdown`/`--json` report.
    const rel = target.startsWith(".") || target.startsWith("/") ? target : `./${target}`;
    process.stderr.write(pc.dim(`  embed it:  `) + `![Skill Crossroads](${rel})\n`);
    process.stderr.write(
      pc.dim(`  or an always-fresh, linked badge from ${siteUrl} once your repo is public:\n`) +
        pc.dim(`    ${badgeMarkdownLine(badgeUrls(siteUrl, "OWNER", "REPO"))}\n`),
    );
  }
}

/**
 * Print the `--suggest` section for a single artifact. Suggestions are PROPOSALS — this function
 * (and the CLI as a whole) never writes them anywhere; the human reviews and edits. Pass
 * `precomputed` when the suggestions were already generated (e.g. to embed them in `--html`)
 * so the model is not called twice. All model-derived text is sanitized before printing.
 */
export async function emitSuggestions(
  result: AuditResult,
  ctx: CheckContext,
  max: number,
  out: NodeJS.WriteStream,
  precomputed?: readonly FixSuggestion[],
): Promise<void> {
  const findings = result.scorecard.results.filter((r) => r.status !== "pass");
  if (findings.length === 0) {
    out.write(pc.dim("\n  clean scan — nothing to suggest\n"));
    return;
  }
  if (!ctx.model) {
    out.write(pc.yellow("\n  set ANTHROPIC_API_KEY to enable --suggest\n"));
    return;
  }
  const suggestions = precomputed ?? (await suggestFixes(result.artifact, result.scorecard, ctx, { max }));
  if (suggestions.length === 0) {
    out.write(pc.dim("\n  no suggestions produced for these findings\n"));
    return;
  }
  out.write(`\n${pc.bold("SUGGESTED FIXES")} ${pc.dim("(review before applying — nothing is written)")}\n`);
  for (const s of suggestions) {
    out.write(`\n  ${pc.bold(s.checkId)}  ${sanitizeText(s.summary)}\n`);
    if (s.current !== undefined || s.proposed !== undefined) {
      if (s.current !== undefined) {
        out.write(pc.dim("    current:\n"));
        for (const line of sanitizeText(s.current).split("\n")) out.write(pc.dim(`      ${line}\n`));
      }
      if (s.proposed !== undefined) {
        out.write(pc.green("    proposed:\n"));
        for (const line of sanitizeText(s.proposed).split("\n")) out.write(pc.green(`      ${line}\n`));
      }
    } else if (s.steps && s.steps.length > 0) {
      s.steps.forEach((step, i) => out.write(`    ${i + 1}. ${sanitizeText(step)}\n`));
    }
  }
}
