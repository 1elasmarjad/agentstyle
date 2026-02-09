import fs from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import { compileGitignore, DEFAULT_ALWAYS_IGNORE, isAlwaysIgnored } from "./ignore.js";
import type { FileEntry } from "./types.js";

export type DiscoverOptions = {
  rootAbs: string;
  useGit: boolean;
  alwaysIgnore?: string[];
};

export async function discoverFiles(opts: DiscoverOptions): Promise<{ files: FileEntry[]; usedGit: boolean }> {
  const alwaysIgnore = opts.alwaysIgnore ?? DEFAULT_ALWAYS_IGNORE;

  if (opts.useGit) {
    const gitFiles = await tryDiscoverGitFiles(opts.rootAbs);
    if (gitFiles) {
      const relPaths = gitFiles.filter((rel) => !isAlwaysIgnored(rel, alwaysIgnore));
      const files = await statAll(opts.rootAbs, relPaths);
      return { files, usedGit: true };
    }
  }

  const patterns = await readGitignorePatterns(opts.rootAbs);
  const matcher = compileGitignore(patterns);

  const relPaths: string[] = [];
  await walk(opts.rootAbs, "", (rel, ent) => {
    if (isAlwaysIgnored(rel, alwaysIgnore)) return false;
    if (matcher.ignores(rel, ent.isDirectory())) return false;
    if (ent.isFile()) relPaths.push(rel);
    return true;
  });

  const files = await statAll(opts.rootAbs, relPaths);
  return { files, usedGit: false };
}

async function tryDiscoverGitFiles(rootAbs: string): Promise<string[] | null> {
  try {
    const { stdout } = await execa("git", ["-C", rootAbs, "ls-files", "-co", "--exclude-standard", "-z"], {
      stdio: "pipe",
    });
    const parts = stdout.split("\0").filter(Boolean);
    return parts;
  } catch {
    return null;
  }
}

async function statAll(rootAbs: string, relPaths: string[]): Promise<FileEntry[]> {
  // Concurrency-limited stat to avoid too many open files.
  const concurrency = 64;
  const out: FileEntry[] = [];

  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, relPaths.length) }, async () => {
      while (true) {
        const idx = i++;
        if (idx >= relPaths.length) return;
        const relPath = relPaths[idx]!;
        const absPath = path.join(rootAbs, relPath);
        try {
          const st = await fs.stat(absPath);
          if (!st.isFile()) continue;
          out.push({ absPath, relPath: toPosix(relPath), sizeBytes: st.size });
        } catch {
          // Ignore races / missing files.
        }
      }
    }),
  );

  out.sort((a, b) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0));
  return out;
}

async function walk(
  rootAbs: string,
  relDir: string,
  visit: (relPath: string, ent: import("node:fs").Dirent) => boolean,
): Promise<void> {
  const absDir = path.join(rootAbs, relDir);
  let ents: import("node:fs").Dirent[];
  try {
    ents = await fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const ent of ents) {
    const relPath = relDir ? path.posix.join(relDir, ent.name) : ent.name;
    const keepWalking = visit(relPath, ent);
    if (ent.isDirectory() && keepWalking) {
      await walk(rootAbs, relPath, visit);
    }
  }
}

async function readGitignorePatterns(rootAbs: string): Promise<string[]> {
  try {
    const p = path.join(rootAbs, ".gitignore");
    const txt = await fs.readFile(p, "utf8");
    return txt.split(/\r?\n/);
  } catch {
    return [];
  }
}

function toPosix(relPath: string): string {
  return relPath.split(path.sep).join("/");
}

