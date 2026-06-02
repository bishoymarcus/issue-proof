# Codex Notes For Issue Proof

This repo is intended to be public open source.

## Safety Rules

- Do not add secrets, private customer data, patient data, private repo data, or real access tokens.
- Keep the first version useful without a required OpenAI key.
- Do not make the Action close issues automatically.
- Do not apply labels unless the user or Action config explicitly enables it.
- Prefer deterministic tests for the analyzer before adding AI behavior.

## Project Shape

- `src/analyzer.ts` contains the core triage logic.
- `src/cli.ts` contains the command-line and GitHub Action entrypoint.
- `src/github.ts` contains GitHub API helpers.
- `test/` contains Node test runner tests.
- `action.yml` exposes the repo as a GitHub Action.

## Verification

Run:

`npm run check`

This builds TypeScript, runs tests, and checks the npm package contents.
