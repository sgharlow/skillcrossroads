# NEXT — the 4 remaining human sends (staged 2026-07-16; everything else is shipped)

> Working checklist for the project's continuation. Tick boxes as sends complete; when all four
> are done and G0 has a verdict, this file's job is over — the ROADMAP's win/flat/zombie branch
> plan takes over. Repo state behind this: roadmap fully shipped, attribution live, daily
> readout task running (8:03am → %LOCALAPPDATA%\skillcrossroads\demand-daily.log), 3 listing
> PRs open (Composio #1366 · tonsofskills #1080 · jqueryscript #516).
> Done 7-16: Console.dev email sent · GitHub Sponsors enrolled · X post (no ?ref — use ?ref=x next time).
> Done 7-18: **Item 2 SUBMITTED** — awesome-claude-code issue [#2297](https://github.com/hesreallyhim/awesome-claude-code/issues/2297)
>   (Category=Linting set manually — URL prefill dropped it, as predicted; watch for their bot's
>   validation comment). **Item 3 staged** — platform.claude.com/plugins/submit form filled all 3
>   steps (name/repo/homepage/description/use-cases/Claude Code/MIT; no privacy URL — site has
>   none); **SUBMITTED 7-18** (pipeline: security scan → Anthropic review → nightly sync; verify
>   in days via `claude plugin install skillcrossroads@claude-community`).
> Done 7-18 (later): **/privacy LIVE-PROVEN** — PR #8 merged, prod probe 200 with content verified
>   (person-data policy; /docs/code-handling stays the code-data policy; footer + sitemap linked). Pre-flight for Item 1 refreshed in `g0-baseline.md`
>   (7-18 re-baseline + a /report badge-in-nav question to eyeball before posting).

Order: Items 2 and 3 anytime (no timing sensitivity). Item 1 on a weekday morning (post by
~2026-07-24). Item 4's daily.dev post goes the same day as the HN post; Changelog anytime.

---

## Item 1 — The G0 send (HN, then Reddit 1–2 days later)

### Pre-flight (morning of, ~5 min)
- [ ] Site check: open https://skillcrossroads.com/report — loads, badge in nav renders.
- [ ] Fresh baseline: from `apps/web` run
      `OWNER_LOGINS=sgharlow npm run report:demand` (DATABASE_URL comes from .env.local) and
      note the external-scan total.
- [ ] Open `docs/launch/send-checklist.md` (prepared replies to the 3 critiques) in a tab.
- [ ] Block 2–3 hours to stay in the thread after posting.

### Post to Hacker News (weekday, ideally before ~9am MST / noon ET)
- [ ] Go to https://news.ycombinator.com/submit (signed in).
- [ ] Title (recommended): `Show HN: I graded 214 public Claude Code skills – 73% may never trigger`
      (must start with "Show HN:").
- [ ] URL field: `https://skillcrossroads.com/report?ref=hn-show` (keep the ref tag).
- [ ] Text box: paste the body from `docs/launch/hn-show.md`.
- [ ] Submit ONCE. Never ask for upvotes; don't repost if it sinks.
- [ ] Stay present: answer every comment with evidence; link the relevant
      `https://skillcrossroads.com/docs/checks/<ID>` page when a finding is questioned.

### Immediately after the HN post (~5 min)
- [ ] Log the HN item URL in `docs/launch/g0-baseline.md` → "Post-send log".
- [ ] Add the line `LAUNCH_DATE=<today YYYY-MM-DD>` to `apps/web/.env.local`
      (the 8:03am daily-readout task reads it from there).
- [ ] Set it in prod (from `apps/web`):
      `printf '<today>' | vercel env add LAUNCH_DATE production`
      (printf, not echo; if the CLI balks, use the Vercel dashboard → Settings → Env Vars).
- [ ] Redeploy: `git commit --allow-empty -m "chore: redeploy for LAUNCH_DATE" && git push origin main`.

### Reddit (1–2 days after HN — this is the staggered second channel)
- [ ] Read r/ClaudeAI rules/sidebar first (flair? self-promo day?). Fallback sub: r/ClaudeCode.
- [ ] Text post; body from `docs/launch/reddit-claudeai.md` (links carry `?ref=reddit-claudeai`).
- [ ] Title (recommended): `43% of public Claude Code subagents inherit Bash by default — I scanned 85 of them`.
- [ ] Stay in-thread 2–3 hours; ~9:1 participate-to-promote ratio.

### Daily until verdict
- [ ] Check `%LOCALAPPDATA%\skillcrossroads\demand-daily.log` (auto-appends 8:03am) or run
      the readout manually. `/dashboard` shows the same panel.
- [ ] The MOMENT a pass condition lands (stranger scan / 25 readers + 3 scans / Team inquiry):
      record condition + timestamp + source in `g0-baseline.md`. That's the G0 pass evidence.

---

## Item 2 — awesome-claude-code (50.2k★) issue form (~1 min, do tonight)

- [ ] Click the prefilled link (top of `docs/launch/community-listings.md`) — it opens the
      "recommend resource" issue form with Display Name, Category=Linting, Link, Author, and
      Description already filled.
- [ ] Verify the Category dropdown actually shows **Linting** (dropdown prefills can silently
      fail — pick it manually if blank).
- [ ] Tick all 3 checkboxes (not on list / links live / Claude Code-specific — all true, verified).
- [ ] Submit. Their bot may comment on the issue (license check etc.) — no action needed unless
      it flags something.

## Item 3 — Anthropic official plugin directory (~2 min, do tonight)

- [ ] Go to https://clau.de/plugin-directory-submission (sign in with the Claude account).
- [ ] Plugin name: `skillcrossroads` · Repo: `https://github.com/sgharlow/skillcrossroads`
- [ ] Description — paste from `community-listings.md` §2 (the "Audit Claude Code artifacts
      from inside Claude Code…" block).
- [ ] Submit. Pipeline: automated security scan → Anthropic review → nightly sync.
- [ ] Verify later (days): `claude plugin install skillcrossroads@claude-community` succeeds,
      or the plugin appears on claude.com/plugins.

## Item 4 — Changelog News + daily.dev

### Changelog News — ✅ SUBMITTED 2026-07-18 (~6pm MT send window)
- [x] Submitted via https://changelog.com/news/submit with `?ref=changelog` URL + headline title
      + the corrected §1 blockquote (57% no-tools — the 43% draft error was caught and fixed
      pre-send, re-verified vs the live report). Queues for Monday's edition.
- They email only if published — no follow-up needed; `report:demand` will attribute any
  `changelog`-ref scans.

### daily.dev (~3 min, SAME DAY as the HN post)
- [ ] Sign in at app.daily.dev → **New Post** → link post.
- [ ] URL: `https://skillcrossroads.com/report?ref=dailydev`
- [ ] Title: the headline stat (`I graded 214 public Claude Code skills — 73% may never trigger`).
- [ ] Post into an AI/Claude-relevant Squad; answer any comments that day.

---

## After all four: nothing left but measurement
Listing PRs (#1366/#1080/#516) are maintainer-court — respond only if reviewers comment.
The ROADMAP's win/flat/zombie branch plan governs from the G0 verdict onward.
