import type { DemandMetric } from "./metric.js";
import { G0_UNMEASURED_ARMS, type G0Verdict, type G0Status } from "./g0-gate.js";

const LABEL: Record<G0Status, string> = {
  "pre-launch": "○ PRE-LAUNCH",
  "live-signal": "● LIVE SIGNAL",
  "pivot-warning": "▲ PIVOT WARNING",
  pivot: "✖ PIVOT",
  unknown: "? UNKNOWN",
};

/** Render the demand readout as plain text for the terminal (no color dependency required). */
export function formatDemandReadout(metric: DemandMetric, verdict: G0Verdict): string {
  const L: string[] = [];
  L.push(`G0 GATE: ${LABEL[verdict.status] ?? verdict.status}`);
  for (const r of verdict.reasons) L.push(`  - ${r}`);
  L.push("");
  // Only the measured pass arms carry the gate (PROJECT.yaml G0-launch `pass_arms`). Everything
  // below them is context, not evidence.
  L.push("Arms-length signal (owner's own repos and logins excluded) — measured G0 pass arms:");
  L.push(`  badge repos via GitHub    : ${metric.distinctBadgeReposFromGitHub}`);
  L.push(`  gallery opt-ins           : ${metric.galleryOptIns}`);
  L.push(`  not measured here         : ${G0_UNMEASURED_ARMS.join(", ")}`);
  L.push("");
  L.push("Context (NOT a G0 pass arm):");
  L.push(`  referred scans (since launch): ${metric.attributedExternalScansSinceLaunch}`);
  L.push(`  paid subscriptions        : ${metric.paidSubscriptions}`);
  L.push("");
  L.push("Volume (NOT evidence of demand — an unattributed scan may be the owner's own re-scan):");
  L.push(`  unattributed scans        : ${metric.unattributedScans}  (no ref, no cookie, no referer)`);
  L.push(`  external scans (all-time)   : ${metric.externalScansTotal}`);
  L.push(`  external scans (since launch): ${metric.externalScansSinceLaunch}`);
  L.push(`  distinct external logins  : ${metric.attributedExternalLogins}`);
  L.push(`  anonymous scans           : ${metric.anonymousScans}  (cannot attribute stranger vs logged-out owner)`);
  L.push(`  distinct external repos   : ${metric.distinctExternalRepos}`);
  L.push(`  badge serves (window)     : ${metric.badgeServesInWindow}`);
  if (metric.externalScansBySource.length) {
    L.push("");
    L.push("Scans by source:");
    for (const s of metric.externalScansBySource) L.push(`  ${s.source.padEnd(24)} ${s.count}`);
  }
  L.push("");
  L.push("Conversion (external-scanned repos → distribution):");
  L.push(`  badge embedded (GitHub) : ${metric.reposWithBadgeServe}/${metric.distinctExternalRepos}`);
  L.push(`  gallery opt-in          : ${metric.reposWithGalleryOptIn}/${metric.distinctExternalRepos}`);
  if (metric.dailyExternalTrend.length) {
    L.push("");
    L.push("Daily external scans:");
    for (const d of metric.dailyExternalTrend) {
      L.push(`  ${d.day}  ${"#".repeat(Math.min(40, d.count))} ${d.count}`);
    }
  }
  return L.join("\n");
}
