import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { execa } from "execa";
import { discoverFiles } from "../src/core/discover.js";

test("discoverFiles: git mode uses git ls-files and filters always-ignore", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentstyle-"));
  await execa("git", ["init"], { cwd: dir });
  await fs.mkdir(path.join(dir, "src"));
  await fs.writeFile(path.join(dir, "src", "index.ts"), "export const x = 1;\n");
  await fs.mkdir(path.join(dir, "node_modules"));
  await fs.writeFile(path.join(dir, "node_modules", "x.js"), "should not be seen\n");
  await fs.writeFile(path.join(dir, ".gitignore"), "node_modules/\n");

  await execa("git", ["add", "."], { cwd: dir });
  await execa("git", ["commit", "-m", "init"], {
    cwd: dir,
    env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
  });

  const { files, usedGit } = await discoverFiles({ rootAbs: dir, useGit: true });
  assert.equal(usedGit, true);
  assert.ok(files.some((f) => f.relPath === "src/index.ts"));
  assert.ok(!files.some((f) => f.relPath.startsWith("node_modules/")));
});

test("discoverFiles: non-git mode walks filesystem and filters always-ignore", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentstyle-"));
  await fs.mkdir(path.join(dir, "src"));
  await fs.writeFile(path.join(dir, "src", "index.ts"), "export const x = 1;\n");
  await fs.mkdir(path.join(dir, "node_modules"));
  await fs.writeFile(path.join(dir, "node_modules", "x.js"), "nope\n");

  const { files, usedGit } = await discoverFiles({ rootAbs: dir, useGit: false });
  assert.equal(usedGit, false);
  assert.ok(files.some((f) => f.relPath === "src/index.ts"));
  assert.ok(!files.some((f) => f.relPath.startsWith("node_modules/")));
});

