import assert from "node:assert/strict";
import { test } from "node:test";
import { smartPickFiles, truncateText } from "../src/core/sample.js";
import { buildClaudePrompt } from "../src/core/prompt.js";

test("smartPickFiles includes config-like files", () => {
  const selected = [
    { absPath: "/r/package.json", relPath: "package.json", sizeBytes: 10 },
    { absPath: "/r/src/a.ts", relPath: "src/a.ts", sizeBytes: 10 },
    { absPath: "/r/tsconfig.json", relPath: "tsconfig.json", sizeBytes: 10 },
  ];
  const picked = smartPickFiles(selected, { bucketLimit: 10, maxFileChars: 10 });
  assert.ok(picked.some((f) => f.relPath === "package.json"));
  assert.ok(picked.some((f) => f.relPath === "tsconfig.json"));
});

test("truncateText truncates and annotates", () => {
  const { text, truncated } = truncateText("0123456789", 5);
  assert.equal(truncated, true);
  assert.ok(text.includes("TRUNCATED"));
});

test("buildClaudePrompt contains manifest and file headers", () => {
  const files = [
    {
      absPath: "/r/src/a.ts",
      relPath: "src/a.ts",
      sizeBytes: 3,
      content: "abc",
      truncated: false,
    },
  ];
  const p = buildClaudePrompt(files);
  assert.ok(p.includes("MANIFEST:"));
  assert.ok(p.includes("FILE: /r/src/a.ts"));
  assert.ok(p.includes("## Code Style"));
});

