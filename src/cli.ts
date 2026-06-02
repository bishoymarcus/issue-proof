#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { analyzeIssue } from "./analyzer.js";
import { renderAnalysisComment } from "./comment.js";
import { addIssueLabels, fetchIssue, upsertIssueComment } from "./github.js";
import type { IssueInput } from "./types.js";

interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Map<string, string | boolean>;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === "" && process.env.GITHUB_ACTIONS && process.env.GITHUB_EVENT_PATH) {
    args.command = "action";
  }

  switch (args.command) {
    case "analyze":
      await runAnalyze(args);
      break;
    case "issue":
      await runIssue(args);
      break;
    case "action":
      await runAction(args);
      break;
    case "config":
      await runConfig(args);
      break;
    case "help":
    case "--help":
    case "-h":
    case "":
      printHelp();
      break;
    default:
      throw new Error(`Unknown command: ${args.command}`);
  }
}

async function runAnalyze(args: ParsedArgs): Promise<void> {
  const issue = await issueFromArgs(args);
  const analysis = analyzeIssue(issue);

  if (args.flags.has("json")) {
    writeJson(analysis);
    return;
  }

  console.log(renderAnalysisComment(analysis));
}

async function runIssue(args: ParsedArgs): Promise<void> {
  const issueNumber = Number(args.positional[0]);
  if (!Number.isInteger(issueNumber)) {
    throw new Error("Usage: issue-proof issue <number>");
  }

  const repository = flagString(args, "repo") ?? process.env.GITHUB_REPOSITORY;
  const token = flagString(args, "token") ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

  if (!repository) throw new Error("Set GITHUB_REPOSITORY or pass --repo owner/repo.");
  if (!token) throw new Error("Set GITHUB_TOKEN, GH_TOKEN, or pass --token.");

  const issue = await fetchIssue(repository, issueNumber, token);
  const analysis = analyzeIssue(issue);

  if (args.flags.has("json")) {
    writeJson(analysis);
    return;
  }

  console.log(renderAnalysisComment(analysis));
}

async function runAction(args: ParsedArgs): Promise<void> {
  const eventPath = flagString(args, "event") ?? process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error("GITHUB_EVENT_PATH is required for action mode.");

  const event = JSON.parse(await readFile(eventPath, "utf8")) as {
    issue?: {
      number?: number;
      title?: string;
      body?: string | null;
      labels?: Array<string | { name?: string }>;
    };
    repository?: {
      full_name?: string;
    };
  };

  if (!event.issue?.title) {
    console.log("Issue Proof skipped: event does not contain an issue.");
    return;
  }

  const repository =
    flagString(args, "repo") ?? event.repository?.full_name ?? process.env.GITHUB_REPOSITORY;
  if (!repository) throw new Error("Repository is required for action mode.");

  const issue: IssueInput = {
    number: event.issue.number,
    title: event.issue.title,
    body: event.issue.body,
    labels: normalizeEventLabels(event.issue.labels ?? []),
  };
  const analysis = analyzeIssue(issue);
  const comment = renderAnalysisComment(analysis);

  const minConfidence = Number(
    flagString(args, "min-confidence") ?? input("min-confidence") ?? "0.45",
  );
  if (analysis.confidence < minConfidence) {
    console.log(
      `Issue Proof skipped: confidence ${analysis.confidence.toFixed(2)} is below ${minConfidence.toFixed(2)}.`,
    );
    return;
  }

  if (args.flags.has("json")) {
    writeJson({ issue, analysis, comment });
    return;
  }

  if (args.flags.has("dry-run")) {
    console.log(comment);
    return;
  }

  const token = flagString(args, "token") ?? input("github-token") ?? process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("github-token input or GITHUB_TOKEN is required unless --dry-run is set.");
  }

  const shouldPost = booleanInput(args, "post-comment", true);
  const shouldLabel = booleanInput(args, "apply-labels", false);
  const issueNumber = issue.number;
  if (!issueNumber) throw new Error("Issue number is required for GitHub updates.");

  if (shouldPost) {
    const result = await upsertIssueComment(repository, issueNumber, comment, token);
    console.log(`Issue Proof comment ${result}.`);
  } else {
    console.log(comment);
  }

  if (shouldLabel) {
    await addIssueLabels(repository, issueNumber, analysis.suggestedLabels, token);
    console.log(`Issue Proof applied labels: ${analysis.suggestedLabels.join(", ")}`);
  }
}

async function runConfig(args: ParsedArgs): Promise<void> {
  const subcommand = args.positional[0];
  if (subcommand !== "init") {
    throw new Error("Usage: issue-proof config init");
  }

  const workflowPath = ".github/workflows/issue-proof.yml";
  const workflow = `name: Issue Proof

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
          github-token: \${{ secrets.GITHUB_TOKEN }}
          post-comment: "true"
          apply-labels: "false"
`;

  await mkdir(dirname(workflowPath), { recursive: true });
  await writeFile(workflowPath, workflow, "utf8");
  console.log(`Wrote ${workflowPath}`);
}

async function issueFromArgs(args: ParsedArgs): Promise<IssueInput> {
  const issuePath = flagString(args, "issue");
  if (issuePath) {
    const value = JSON.parse(await readFile(issuePath, "utf8")) as IssueInput;
    if (!value.title) throw new Error(`${issuePath} must include a title.`);
    return value;
  }

  const title = flagString(args, "title") ?? args.positional[0];
  const body = flagString(args, "body") ?? args.positional.slice(1).join(" ");

  if (!title) {
    throw new Error("Pass --title, a positional title, or --issue path/to/issue.json.");
  }

  return { title, body };
}

function parseArgs(values: string[]): ParsedArgs {
  const flags = new Map<string, string | boolean>();
  const positional: string[] = [];
  let command = "";

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value.startsWith("--")) {
      const [rawKey, inlineValue] = value.slice(2).split("=", 2);
      if (inlineValue !== undefined) {
        flags.set(rawKey, inlineValue);
      } else if (values[index + 1] && !values[index + 1].startsWith("-")) {
        flags.set(rawKey, values[index + 1]);
        index += 1;
      } else {
        flags.set(rawKey, true);
      }
      continue;
    }

    if (!command) {
      command = value;
    } else {
      positional.push(value);
    }
  }

  return { command, positional, flags };
}

function flagString(args: ParsedArgs, name: string): string | undefined {
  const value = args.flags.get(name);
  return typeof value === "string" ? value : undefined;
}

function input(name: string): string | undefined {
  const upperName = name.toUpperCase();
  return (
    process.env[`INPUT_${upperName.replace(/-/g, "_")}`] ??
    process.env[`INPUT_${upperName}`]
  );
}

function booleanInput(args: ParsedArgs, name: string, fallback: boolean): boolean {
  const flag = args.flags.get(name);
  if (typeof flag === "boolean") return flag;
  if (typeof flag === "string") return toBoolean(flag);

  const value = input(name);
  if (value === undefined) return fallback;
  return toBoolean(value);
}

function toBoolean(value: string): boolean {
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function normalizeEventLabels(labels: Array<string | { name?: string }>): string[] {
  return labels
    .map((label) => (typeof label === "string" ? label : label.name))
    .filter((label): label is string => Boolean(label));
}

function writeJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function printHelp(): void {
  console.log(`Issue Proof

Usage:
  issue-proof analyze --title "Crash" --body "Steps..."
  issue-proof analyze --issue examples/issues/actionable-bug.json --json
  issue-proof issue 123 --repo owner/repo
  issue-proof action --dry-run
  issue-proof config init
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Issue Proof failed: ${message}`);
  process.exitCode = 1;
});
