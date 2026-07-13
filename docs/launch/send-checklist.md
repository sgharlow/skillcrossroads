# Launch send runbook (Gate G0)

The two posts are written and ready to paste:
- `docs/launch/hn-show.md` — Show HN text post
- `docs/launch/reddit-claudeai.md` — r/ClaudeAI post

This runbook covers where to post, titles, timing, the pass/fail gate, what to watch, and prepared replies to the three critiques you'll get. Human-send by design — nothing here auto-posts.

---

## Where to post (pick 1–2 communities)

The gate calls for "1–2 developer communities." Recommended pairing:

1. **Hacker News — Show HN.** Submit at https://news.ycombinator.com/submit with the title from `hn-show.md`, URL field `https://skillcrossroads.com/report`, and the text body pasted into the text box. (Show HN can have both a URL and text.)
2. **Reddit — r/ClaudeAI** (primary; largest Claude audience) or **r/ClaudeCode** (more tool-focused, smaller). Post the `reddit-claudeai.md` body as a text post. Do not cross-post the identical body to both subreddits the same day — pick one; if the first gets no traction, the second is your fail-threshold "second launch post."

Read each community's self-promotion rules before posting. Reddit: participate in the thread, answer comments, don't drop-and-run. HN: no upvote solicitation, no reposting if it flops the first time.

## Suggested titles (pick one per channel)

**Hacker News (Show HN — must start with "Show HN:"):**
- Show HN: Skill Crossroads – evidence-cited grades for Claude Code skills, agents, and plugins
- Show HN: I graded 214 public Claude Code skills – 73% may never trigger
- Show HN: A linter for Claude Code skills, subagents, and plugins (with file:line evidence)

**Reddit:**
- I scanned 214 public Claude Code skills — 73% have descriptions that may never trigger
- I graded 214 public Claude Code skills and 85 subagents/commands — here's what breaks
- 43% of public Claude Code subagents inherit Bash by default — I scanned 85 of them

(For a subagent-security angle on either channel, lead with the third Reddit title — the 43%-inherits-Bash stat is the strongest hook.)

## Timing (best practice)

- **Hacker News:** weekday morning US Eastern, roughly 7–10am ET, is when Show HN posts get the most eyes on the /newest queue. Avoid Friday afternoon and weekends (lower traffic). Post once; do not repost the same day if it sinks.
- **Reddit:** weekday mid-morning to early afternoon US time skews toward the US/EU dev audience. Post when you can stay available for the next 2–3 hours to answer comments (early engagement drives the ranking).
- Stagger the two channels by a day or two so you can field comments on each without splitting your attention. Treat the second post as the "second launch post" the fail threshold references.

---

## Gate G0 — pass/fail criteria (verbatim from ROADMAP.md)

> ## Gate G0 — the launch (owner: Steve, target: within 14 days of this doc)
>
> The channel test that everything downstream depends on: post the
> [State of Claude Code Skills report](https://skillcrossroads.com/report) to 1–2 developer
> communities (human-send by design).
>
> - **Pass (any one, within 14 days of the post):** ≥1 stranger-initiated scan (gallery opt-in,
>   badge embed in an external repo, or Action install), OR ≥25 unique `/report` readers with ≥3
>   site scans, OR ≥1 Team-tier inquiry email.
> - **Fail / pivot threshold:** two launch posts + 4 weeks → zero external scans ⇒ **stop feature
>   work entirely**; the problem is channel or positioning, not product. Distribution experiments
>   only until a signal exists.

The 14-day clock started **2026-07-10**.

## What to monitor after posting

Map each pass condition to where you actually see it:

- **`/report` reader count (need ≥25 unique for that pass path):** Vercel Analytics → filter to the `/report` and `/report-agents` routes → unique visitors since the post.
- **Site scans (need ≥3 for the readers-path pass):** `/dashboard` — watch total scans and recent-scans list for a delta above your own dogfooding baseline. Note the baseline number *before* you post so the delta is real.
- **Stranger-initiated scan (any one satisfies the gate):**
  - **Gallery opt-in** — a new skill you didn't add appears on `/gallery`.
  - **External badge embed** — a badge served for an `owner/repo` that isn't yours. Watch `/api/badge/...` hits in Vercel Analytics / logs.
  - **Action install** — a run of the GitHub Action from an external repo.
- **Badge serves** — confirm `/api/badge/<owner>/<repo>.svg` is returning 200s and rendering (a cold-badge render can outlast GitHub's camo timeout; if a linked badge looks broken in a thread, re-scan to warm it).
- **Team-tier inquiry email (any one satisfies the gate):** watch the inbox behind the pricing-page `mailto:` for a Team/Pro inquiry.

Record the winning signal (which condition, timestamp, source) the moment it lands — that's the G0 pass evidence.

---

## Prepared replies to the three critiques

Keep these short and honest. Paste and lightly edit to fit the specific comment.

**1. "The grade distributions differ between the two reports / from what I get scanning today."**
> Correct, and it's labeled. The skills report ran rubric v1.0 with the LLM triggering check; the agents report and the live scanner run v1.2 deterministic. Each report pins its edition, the git tree SHAs, and the reproduction command, so the numbers are exact for the trees and rubric named. Re-scanning the same repos today gives different (generally higher) deterministic figures because later rubrics add checks — the reports are pinned snapshots, not live dashboards.

**2. "You invented a rubric nobody passes."**
> Strictness is the point — the goal is to catch the stuff that makes a good skill look broken in someone else's session, before you publish. The checks map to Anthropic's own skill-authoring guidance: triggering descriptions, the line/token budget, least-privilege tool grants, verification steps. And every finding carries file:line evidence, so it's arguable — if a check is wrong on your artifact, you can see exactly why it fired and suppress it with a reason.

**3. "That's a small / self-serving sample."**
> Fair to ask. It's 214 skills across 18 public repos, and 85 agents/commands across 9 — a deliberately mixed sample (Anthropic's own catalog plus community repos), not a curated best-of. The per-repo caps are disclosed, the trees are pinned, and you can re-run the exact scan on any repos you want, including your own: `npx skillcrossroads owner/repo`. If the sample's biased, the reproduction command lets anyone show it.

---

## Post-send

- Log the post URLs (HN item, Reddit permalink) and the pre-post `/dashboard` baseline in the G0 baseline doc.
- Stay in the thread for the first few hours; answer with evidence, link the relevant check's `/docs/checks` page when someone questions a finding.
- If both posts + 4 weeks yield zero external scans, that's the fail/pivot threshold — stop feature work, treat it as a channel/positioning problem.
