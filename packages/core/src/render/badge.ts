import type { Scorecard } from "../types.js";
import { gradeHex } from "./theme.js";

export interface BadgeOptions {
  /** Left-hand label. Default "crossroads". */
  label?: string;
  /** Override the right-hand value (defaults to the grade). */
  value?: string;
}

/** Escape the five XML special characters for safe SVG text content. */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Approximate rendered width of a string in ~11px Verdana. A per-character heuristic — good
 * enough for a badge without shipping a font-metrics table.
 */
function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    if (/[.,:;'!|il]/.test(ch)) w += 3.2;
    else if (/[fjtr ]/.test(ch)) w += 4.5;
    else if (/[A-Z]/.test(ch)) w += 8;
    else if (/[mwMW]/.test(ch)) w += 10;
    else w += 6.6;
  }
  return w;
}

/**
 * Render a self-contained flat SVG badge (`crossroads | A−`), colored by grade. Suitable for a
 * README (`![Crossroads](crossroads.svg)`) or a marketplace listing. This is the signpost — the
 * growth loop's viral primitive.
 */
export function renderBadge(card: Scorecard, opts: BadgeOptions = {}): string {
  const label = opts.label ?? "crossroads";
  // A partial grade (some rubric categories unscored — e.g. keyless/deterministic-only, where
  // Triggering & Verifiability don't run) is marked with a trailing "*" so the badge never implies
  // a full assessment. Honesty over vanity: a full grade needs an Anthropic key (or Pro).
  const value = opts.value ?? (card.partial ? `${card.grade}*` : card.grade);
  const color = gradeHex(card.grade);

  const PAD = 6;
  const H = 20;
  const labelW = Math.round(textWidth(label)) + PAD * 2;
  const valueW = Math.round(textWidth(value)) + PAD * 2;
  const totalW = labelW + valueW;
  const labelMid = labelW / 2;
  const valueMid = labelW + valueW / 2;

  const el = xmlEscape(label);
  const ev = xmlEscape(value);
  const aria = card.partial && !opts.value ? `${el}: ${ev} (partial grade — some categories not scored)` : `${el}: ${ev}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${H}" role="img" aria-label="${aria}">
  <title>${aria}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#FFF" stop-opacity=".12"/>
    <stop offset="1" stop-opacity=".12"/>
  </linearGradient>
  <clipPath id="r"><rect width="${totalW}" height="${H}" rx="3" fill="#FFF"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="${H}" fill="#12203A"/>
    <rect x="${labelW}" width="${valueW}" height="${H}" fill="${color}"/>
    <rect width="${totalW}" height="${H}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,DejaVu Sans,Geneva,sans-serif" font-size="11">
    <text x="${labelMid}" y="15" fill="#010101" fill-opacity=".3">${el}</text>
    <text x="${labelMid}" y="14">${el}</text>
    <text x="${valueMid}" y="15" fill="#010101" fill-opacity=".3">${ev}</text>
    <text x="${valueMid}" y="14" fill="#0B1220" font-weight="bold">${ev}</text>
  </g>
</svg>
`;
}
