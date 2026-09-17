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
  ⚠️ **This did NOT hold for the actual 2026-09-17 launch** — the post went out on the bare apex
  with no `?ref`, so no HN scan carries a `source`. See "FINDING 2026-09-17" below before reading
  any since-launch or by-source number for this window.

## Post-send: exact commands (run the moment the first post is live)

`LAUNCH_DATE` is read from `process.env` by BOTH the local readout and the live `/dashboard`
panel, so set it in two places (replace the date with the actual post date):

```bash
# 1. Vercel production env (from the REPO ROOT — the link lives there, rootDirectory apps/web;
#    running from apps/web says "not linked". Corrected by the 2026-09-13 dry run.)
#    NOTE: pipe with printf, NOT echo, and non-TTY `env add` is broken on Vercel CLI 51.8+ —
#    if this fails, use the dashboard (Settings → Environment Variables) instead.
printf '2026-07-17' | npx vercel@latest env add LAUNCH_DATE production   # from the repo root

# 2. Redeploy so the env takes effect (git-native redeploy):
git commit --allow-empty -m "chore: redeploy for LAUNCH_DATE" && git push origin main

# 3. Daily readout (LAUNCH_DATE inline; DATABASE_URL is in apps/web/.env.local):
OWNER_LOGINS=sgharlow LAUNCH_DATE=2026-07-17 npm run report:demand
```

## Refresh 2026-07-18 (pre-send re-baseline, same command)

