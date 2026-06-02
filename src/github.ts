import type { IssueInput } from "./types.js";
import { REPORT_MARKER } from "./comment.js";

export interface GitHubIssueResponse {
  number: number;
  title: string;
  body: string | null;
  labels: Array<string | { name?: string }>;
}

export interface GitHubCommentResponse {
  id: number;
  body?: string;
  user?: {
    type?: string;
    login?: string;
  };
}

export function parseRepository(value: string): { owner: string; repo: string } {
  const [owner, repo] = value.split("/");
  if (!owner || !repo) {
    throw new Error("Repository must look like owner/repo.");
  }
  return { owner, repo };
}

export async function fetchIssue(
  repository: string,
  issueNumber: number,
  token: string,
): Promise<IssueInput> {
  const { owner, repo } = parseRepository(repository);
  const issue = await githubRequest<GitHubIssueResponse>(
    "GET",
    `/repos/${owner}/${repo}/issues/${issueNumber}`,
    token,
  );

  return {
    number: issue.number,
    title: issue.title,
    body: issue.body,
    labels: normalizeLabels(issue.labels),
  };
}

export async function upsertIssueComment(
  repository: string,
  issueNumber: number,
  body: string,
  token: string,
): Promise<"created" | "updated"> {
  const { owner, repo } = parseRepository(repository);
  const comments = await githubRequest<GitHubCommentResponse[]>(
    "GET",
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`,
    token,
  );
  const existing = comments.find((comment) => comment.body?.includes(REPORT_MARKER));

  if (existing) {
    await githubRequest(
      "PATCH",
      `/repos/${owner}/${repo}/issues/comments/${existing.id}`,
      token,
      { body },
    );
    return "updated";
  }

  await githubRequest(
    "POST",
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    token,
    { body },
  );
  return "created";
}

export async function addIssueLabels(
  repository: string,
  issueNumber: number,
  labels: string[],
  token: string,
): Promise<void> {
  if (labels.length === 0) return;
  const { owner, repo } = parseRepository(repository);
  await githubRequest(
    "POST",
    `/repos/${owner}/${repo}/issues/${issueNumber}/labels`,
    token,
    { labels },
  );
}

async function githubRequest<T>(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "issue-proof",
      "x-github-api-version": "2022-11-28",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${method} ${path} failed: ${response.status} ${text}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function normalizeLabels(labels: GitHubIssueResponse["labels"]): string[] {
  return labels
    .map((label) => (typeof label === "string" ? label : label.name))
    .filter((label): label is string => Boolean(label));
}
