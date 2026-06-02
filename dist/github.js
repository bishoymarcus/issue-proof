import { REPORT_MARKER } from "./comment.js";
export function parseRepository(value) {
    const [owner, repo] = value.split("/");
    if (!owner || !repo) {
        throw new Error("Repository must look like owner/repo.");
    }
    return { owner, repo };
}
export async function fetchIssue(repository, issueNumber, token) {
    const { owner, repo } = parseRepository(repository);
    const issue = await githubRequest("GET", `/repos/${owner}/${repo}/issues/${issueNumber}`, token);
    return {
        number: issue.number,
        title: issue.title,
        body: issue.body,
        labels: normalizeLabels(issue.labels),
    };
}
export async function upsertIssueComment(repository, issueNumber, body, token) {
    const { owner, repo } = parseRepository(repository);
    const comments = await githubRequest("GET", `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`, token);
    const existing = comments.find((comment) => comment.body?.includes(REPORT_MARKER));
    if (existing) {
        await githubRequest("PATCH", `/repos/${owner}/${repo}/issues/comments/${existing.id}`, token, { body });
        return "updated";
    }
    await githubRequest("POST", `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, token, { body });
    return "created";
}
export async function addIssueLabels(repository, issueNumber, labels, token) {
    if (labels.length === 0)
        return;
    const { owner, repo } = parseRepository(repository);
    await githubRequest("POST", `/repos/${owner}/${repo}/issues/${issueNumber}/labels`, token, { labels });
}
async function githubRequest(method, path, token, body) {
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
        return undefined;
    }
    return (await response.json());
}
function normalizeLabels(labels) {
    return labels
        .map((label) => (typeof label === "string" ? label : label.name))
        .filter((label) => Boolean(label));
}
//# sourceMappingURL=github.js.map