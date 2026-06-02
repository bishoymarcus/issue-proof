# Issue Proof

Turn noisy GitHub issues into maintainer-ready evidence.

`issue-proof` is a GitHub Action and CLI for open-source maintainers. It reads a GitHub issue and produces a short triage report:

- Is this actionable?
- Is it missing reproduction details?
- Could it be a duplicate?
- Does it look security-sensitive?
- What labels and next step should a maintainer consider?

The first version works without a hosted service or required API key. It is report-only by default.

## Why Maintainers Use It

Open-source issue queues fill up with vague reports, duplicates, environment-specific failures, support questions, and sometimes sensitive security details. `issue-proof` gives maintainers a quick evidence pass before they spend human attention.

It does not close issues automatically. It does not apply labels unless you opt in.

## GitHub Action

Create `.github/workflows/issue-proof.yml`:

```yaml
name: Issue Proof

on:
  issues:
    types: [opened, edited, reopened]

permissions:
  issues: write
  contents: read

jobs:
  issue-proof:
    runs-on: ubuntu-latest
    steps:
      - uses: bishoymarcus/issue-proof@v0.1.1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          post-comment: "true"
          apply-labels: "false"
```

With `apply-labels: "false"`, the Action only posts a comment. Set it to `"true"` after you trust the labels in your repo.

## CLI

Analyze text directly:

```bash
npx issue-proof analyze \
  --title "Crash when exporting PDF" \
  --body "Steps: open a project, click export. Expected: PDF. Actual: app exits. Version 1.2.0 on macOS 15."
```

Get JSON output:

```bash
npx issue-proof analyze --issue examples/issues/actionable-bug.json --json
```

Analyze a GitHub issue:

```bash
GITHUB_TOKEN=ghp_xxx GITHUB_REPOSITORY=owner/repo npx issue-proof issue 123
```

Run as a local simulation of the GitHub Action:

```bash
GITHUB_EVENT_PATH=examples/events/issue-opened.json \
GITHUB_REPOSITORY=owner/repo \
npx issue-proof action --dry-run
```

## Output Example

```md
## Issue Proof triage

Classification: actionable
Confidence: 0.83

Suggested labels: bug, needs-repro-confirmation

Evidence found:
- Reproduction steps were included.
- Expected behavior was described.
- Actual behavior was described.
- Environment details were included.

Suggested next step:
Try to reproduce this issue from the reported steps, then mark it ready for maintainer review.
```

## Labels

Suggested labels are intentionally plain:

- `bug`
- `needs-info`
- `possible-duplicate`
- `security-sensitive`
- `question`
- `needs-repro-confirmation`

You can map them to your repo's label names later. The first version keeps the behavior predictable.

## Privacy

`issue-proof` is local-first:

- The deterministic analyzer does not send issue text anywhere.
- The GitHub Action only calls GitHub when posting comments or labels.
- Common secrets are redacted from generated reports.
- Future AI features should be opt-in and documented before they send issue text to any model provider.

## Roadmap

- Optional OpenAI-powered duplicate detection.
- Reproduction-pack generation.
- Weekly maintainer digest.
- Security-sensitive routing helpers.
- Repo-specific label mapping.
- Comment update mode to avoid duplicate bot comments.

## Development

```bash
npm install
npm run check
```

`npm run check` builds TypeScript, runs tests, and checks the npm package contents.

## License

MIT
