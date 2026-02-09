import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTree, computeCheckState, flattenTree, toggleNode } from "../src/core/tree.js";

test("tree selection: toggling folder selects/deselects descendants", () => {
  const files = [
    { absPath: "/r/src/a.ts", relPath: "src/a.ts", sizeBytes: 1 },
    { absPath: "/r/src/b.ts", relPath: "src/b.ts", sizeBytes: 1 },
    { absPath: "/r/test/c.ts", relPath: "test/c.ts", sizeBytes: 1 },
  ];
  const root = buildTree("/r", files);

  const sel = new Set<string>();
  assert.equal(computeCheckState(root, sel), "unchecked");

  const srcDir = root.children!.find((c) => c.relPath === "src")!;
  toggleNode(srcDir, sel);
  assert.ok(sel.has("src/a.ts"));
  assert.ok(sel.has("src/b.ts"));
  assert.ok(!sel.has("test/c.ts"));

  toggleNode(srcDir, sel);
  assert.ok(!sel.has("src/a.ts"));
  assert.ok(!sel.has("src/b.ts"));
});

test("tree selection: partial state is computed", () => {
  const files = [
    { absPath: "/r/src/a.ts", relPath: "src/a.ts", sizeBytes: 1 },
    { absPath: "/r/src/b.ts", relPath: "src/b.ts", sizeBytes: 1 },
  ];
  const root = buildTree("/r", files);
  const sel = new Set<string>(["src/a.ts"]);
  const srcDir = root.children!.find((c) => c.relPath === "src")!;
  assert.equal(computeCheckState(srcDir, sel), "partial");

  const flat = flattenTree(root, sel, "");
  assert.ok(flat.some((n) => n.node.relPath === "src" && n.check === "partial"));
});

