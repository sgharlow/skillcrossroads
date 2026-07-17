# G0 pre-post baseline (captured 2026-07-16, before any launch post)

Captured per `send-checklist.md` → "run once *before* posting to capture the baseline."
Command: `OWNER_LOGINS=sgharlow DATABASE_URL=<prod> npm run report:demand` (from `apps/web`).

## Deploy state at capture

- main `d0e1631` (slices #2–#5 merged 2026-07-16: demand readout, `?ref`→`sc_ref` attribution,
  percentile badge + embed copy, launch assets). Live-verified in prod:
  `GET /?ref=x` sets `sc_ref` (Max-Age 1800, Secure, HttpOnly); `/api/health`, `/report`,
  `/report-agents`, `/gallery`, badge SVG all 200.
- Prod DB migrations applied at capture time: `scans.source` + `scans_source_idx`
  (`scripts/migrate-scan-source.mjs`) and `badge_serves` (`scripts/migrate-badge-serves.mjs`).
  NOTE: between the slice-#2 deploy and the migration there was a short window (~minutes) where
  the fire-and-forget scan INSERT would have failed silently; volume that day was ~5 scans, so
  worst-case loss is a handful of rows.

## Baseline readout (verbatim numbers)

```
G0 GATE: ○ PRE-LAUNCH  (no LAUNCH_DATE set)

External demand (owner logins excluded):
  external scans (all-time)    : 1445
  external scans (since launch): 0
  distinct external logins     : 0
  anonymous scans              : 1445  (cannot attribute stranger vs logged-out owner)
  distinct external repos      : 294

Leading indicators:
  badge serves (window)        : 1045
  badge repos via GitHub       : 5
  gallery opt-ins              : 31
  paid subscriptions           : 1   (owner dogfood)

Scans by source:
  unknown                      1445

Conversion (external-scanned repos → distribution):
  badge embedded (GitHub)      : 1/294
  gallery opt-in               : 31/294
```

## Reading the baseline honestly

- The 1,445 all-time "external" scans are **all anonymous and pre-attribution** — the heavy days
  (7-10: 161, 7-11: 594, 7-13: 172, 7-14: 428) line up with the owner's own State-of-Skills /
  State-of-Agents report regenerations (hundreds of batch scans each), not strangers. Treat
  all-time totals as noise; the gate math runs on **since-launch** numbers only.
- Once `LAUNCH_DATE` is set (the post date), "since launch" starts at 0 from this baseline, and
  new scans carry `source` (hn-show / reddit-claudeai) via the `sc_ref` cookie.

## Post-send log (fill in at send time)

- HN item URL: _
- Reddit permalink: _
- `LAUNCH_DATE` set to: _
- Winning signal (condition, timestamp, source): _
