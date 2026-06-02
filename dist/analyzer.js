import { redactSensitiveText } from "./redact.js";
const SECURITY_WORDS = [
    "api key",
    "auth bypass",
    "credential",
    "credentials",
    "cve",
    "exploit",
    "private key",
    "rce",
    "secret",
    "sql injection",
    "token leak",
    "vulnerability",
    "xss",
];
const BUG_WORDS = [
    "bug",
    "crash",
    "error",
    "exception",
    "fail",
    "fails",
    "hang",
    "panic",
    "regression",
    "stack trace",
    "traceback",
    "wrong",
];
const QUESTION_WORDS = [
    "can i",
    "does this support",
    "feature request",
    "how do i",
    "how to",
    "question",
    "support",
];
export function analyzeIssue(issue, options = {}) {
    const redactedTitle = redactSensitiveText(issue.title).trim();
    const redactedBody = redactSensitiveText(issue.body).trim();
    const fullText = `${redactedTitle}\n${redactedBody}`;
    const lower = fullText.toLowerCase();
    const evidence = [];
    const warnings = [];
    const missingInfo = [];
    const suggestedLabels = new Set();
    const possibleDuplicates = findPossibleDuplicates(issue, options.similarIssues ?? []);
    const securityHits = SECURITY_WORDS.filter((word) => lower.includes(word));
    const hasSecretRedaction = fullText.includes("[redacted-");
    if (securityHits.length > 0 || hasSecretRedaction) {
        suggestedLabels.add("security-sensitive");
        warnings.push("The report may contain security-sensitive details.");
        if (hasSecretRedaction) {
            evidence.push("Obvious secrets were redacted from the generated report.");
        }
        for (const hit of securityHits.slice(0, 3)) {
            evidence.push(`Security keyword detected: ${hit}.`);
        }
        return {
            classification: "security-sensitive",
            confidence: clamp(0.78 + securityHits.length * 0.04 + (hasSecretRedaction ? 0.08 : 0)),
            suggestedLabels: [...suggestedLabels],
            missingInfo,
            evidence,
            warnings,
            nextStep: "Move this discussion to a private security channel before asking for more public details.",
            redactedTitle,
            redactedBody,
            possibleDuplicates,
        };
    }
    if (possibleDuplicates[0]?.similarity && possibleDuplicates[0].similarity >= 0.62) {
        suggestedLabels.add("possible-duplicate");
        suggestedLabels.add("needs-triage");
        evidence.push(`Similar issue found: ${formatDuplicate(possibleDuplicates[0])}.`);
        return {
            classification: "possible-duplicate",
            confidence: clamp(possibleDuplicates[0].similarity),
            suggestedLabels: [...suggestedLabels],
            missingInfo,
            evidence,
            warnings,
            nextStep: "Compare this report with the possible duplicate before requesting more information.",
            redactedTitle,
            redactedBody,
            possibleDuplicates,
        };
    }
    const hasReproduction = hasAny(lower, [
        "steps to reproduce",
        "reproduce",
        "reproduction",
        "minimal repro",
        "1.",
        "first",
        "when i",
    ]);
    const hasExpected = hasAny(lower, ["expected", "should", "i expected"]);
    const hasActual = hasAny(lower, ["actual", "instead", "crash", "error", "fails", "failed"]);
    const hasEnvironment = hasAny(lower, [
        "android",
        "browser",
        "chrome",
        "environment",
        "ios",
        "linux",
        "macos",
        "node",
        "safari",
        "version",
        "windows",
    ]);
    const hasVersion = /\bv?\d+\.\d+(\.\d+)?\b/i.test(fullText);
    const hasBugWords = BUG_WORDS.some((word) => lower.includes(word));
    const looksLikeQuestion = QUESTION_WORDS.some((word) => lower.includes(word));
    if (hasReproduction)
        evidence.push("Reproduction steps were included.");
    else
        missingInfo.push("reproduction steps");
    if (hasExpected)
        evidence.push("Expected behavior was described.");
    else
        missingInfo.push("expected behavior");
    if (hasActual)
        evidence.push("Actual behavior or failure mode was described.");
    else
        missingInfo.push("actual behavior");
    if (hasEnvironment || hasVersion)
        evidence.push("Environment or version details were included.");
    else
        missingInfo.push("environment and version");
    if (hasBugWords) {
        suggestedLabels.add("bug");
    }
    if (looksLikeQuestion && !hasBugWords && missingInfo.length >= 3) {
        suggestedLabels.add("question");
        return {
            classification: "not-a-bug",
            confidence: 0.7,
            suggestedLabels: [...suggestedLabels],
            missingInfo,
            evidence: evidence.length ? evidence : ["The report reads more like a question than a bug."],
            warnings,
            nextStep: "Route this to support or discussion unless the reporter can provide a concrete failing case.",
            redactedTitle,
            redactedBody,
            possibleDuplicates,
        };
    }
    if (missingInfo.length >= 2 || fullText.trim().length < 80) {
        suggestedLabels.add("needs-info");
        if (hasBugWords)
            suggestedLabels.add("bug");
        return {
            classification: "needs-info",
            confidence: clamp(0.58 + missingInfo.length * 0.07),
            suggestedLabels: [...suggestedLabels],
            missingInfo,
            evidence,
            warnings,
            nextStep: "Ask the reporter for the missing details before assigning this to a maintainer.",
            redactedTitle,
            redactedBody,
            possibleDuplicates,
        };
    }
    suggestedLabels.add("bug");
    suggestedLabels.add("needs-repro-confirmation");
    return {
        classification: "actionable",
        confidence: clamp(0.64 + evidence.length * 0.045 + (hasBugWords ? 0.06 : 0)),
        suggestedLabels: [...suggestedLabels],
        missingInfo,
        evidence,
        warnings,
        nextStep: "Try to reproduce this issue from the reported steps, then mark it ready for maintainer review.",
        redactedTitle,
        redactedBody,
        possibleDuplicates,
    };
}
function hasAny(value, needles) {
    return needles.some((needle) => value.includes(needle));
}
function clamp(value) {
    return Math.max(0.01, Math.min(0.99, Number(value.toFixed(2))));
}
function findPossibleDuplicates(issue, similarIssues) {
    return similarIssues
        .map((candidate) => ({
        ...candidate,
        similarity: titleSimilarity(issue.title, candidate.title),
    }))
        .filter((candidate) => candidate.similarity >= 0.45)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3);
}
function titleSimilarity(left, right) {
    const leftTokens = tokenize(left);
    const rightTokens = tokenize(right);
    if (leftTokens.size === 0 || rightTokens.size === 0)
        return 0;
    let intersection = 0;
    for (const token of leftTokens) {
        if (rightTokens.has(token))
            intersection += 1;
    }
    const union = new Set([...leftTokens, ...rightTokens]).size;
    return clamp(intersection / union);
}
function tokenize(value) {
    const stop = new Set([
        "a",
        "an",
        "and",
        "for",
        "from",
        "in",
        "of",
        "on",
        "the",
        "to",
        "when",
        "with",
    ]);
    return new Set(value
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 2 && !stop.has(token)));
}
function formatDuplicate(candidate) {
    const issueNumber = candidate.number ? `#${candidate.number} ` : "";
    const url = candidate.url ? ` (${candidate.url})` : "";
    return `${issueNumber}${candidate.title}${url}`;
}
//# sourceMappingURL=analyzer.js.map