External scans all-time 1958 (Δ+513 since 7-16 — 7-17: 405 and 7-18: 111 line up with the
owner's QA/polish scan batches, still all `source: unknown`, 0 attributed); distinct external
repos 294 (unchanged); badge serves 1115; gallery opt-ins 31; paid subs 1 (owner). Gate math
still runs on since-launch only — unchanged conclusion.

Pre-flight note 7-18 (RESOLVED): `/report` loads live (200, headline intact); the homepage hero
badge renders (A−). The send-checklist's "badge in nav renders" was imprecise — `SiteNav.tsx`
only renders the Signpost logo glyph by design; there is no nav badge and never was. No
regression; pre-flight is green.

## Re-baseline 2026-08-23 (pre-send, 36 days after the last refresh)

Command that actually works: `pwsh -File apps/web/scripts/demand-daily.ps1`, or export
`DATABASE_URL` from `.env.local` before `npm run report:demand`. The command previously
documented in `next.md` (bare `npm run report:demand`) exits 2 — `demand-readout.mjs` reads
`process.env` only; the PS1 wrapper is what parses `.env.local`. Corrected in `next.md` today.

```
external scans (all-time)    : 11486      (7-18: 1958  →  Δ +9,528)
external scans (since launch): 0
distinct external logins     : 0
anonymous scans              : 11486
distinct external repos      : 302        (7-18: 294)
badge serves (window)        : 1834       (7-18: 1115)
badge repos via GitHub       : 7          (7-18: 5)
gallery opt-ins              : 31         (unchanged since 7-16)
paid subscriptions           : 0          (7-16 baseline: 1, owner dogfood)
scans by source              : unknown 11184 · google.com 295 · skillget.dev 6 · search.yahoo.co.jp 1
```

**Attribution audited directly against the prod DB today — every leading indicator is
self-generated.** The 7-16 baseline already called the all-time scan total noise; this pass
checked the two indicators it did NOT qualify, and they are noise too:

- **Gallery opt-ins 31 = 0 external.** `SELECT owner, count(*) FROM gallery_entries GROUP BY owner`
  → `anthropics` 21 (seeded 7-09..7-13), `sgharlow` 10 (7-11). No third owner has ever appeared.
- **Badge repos via GitHub 7 = 0 external.** All seven slugs are `sgharlow/*`
  (claude-code-recipes 826 serves, orchestra-lite 16, skillcrossroads 12, scripture-sleuth 10,
  ai-matcher-aws-hackathon 8, mdlink-check 5, comment-conspiracy 4).
- **Scans:** 10,107 of 11,486 are on non-`sgharlow` slugs, but they are the *report corpus*
  (anthropics/skills, qdhenry/Claude-Command-Suite, iSerter/laravel-claude-agents …) at ~38
  scans per repo evenly across 302 repos — the signature of repeated owner-run corpus sweeps,
  not strangers scanning their own work. `distinct external logins: 0` all-time.

`PROJECT.yaml demand_signal: none` is therefore **correct and unchanged**. The readout's
"Leading indicators" heading is what misleads: it prints 31 and 7 with no disclosure that both
are 100% owner-seeded. Worth a one-line label in `packages/core/src/demand/format.ts` before
anyone reads those figures as traction. This is the same failure shape as the report-bridge
launch watch that reported "8 REAL signups" that were all rehearsals.

**Change worth noting:** `paid subscriptions` went 1 → 0 since the 7-16 baseline. The owner
dogfood subscription is no longer active, so `ladder: dogfooded` now rests on the 2026-07-10
event with no currently-live subscription behind it. Not diagnosed here — flagged only.

## FINDING 2026-09-17 — the launch post is UNTAGGED: the gate's measuring instrument is blind to its own launch

**Status: not fixable retroactively.** This is a first-class defect in the G0 measurement method,
not a footnote. Read it before reading any number out of the 14-day window.

### What was supposed to happen

The prepared draft (`docs/launch/hn-show.md`) put `?ref=hn-show` on the posted URL. The chain
built for exactly this gate (slice #2, main `d0e1631`, described at the top of this file) is:

`https://skillcrossroads.com/report?ref=hn-show` → `apps/web/middleware.ts` sets the `sc_ref`
cookie (30 min, HttpOnly, matcher covers `/`, `/report`, `/report-agents`, `/paste`, `/gallery`,
`/pricing`) → the visitor runs a scan in the same session → `apps/web/lib/attribution.ts`
`scanSource()` reads the cookie → `scans.source = 'hn-show'` → the row counts in
`attributedExternalScansSinceLaunch` (`packages/core/src/demand/metric.ts`), which is one of the
four signals `evaluateG0` (`packages/core/src/demand/g0-gate.ts`) can pass the gate on, and it is
the one that prints as `hn-show` under "Scans by source" in `report:demand`.

### What actually happened

The post went up with the **bare apex `https://skillcrossroads.com`** — no `?ref`.
HN item 49744398, 2026-09-17T18:06:26Z. No query param means the middleware sets no cookie; a
scan run afterwards is a same-origin request (`/` → `/s/owner/repo`), so `externalRefererHost()`
returns null and `normalizeSource()` returns null. Every HN arrival lands in `scans.source IS NULL`.

Verified against prod at 2026-09-17T21:1xZ, read-only: **534 scan rows since 18:06:26Z, 100% of
them `source = NULL`, zero tagged anything.** (The 534 is itself the noise problem below.)

### Consequence for reading the 14-day window (posted_on 2026-09-17 → due 2026-10-01)

- `attributedExternalScansSinceLaunch` will stay **0 for the whole window** regardless of how many
  strangers arrive from HN. That signal path in `evaluateG0` is dead for this launch. If it ever
  goes non-zero it means some *other* channel, not HN.
- HN scans land in the `unknown` bucket, which already holds >11,000 rows of the owner's own corpus
  sweeps (see the 2026-08-23 re-baseline) and grew by 534 in the first three hours after the post.
  A stranger's scan is **not separable from owner noise by volume** — do not read a bump in
  "scans by source: unknown" as traction. This is the same trap the 2026-08-23 audit called out.
- The gate's **primary pass path is unaffected**: a stranger-initiated gallery opt-in, an external
  badge embed, an Action install, or a Team-tier inquiry is identified by *actor / repo owner*
  (`galleryOptIns`, `distinctBadgeReposFromGitHub` in `metric.ts`), never by `source`. G0 can still
  be passed honestly. It is only the referred-scan evidence that is lost.

### Fallback measure (investigated, live-proven — it is real, and it is partial)

**Vercel Web Analytics `referrerHostname`.** `@vercel/analytics/next` is mounted in
`apps/web/app/layout.tsx`, and it records the landing referrer per pageview independently of the
`?ref` chain. Proven against the live project on 2026-09-17 (read-only query, day window):

```
referrerHostname          visitors  pageviews
(direct/empty)                  10         10
google.com                       6          6
news.ycombinator.com             3          3       <-- the HN arrivals, separable
...
```

Filtering `referrerHostname eq 'news.ycombinator.com'` and grouping by `route` works too — on
2026-09-17 all 3 HN visitors were on route `/` and none had reached `/report`.

What the fallback **can** answer: unique HN-referred visitors, and which routes they landed on —
which is exactly the input to the gate's second pass path (">= 25 unique /report readers"), and
which `send-checklist.md` already nominates as the source for that count.

What the fallback **cannot** answer: it counts *readers*, not *scans*. There is no way to tie a
scan row back to an HN visitor, so the "with >= 3 site scans" half of that pass path can only be
read site-wide, against the owner-noise floor described above. Nothing in the code can recover
per-visitor scan attribution for an untagged landing.

Two operational caveats: the numbers live **only in the Vercel dashboard** — `report:demand` does
not read them, so they must be pulled and written into this file by hand during the window; and
Vercel Analytics retention is bounded, so pull them before `due` (2026-10-01), not after.

**Secondary, narrow:** `HOST_TAGS` in `packages/core/src/demand/source.ts` maps
`news.ycombinator.com` → `hn`, so a scan request that *itself* carries an HN Referer **is** tagged
`hn` in the DB. That only fires for a deep link into the site posted in the thread (e.g. a
`/s/owner/repo` URL in a comment) — not for the normal land-on-apex-then-scan path. With 0 comments
on the thread it has fired 0 times. Any link posted in the thread from here on should carry
`?ref=hn-show` anyway, which restores full attribution for that link.

### Divergence from `docs/launch/hn-show.md` (recorded, not a defect)

| | Prepared (`hn-show.md`) | Actually posted |
|---|---|---|
| Title | `Show HN: I graded 216 public Claude Code skills – 69% may never trigger` | `Show HN: Linting 216 public Claude Code skills – 69% won't reliably trigger` |
| URL field | `https://skillcrossroads.com/report?ref=hn-show` | `https://skillcrossroads.com` (bare apex) |
| Time | planned "Thu 9-17 06:00" (`PROJECT.yaml`, re-dated 9-16) | 2026-09-17T18:06:26Z |

The title change is a copy decision and carries no measurement consequence. The URL change is the
finding above. The posting time matches neither reading of "06:00" (neither 06:00Z nor 06:00 local),
so treat the planned send-window guidance in `send-checklist.md` as not followed for this post.

## Post-send log (filled 2026-09-17, ~3h after the post)

- HN item URL: `https://news.ycombinator.com/item?id=49744398` — posted 2026-09-17T18:06:26Z by
  `sgharlow`, title `Show HN: Linting 216 public Claude Code skills – 69% won't reliably trigger`,
  URL field = bare apex `https://skillcrossroads.com` (see the FINDING above).
  Traction at 2026-09-17T21:03Z: **1 point, 0 comments.**
- Reddit permalink: **not posted.** HN was the only channel used on 2026-09-17. Verification: no
  permalink is recorded anywhere in this repo, no commit or doc references a submission, the
  `reddit-claudeai.md` draft is unsent, and a `site:reddit.com skillcrossroads` web search returns
  no matching submission. (Reddit's own JSON API returns 403 to a server-side fetch, so this is a
  web-index + repo-evidence check, not a Reddit-API check.) That also means the kill clause's
  "2 launch posts" condition still stands at **1**.
- `LAUNCH_DATE` set to: `2026-09-17` — present in `apps/web/.env.local`; claimed set in Vercel
  production (not re-verified against the Vercel env in this pass).
- Winning signal (condition, timestamp, source): **none yet** — window open 2026-09-17 →
  2026-10-01. Not recomputed in this pass; the last full arms-length readout is the 2026-09-09
  audit recorded in `PROJECT.yaml` (0 badge / 0 gallery / 0 referred scans / 0 paid). Re-run
  `pwsh -File apps/web/scripts/demand-daily.ps1` for a current figure rather than quoting that one.
