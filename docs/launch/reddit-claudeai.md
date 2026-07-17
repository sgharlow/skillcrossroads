# Reddit post — r/ClaudeAI (primary) or r/ClaudeCode

**Title:** I scanned 214 public Claude Code skills — 73% have descriptions that may never trigger

**Body (paste below):**

---

I built a grader for Claude Code artifacts and ran it against 214 public skills across 18 repos. The headline: 73% have a `description` that won't reliably trigger (43% outright unlikely to fire, 29% borderline). Only 27% (58 of 214) fire reliably.

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

- Average score was 73.6/100, a solid C.
- Grade spread: 1 A, 37 B, 113 C, 52 D, 11 F.
- 0 of 214 passed every check cleanly. Almost nobody documents constraints and failure modes (0%) or ships a verification step (2%).
- The one thing people nailed: secrets. Only 3 of 214 tripped the hardcoded-secret scan.

I ran a second scan on subagents and slash commands too (123 artifacts across 10 repos). Different surprise there: 57% of subagents declare no `tools` list, which silently inherits every tool including Bash. Writeup at /report-agents.

You can scan your own for free before you publish:

```
npx skillcrossroads ./my-skill
```

or paste it at skillcrossroads.com/paste?ref=reddit-claudeai. Deterministic checks run with no key; add an Anthropic key and it also runs the LLM triggering judge (the "will this actually fire?" check).

Two honest notes since someone will ask: the skills report ran an earlier rubric edition (v1.0, with the LLM check) while the live scanner runs v1.2, so today's grades differ. Both are labeled and reproducible, tree SHAs pinned. And yes, the rubric is strict; that's the point, and every finding cites the file and line so you can argue with it. It's open-core: the CLI and public scans are free, the hosted Pro tier is the paid part.

Report: skillcrossroads.com/report?ref=reddit-claudeai
Code: github.com/sgharlow/skillcrossroads
