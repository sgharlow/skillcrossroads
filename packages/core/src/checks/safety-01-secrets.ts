import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Check, CheckResult, Evidence } from "../types.js";
import { entryRel } from "./util.js";

interface SecretPattern {
  readonly name: string;
  readonly re: RegExp;
}

/** High-signal secret patterns. Deterministic, no network. */
const PATTERNS: readonly SecretPattern[] = [
  { name: "Private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/ },
  { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Anthropic API key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "OpenAI API key", re: /\bsk-(?:proj-)?[A-Za-z0-9]{20,}/ },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "GitHub token", re: /\b(?:ghp|gho|ghu|ghs|ghr)_[0-9A-Za-z]{36}\b|\bgithub_pat_[0-9A-Za-z_]{22,}/ },
  { name: "Slack token", re: /\bxox[baprs]-[0-9A-Za-z-]{10,}/ },
  { name: "JWT", re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/ },
  {
    name: "Connection string with password",
    re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:/@]+:[^\s@]+@/,
  },
  {
    name: "Assigned credential literal",
    re: /\b(?:api[_-]?key|secret|token|password|passwd|pwd|access[_-]?key)\b\s*[:=]\s*["'][^"'\s]{8,}["']/i,
  },
  {
    // JSON-style assignments ("DB_PASSWORD": "…") — quoted keys and prefixed names (DB_, STRIPE_)
    // defeat the \b-anchored pattern above; .mcp.json env blocks are the classic case.
    name: "JSON credential assignment",
    re: /["'][A-Za-z0-9_-]*(?:api[_-]?key|secret|token|password|passwd|pwd|access[_-]?key)["']\s*:\s*["'][^"'\s]{8,}["']/i,
  },
];

/** Redact all but the first 4 and last 2 characters of a matched secret. */
function redact(match: string): string {
  const s = match.length > 80 ? `${match.slice(0, 40)}…` : match;
  if (s.length <= 8) return "*".repeat(s.length);
  return `${s.slice(0, 4)}${"*".repeat(Math.max(3, s.length - 6))}${s.slice(-2)}`;
}

function scanText(text: string, file: string): Evidence[] {
  const out: Evidence[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const { name, re } of PATTERNS) {
      const m = re.exec(line);
      if (m) {
        out.push({
          file,
          line: i + 1,
          snippet: redact(m[0]),
          verified: `matches ${name} pattern`,
          message: `Possible hardcoded secret (${name}) — ${redact(m[0])}`,
        });
        break; // one finding per line is enough
      }
    }
  });
  return out;
}

const MAX_FILE_BYTES = 1_000_000;

/** Read a supporting text file, returning null for missing / binary / oversized files. */
function readTextFile(path: string): string | null {
  try {
    const buf = readFileSync(path);
    if (buf.byteLength > MAX_FILE_BYTES) return null;
    if (buf.includes(0)) return null; // binary
    return buf.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * SAFETY-01 — No hardcoded secrets or keys.
 * Scans the SKILL.md and every supporting text file for private keys, cloud/API tokens, JWTs,
 * and credential-laden connection strings. Secrets are redacted in the evidence.
 */
export const safety01: Check = {
  id: "SAFETY-01",
  category: "safety",
  title: "No hardcoded secrets",
  weight: 1,
  run(artifact): CheckResult {
    const findings: Evidence[] = [];
    findings.push(...scanText(artifact.raw, entryRel(artifact)));

    for (const rel of artifact.files) {
      const content = readTextFile(join(artifact.root, rel));
      if (content !== null) findings.push(...scanText(content, rel));
    }

    // Honest coverage: on a rate-limited GitHub scan some text files were never downloaded, so a
    // "clean" result must not imply the whole skill was inspected.
    const unscanned = artifact.unscannedFiles ?? [];
    const coverageNote =
      unscanned.length > 0
        ? ` (${unscanned.length} text file${unscanned.length === 1 ? "" : "s"} not inspected — content not fetched; re-scan locally for full coverage)`
        : "";

    if (findings.length > 0) {
      return {
        id: this.id,
        category: this.category,
        title: this.title,
        weight: this.weight,
        status: "fail",
        score: 0,
        evidence: findings,
        fix: "Remove the secret from source, rotate it, and reference it via an environment variable instead.",
      };
    }

    return {
      id: this.id,
      category: this.category,
      title: this.title,
      weight: this.weight,
      status: "pass",
      score: 100,
      evidence: [{ file: entryRel(artifact), message: `No hardcoded secrets detected${coverageNote}.` }],
    };
  },
};
