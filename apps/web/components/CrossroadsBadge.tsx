/**
 * CrossroadsBadge — the signpost. A self-contained, embeddable inline-SVG pill that reads
 * "skill crossroads : <grade>", color-banded by direction: A/B green (ship), C/D amber (fix), F red
 * (rethink). Colors are hard-coded (not CSS vars) so the SVG renders identically when embedded via
 * <img> in a README, outside this site's stylesheet.
 */
import type { ReactElement } from "react";

type Direction = "ship" | "fix" | "rethink";

const DIRECTION_COLOR: Record<Direction, string> = {
  ship: "#2ea043",
  fix: "#cf8a12",
  rethink: "#df4247",
};

/** Map a letter grade (A+, B−, C, E, F…) to its direction band by first letter. */
export function directionForGrade(grade: string): Direction {
  const g = grade.trim().charAt(0).toUpperCase();
  if (g === "A" || g === "B") return "ship";
  if (g === "C" || g === "D") return "fix";
  return "rethink"; // E, F (and anything unknown → treat as needs-rethink)
}

/** Rough rendered width of a string in ~11px Verdana — enough to size a badge without a metrics table. */
function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    if (/[.,:;'!|il]/.test(ch)) w += 3.1;
    else if (/[A-Z0-9]/.test(ch)) w += 7.2;
    else if (/[mw]/.test(ch)) w += 9.5;
    else w += 6.3;
  }
  return w;
}

export interface CrossroadsBadgeProps {
  grade: string;
  /** Left-hand label. Defaults to "skill crossroads". */
  label?: string;
  /** Optional link — the growth loop: a badge that clicks through to the full scorecard. */
  href?: string;
  height?: number;
}

export function CrossroadsBadge({
  grade,
  label = "skill crossroads",
  href,
  height = 22,
}: CrossroadsBadgeProps): ReactElement {
  const dir = directionForGrade(grade);
  const color = DIRECTION_COLOR[dir];
  const PAD = 9;
  const MARK = 16; // room for the signpost glyph in the left segment
  const labelW = Math.round(textWidth(label)) + PAD * 2 + MARK;
  const valueW = Math.round(textWidth(grade)) + PAD * 2;
  const w = labelW + valueW;
  const h = height;
  const fs = 11;
  const labelMid = (MARK + labelW) / 2;
  const valueMid = labelW + valueW / 2;
  const aria = `Skill Crossroads grade ${grade} — direction: ${dir}`;

  const svg = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={aria}
    >
      <title>{aria}</title>
      <clipPath id="cr-clip">
        <rect width={w} height={h} rx="4" />
      </clipPath>
      <g clipPath="url(#cr-clip)" fontFamily="Verdana,DejaVu Sans,Geneva,sans-serif" fontSize={fs}>
        <rect width={labelW} height={h} fill="#20293a" />
        <rect x={labelW} width={valueW} height={h} fill={color} />
        {/* signpost glyph: a post with a directional arrow-plate */}
        <g transform={`translate(7 ${h / 2})`} stroke="#cdd6e6" strokeWidth="1.5" fill="none">
          <line x1="0" y1="-6" x2="0" y2="6" />
          <path d="M-0.5 -4 H6 L8 -2 L6 0 H-0.5 Z" fill="#cdd6e6" stroke="none" />
        </g>
        <text x={labelMid} y={h / 2 + 4} fill="#e8eef7" textAnchor="middle">
          {label}
        </text>
        <text
          x={valueMid}
          y={h / 2 + 4}
          fill="#0b1a10"
          fontWeight="bold"
          textAnchor="middle"
        >
          {grade}
        </text>
      </g>
    </svg>
  );

  if (href) {
    return (
      <a href={href} style={{ display: "inline-block", lineHeight: 0 }} aria-label={aria}>
        {svg}
      </a>
    );
  }
  return svg;
}

/** The Skill Crossroads mark — a minimal signpost, for nav/footer. Inherits currentColor. */
export function Signpost({ size = 22 }: { size?: number }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="Skill Crossroads"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="3" x2="12" y2="21" />
      <path d="M12 6 H18 L20.5 8.25 L18 10.5 H12 Z" fill="currentColor" stroke="none" />
      <path d="M12 12 H6 L3.5 14.25 L6 16.5 H12 Z" fill="currentColor" stroke="none" opacity="0.55" />
    </svg>
  );
}
