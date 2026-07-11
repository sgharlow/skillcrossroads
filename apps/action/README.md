# Skill Crossroads — GitHub Action

Add a quality gate to your Claude Code skills in three lines. On every pull request, Skill Crossroads
grades the skills in your repo, **comments a scorecard**, and (optionally) **fails the build** if any
skill drops below a grade you choose.

## Quick start

Create `.github/workflows/crossroads.yml`:

```yaml
name: Skill Crossroads
on: pull_request
permissions:
  contents: read
  pull-requests: write   # needed to post the scorecard comment
jobs:
  crossroads:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: sgharlow/skillcrossroads/apps/action@v1
        with:
          path: ./skills      # a skill dir or a folder of skills
          min-grade: B        # fail the check if any skill is below B
```

That's it. Open a PR touching a skill and Skill Crossroads posts a scorecard comment and gates the build.

> **Note:** the action installs the published CLI `skillcrossroads` (`npx skillcrossroads@latest`) and is
> referenced as `sgharlow/skillcrossroads/apps/action@v1`. Internal workspace package names (`@beacon/core`)
> and `BEACON_*` env vars keep the original codename by design.

## Inputs

| Input | Default | Description |
|---|---|---|
| `path` | `.` | A skill directory or a folder of skills (every `SKILL.md` is scanned). |
| `min-grade` | `""` | Fail the build if any skill grades below this (e.g. `B`, `C-`). Empty = report only. |
| `comment` | `true` | Post/update a PR comment with the scorecard. |
| `anthropic-api-key` | `""` | Optional. Enables the LLM-assisted checks (triggering, verification, constraints). Pass a secret: `${{ secrets.ANTHROPIC_API_KEY }}`. |

## What it does

1. **Report** — grades every skill, subagent, slash command, `.mcp.json`, and plugin under `path`,
   writes the Markdown scorecard to the job summary, and (on PRs) posts it as a comment that
   updates in place on re-runs (no spam).
2. **Inline annotations** — every warn/fail lands as a `::warning`/`::error` at the exact
   file:line in the PR diff, with the fix attached.
3. **Grade delta vs base** — the comment includes a "Changes vs base" section (📈 `B → A−`,
   🆕 new, 🗑 removed, average movement), compared deterministic-vs-deterministic so LLM
   coverage differences never produce phantom deltas.
4. **Gate** — if `min-grade` is set, any artifact below the threshold exits non-zero and fails the check.

Deterministic checks run with no configuration. Provide `anthropic-api-key` to also score triggering
quality, verification, and constraint coverage.

## Notes

- The action installs the published CLI (`skillcrossroads@latest`), so it tracks the latest release.
- Commenting needs `pull-requests: write`. On fork PRs the token is read-only; the action logs and
  continues rather than failing.
