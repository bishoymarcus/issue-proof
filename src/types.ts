export type Classification =
  | "actionable"
  | "needs-info"
  | "possible-duplicate"
  | "security-sensitive"
  | "not-a-bug";

export interface IssueInput {
  number?: number;
  title: string;
  body?: string | null;
  labels?: string[];
}

export interface SimilarIssue {
  number?: number;
  title: string;
  url?: string;
  state?: string;
}

export interface AnalyzeOptions {
  similarIssues?: SimilarIssue[];
}

export interface DuplicateCandidate extends SimilarIssue {
  similarity: number;
}

export interface IssueAnalysis {
  classification: Classification;
  confidence: number;
  suggestedLabels: string[];
  missingInfo: string[];
  evidence: string[];
  warnings: string[];
  nextStep: string;
  redactedTitle: string;
  redactedBody: string;
  possibleDuplicates: DuplicateCandidate[];
}
