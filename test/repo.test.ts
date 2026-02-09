import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { execa } from "execa";
import { detectRepoRoot } from "../src/core/repo.js";

test("detectRepoRoot: non-git returns cwd", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentstyle-"));
  const res = await detectRepoRoot(dir);
  assert.equal(res.isGit, false);
  assert.equal(await fs.realpath(res.root), await fs.realpath(path.resolve(dir)));
});

test("detectRepoRoot: git repo returns git root", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentstyle-"));
  await execa("git", ["init"], { cwd: dir });
  await fs.writeFile(path.join(dir, "a.txt"), "hi");
  await execa("git", ["add", "a.txt"], { cwd: dir });
  await execa("git", ["commit", "-m", "init"], { cwd: dir, env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });

  const nested = path.join(dir, "sub");
  await fs.mkdir(nested);
  const res = await detectRepoRoot(nested);
  assert.equal(res.isGit, true);
  assert.equal(await fs.realpath(res.root), await fs.realpath(path.resolve(dir)));
});
