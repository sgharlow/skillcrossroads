import { gradeHex } from "@beacon/core";
import type { ScanPoint } from "./scans";

const INK3 = "#1b2a42";
const FOG = "#8ca0bf";
const BEAM = "#ffc24b";

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Inline SVG line chart of overall score (0–100) over a scan history. Self-contained (no library,
 * no external assets). x is evenly spaced by scan index; dots are colored by that scan's grade.
 */
export function trendChartSvg(points: ScanPoint[], width = 680, height = 220): string {
  if (points.length === 0) return "";
  const padL = 34;
  const padR = 14;
  const padT = 14;
  const padB = 26;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const x = (i: number): number => (points.length === 1 ? padL + plotW / 2 : padL + (i / (points.length - 1)) * plotW);
  const y = (v: number): number => padT + (1 - Math.max(0, Math.min(100, v)) / 100) * plotH;

  // Gridlines + y labels at 0 / 50 / 100.
  const grid = [0, 50, 100]
    .map((v) => {
      const yy = y(v);
      return `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${width - padR}" y2="${yy.toFixed(1)}" stroke="${INK3}"/><text x="${padL - 6}" y="${(yy + 3).toFixed(1)}" text-anchor="end" fill="${FOG}" font-size="10">${v}</text>`;
    })
    .join("");

  const line =
    points.length > 1
      ? `<polyline fill="none" stroke="${BEAM}" stroke-width="2" points="${points.map((p, i) => `${x(i).toFixed(1)},${y(p.overall).toFixed(1)}`).join(" ")}"/>`
      : "";

  const dots = points
    .map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.overall).toFixed(1)}" r="3.5" fill="${gradeHex(p.grade)}"><title>${esc(p.grade)} · ${p.overall} · ${esc(p.scannedAt.slice(0, 10))}</title></circle>`)
    .join("");

  const first = esc(points[0]!.scannedAt.slice(0, 10));
  const last = esc(points[points.length - 1]!.scannedAt.slice(0, 10));
  const xLabels =
    points.length > 1
      ? `<text x="${padL}" y="${height - 6}" fill="${FOG}" font-size="10">${first}</text><text x="${width - padR}" y="${height - 6}" text-anchor="end" fill="${FOG}" font-size="10">${last}</text>`
      : `<text x="${(padL + plotW / 2).toFixed(1)}" y="${height - 6}" text-anchor="middle" fill="${FOG}" font-size="10">${first}</text>`;

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Score trend" font-family="ui-monospace,Menlo,Consolas,monospace">${grid}${line}${dots}${xLabels}</svg>`;
}
