# Reddit post — r/ClaudeAI (primary) or r/ClaudeCode

**Title:** I scanned 216 public Claude Code skills — 69% have descriptions that may never trigger

**Body (paste below):**

---

I built a grader for Claude Code artifacts and ran it against 216 public skills across 18 repos. The headline: 69% have a `description` that won't reliably trigger (40% outright unlikely to fire, 28% borderline). Only 31% (67 of the 215 it could score) fire reliably.

That matters because "my skill never fires" is the #1 real-world skill failure, and it lives entirely in one line of frontmatter. Claude decides whether to load your skill by matching the request against your `description`. If that field reads like a title instead of "use this when…", the model never picks it, no matter how good the body is.

The failing pattern is a description that reads like a title, buries the use case, and skips the natural-language phrases a user would actually type. An illustrative example (not a quote from anyone's repo):

```yaml
# won't trigger reliably
description: PDF utilities
```

```yaml
# triggers — names the task and the words a user would type
description: Extract text and tables from PDF files. Use when the user
  wants to read, parse, convert, or pull data out of a PDF or scanned document.
```

Same skill, completely different discoverability.

A few more numbers from the scan:

- Average score was 82.1/100, a B−.
- Grade spread: 7 A, 156 B, 45 C, 2 D, 6 F.
- 1 of 216 passed every check cleanly. Almost nobody documents constraints and failure modes (0%) or ships a verification step (3%).
- People mostly nailed secrets: only 6 of 216 tripped the hardcoded-secret scan.

I ran a second scan on subagents and slash commands too (123 artifacts across 10 repos). Different surprise there: 57% of subagents declare no `tools` list, which silently inherits every tool including Bash. Writeup at /report-agents.

You can scan your own for free before you publish:

```
npx skillcrossroads ./my-skill
```

or paste it at skillcrossroads.com/paste?ref=reddit-claudeai. Deterministic checks run with no key; add an Anthropic key and it also runs the LLM triggering judge (the "will this actually fire?" check).

Two honest notes since someone will ask: both reports are pinned snapshots (skills on rubric v1.2 with the LLM checks, agents on v1.2 deterministic-only), so scanning the same repos today can give different grades. Both are labeled and reproducible, tree SHAs pinned. And yes, the rubric is strict; that's the point, and every finding cites the file and line so you can argue with it. It's open-core: the CLI and public scans are free, the hosted Pro tier is the paid part.

Report: skillcrossroads.com/report?ref=reddit-claudeai
Code: github.com/sgharlow/skillcrossroads
