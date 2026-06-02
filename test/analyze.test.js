import test from "node:test";
import assert from "node:assert/strict";
import { analyzeIssue, renderAnalysisComment } from "../dist/index.js";

test("classifies a complete crash report as actionable", () => {
  const analysis = analyzeIssue({
    title: "Crash when exporting PDF",
    body: `Steps to reproduce:
1. Open a report.
2. Click Export PDF.

Expected behavior: a PDF is saved.
Actual behavior: the app crashes.
Environment: macOS 15, app version 1.2.0.`,
  });

  assert.equal(analysis.classification, "actionable");
  assert.equal(analysis.missingInfo.length, 0);
  assert.ok(analysis.suggestedLabels.includes("bug"));
});

test("classifies a vague report as needs-info", () => {
  const analysis = analyzeIssue({
    title: "It does not work",
    body: "The app is broken. Please fix.",
  });

  assert.equal(analysis.classification, "needs-info");
  assert.ok(analysis.missingInfo.includes("reproduction steps"));
  assert.ok(analysis.suggestedLabels.includes("needs-info"));
});

test("classifies leaked credentials as security-sensitive and redacts them", () => {
  const analysis = analyzeIssue({
    title: "Possible token leak",
    body: "The logs include api_key=example-secret-value and credentials.",
  });

  assert.equal(analysis.classification, "security-sensitive");
  assert.match(analysis.redactedBody, /\[redacted-secret\]/);
  assert.doesNotMatch(analysis.redactedBody, /example-secret-value/);
});

test("detects likely duplicate issues from similar titles", () => {
  const analysis = analyzeIssue(
    {
      title: "Crash when exporting PDF",
      body: "Steps to reproduce are the same as the older report.",
    },
    {
      similarIssues: [
        {
          number: 12,
          title: "Crash exporting PDF",
          url: "https://github.com/example/repo/issues/12",
        },
      ],
    },
  );

  assert.equal(analysis.classification, "possible-duplicate");
  assert.equal(analysis.possibleDuplicates[0].number, 12);
});

test("renders a markdown report with the marker", () => {
  const analysis = analyzeIssue({
    title: "It does not work",
    body: "Broken.",
  });
  const comment = renderAnalysisComment(analysis);

  assert.match(comment, /issue-proof-report/);
  assert.match(comment, /Classification:/);
});
