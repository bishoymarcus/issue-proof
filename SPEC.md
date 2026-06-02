# Issue Proof Spec

## What This Is

`issue-proof` is an open-source maintainer tool. It helps a repository decide whether a new GitHub issue is actionable before a human maintainer spends time on it.

The first version is a GitHub Action plus CLI. It does not need a hosted app.

## Why This Exists

Open-source maintainers lose time on issues that are vague, duplicated, security-sensitive, missing a reproduction, or really support questions. `issue-proof` turns that mess into a short maintainer-ready note.

## MVP

The first version must:

- Analyze an issue title and body.
- Classify it as `actionable`, `needs-info`, `possible-duplicate`, `security-sensitive`, or `not-a-bug`.
- Detect missing evidence such as repro steps, expected behavior, actual behavior, environment, and version.
- Suggest labels.
- Redact obvious secrets from quoted issue text.
- Generate a short Markdown comment suitable for GitHub.
- Run locally as a CLI.
- Run in GitHub Actions on issue events.
- Avoid closing issues or applying labels unless configured.

## Non-Goals For Version 0.1

- No hosted SaaS.
- No database.
- No automatic issue closing.
- No private-data collection.
- No required OpenAI API key.

## Later

After the public package exists:

- Add optional OpenAI-powered duplicate detection and repro extraction.
- Add weekly maintainer digests.
- Add security-routing helpers.
- Add reproduction-pack generation.

## Application Story

The Codex for Open Source application should say that `issue-proof` reduces open-source maintainer load by converting noisy reports into evidence-backed next steps. API credits would be used for issue classification, duplicate detection, repro extraction, maintainer digests, and security-sensitive routing.
