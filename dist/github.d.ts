import type { IssueInput } from "./types.js";
export interface GitHubIssueResponse {
    number: number;
    title: string;
    body: string | null;
    labels: Array<string | {
        name?: string;
    }>;
}
export interface GitHubCommentResponse {
    id: number;
    body?: string;
    user?: {
        type?: string;
        login?: string;
    };
}
export declare function parseRepository(value: string): {
    owner: string;
    repo: string;
};
export declare function fetchIssue(repository: string, issueNumber: number, token: string): Promise<IssueInput>;
export declare function upsertIssueComment(repository: string, issueNumber: number, body: string, token: string): Promise<"created" | "updated">;
export declare function addIssueLabels(repository: string, issueNumber: number, labels: string[], token: string): Promise<void>;
