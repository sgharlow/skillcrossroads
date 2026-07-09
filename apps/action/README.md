# Beacon — GitHub Action

Add a quality gate to your Claude Code skills in three lines. On every pull request, Beacon grades
the skills in your repo, **comments a scorecard**, and (optionally) **fails the build** if any skill
drops below a grade you choose.

## Quick start

Create `.github/workflows/beacon.yml`:

```yaml
name: Beacon
on: pull_request
permissions:
  contents: read
  pull-requests: write   # needed to post the scorecard comment
jobs:
  beacon:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: sgharlow/beacon/apps/action@v1
        with:
          path: ./skills      # a skill dir or a folder of skills
          min-grade: B        # fail the check if any skill is below B
```

That's it. Open a PR touching a skill and Beacon posts a scorecard comment and gates the build.

## Inputs

| Input | Default | Description |
|---|---|---|
| `path` | `.` | A skill directory or a folder of skills (every `SKILL.md` is scanned). |
| `min-grade` | `""` | Fail the build if any skill grades below this (e.g. `B`, `C-`). Empty = report only. |
| `comment` | `true` | Post/update a PR comment with the scorecard. |
| `anthropic-api-key` | `""` | Optional. Enables the LLM-assisted checks (triggering, verification, constraints). Pass a secret: `${{ secrets.ANTHROPIC_API_KEY }}`. |

## What it does

1. **Report** — runs `beacon <path> --markdown`, writes it to the job summary, and (on PRs) posts it
   as a comment that updates in place on re-runs (no spam).
2. **Gate** — if `min-grade` is set, runs `beacon <path> --min-grade <grade>`; a below-threshold
   skill exits non-zero and fails the check.

Deterministic checks run with no configuration. Provide `anthropic-api-key` to also score triggering
quality, verification, and constraint coverage.

## Notes

- The action runs `npx @sgharlow/beacon@latest`, so it tracks the published CLI.
- Commenting needs `pull-requests: write`. On fork PRs the token is read-only; the action logs and
  continues rather than failing.
