import type { DemandMetric } from "./metric.js";
import type { G0Verdict } from "./g0-gate.js";

const LABEL: Record<string, string> = {
  "pre-launch": "○ PRE-LAUNCH",
  "live-signal": "● LIVE SIGNAL",
  "pivot-warning": "▲ PIVOT WARNING",
  pivot: "✖ PIVOT",
};

/** Render the demand readout as plain text for the terminal (no color dependency required). */
export function formatDemandReadout(metric: DemandMetric, verdict: G0Verdict): string {
  const L: string[] = [];
  L.push(`G0 GATE: ${LABEL[verdict.status] ?? verdict.status}`);
  for (const r of verdict.reasons) L.push(`  - ${r}`);
  L.push("");
  L.push("External demand (owner logins excluded):");
  L.push(`  external scans (all-time)   : ${metric.externalScansTotal}`);
  L.push(`  external scans (since launch): ${metric.externalScansSinceLaunch}`);
  L.push(`  distinct external logins  : ${metric.attributedExternalLogins}`);
  L.push(`  anonymous scans           : ${metric.anonymousScans}  (cannot attribute stranger vs logged-out owner)`);
  L.push(`  distinct external repos   : ${metric.distinctExternalRepos}`);
  L.push("");
  L.push("Leading indicators:");
  L.push(`  badge serves (window)     : ${metric.badgeServesInWindow}`);
  L.push(`  badge repos via GitHub    : ${metric.distinctBadgeReposFromGitHub}`);
  L.push(`  gallery opt-ins           : ${metric.galleryOptIns}`);
  L.push(`  paid subscriptions        : ${metric.paidSubscriptions}`);
  if (metric.dailyExternalTrend.length) {
    L.push("");
    L.push("Daily external scans:");
    for (const d of metric.dailyExternalTrend) {
      L.push(`  ${d.day}  ${"#".repeat(Math.min(40, d.count))} ${d.count}`);
    }
  }
  return L.join("\n");
}
