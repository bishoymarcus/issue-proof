const SECRET_PATTERNS = [
    [/\bsk-(proj-)?[A-Za-z0-9_-]{16,}\b/g, "[redacted-openai-key]"],
    [/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, "[redacted-github-token]"],
    [/\bAKIA[0-9A-Z]{16}\b/g, "[redacted-aws-access-key]"],
    [
        /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
        "[redacted-jwt]",
    ],
    [
        /\b(?:api[_-]?key|token|password|secret)\s*[:=]\s*["']?[^"'\s]{8,}/gi,
        "[redacted-secret]",
    ],
    [
        /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
        "[redacted-email]",
    ],
];
export function redactSensitiveText(value) {
    let output = value ?? "";
    for (const [pattern, replacement] of SECRET_PATTERNS) {
        output = output.replace(pattern, replacement);
    }
    return output;
}
//# sourceMappingURL=redact.js.map