# Show HN post

**Title:** Show HN: Skill Crossroads – evidence-cited grades for Claude Code skills, agents, and plugins

**URL field:** https://skillcrossroads.com/report?ref=hn-show

**Text field (paste below):**

---

I built a linter for Claude Code artifacts (skills, subagents, slash commands, .mcp.json configs, and plugins) and then pointed it at a pile of public repos to see what people actually ship. A few of the numbers surprised me enough that I wrote them up.

The one that stuck: across 87 public subagents, 57% (50 of 87) declare no `tools` list at all. That reads like a safe default, but it's the opposite. A subagent with no `tools` inherits the caller's entire toolbox, Bash included. Permission prompts still gate execution, but a worker you meant to "just read code" now carries the grant surface to run shell — the opposite of least-privilege. Add 16 more that grant bare `Bash` and 8 that grant a wildcard, and 85% of the sample isn't least-privilege.

Other findings from the two scans:

- Of 214 public skills, 73% have a `description` that won't reliably trigger (43% outright unlikely to fire, 29% borderline). "My skill never fires" is the #1 real-world failure, and it hides in one frontmatter line.
- 83% of subagents (72 of 87) lack invocation cues ("use when…") in their description.
- 0 of 214 skills, and 0 of 87 subagents, pass every check cleanly. Secrets were the one thing almost everyone got right: only 3 of 214 skills tripped the scanner.

How it works: mostly pure, deterministic checks that emit file:line evidence ("SKILL.md:14 links ./references/converter.md, not found"). An optional LLM check (bring your own key) judges whether a description will actually trigger. The CLI is free (`npx skillcrossroads ./my-skill`), there's a GitHub Action that gates PRs, and it's open-core: the public audits are free, money is a hosted Pro tier.

Honest limits: the two reports ran different rubric editions (skills on v1.0 with the LLM check, agents on v1.2 deterministic-only), both labeled, tree SHAs pinned, reproduction commands published. The rubric is strict on purpose; the checks map to Anthropic's own skill-authoring guidance, and every finding carries evidence you can check. The sample is 214 skills across 18 repos and 123 agents/commands (87 subagents + 36 commands) across 10 repos, caps disclosed, and you can re-run it on your own repos.

Reports: https://skillcrossroads.com/report?ref=hn-show and https://skillcrossroads.com/report-agents?ref=hn-show
Code: https://github.com/sgharlow/skillcrossroads
