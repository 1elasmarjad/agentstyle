import path from "node:path";

export const DEFAULT_ALWAYS_IGNORE = [
  ".git/",
  "node_modules/",
  "dist/",
  "build/",
  "coverage/",
  ".next/",
  ".turbo/",
  ".cache/",
  ".DS_Store",
];

function normalizeRel(relPath: string): string {
  // We treat all ignore checks as posix-ish.
  return relPath.split(path.sep).join("/");
}

export function isAlwaysIgnored(relPath: string, alwaysIgnore = DEFAULT_ALWAYS_IGNORE): boolean {
  const rel = normalizeRel(relPath);
  for (const ig of alwaysIgnore) {
    if (ig.endsWith("/")) {
      const prefix = ig;
      if (rel === prefix.slice(0, -1) || rel.startsWith(prefix)) return true;
      continue;
    }
    if (rel === ig || rel.endsWith("/" + ig)) return true;
  }
  return false;
}

export type GitignoreMatcher = {
  ignores(relPath: string, isDir: boolean): boolean;
};

// Minimal .gitignore support for non-git repos.
// Supports:
// - blank/comment lines
// - "foo/" directory patterns
// - "*" and "?" globs
// - leading "/" (anchored to repo root)
// Does NOT fully implement gitignore semantics (e.g. "**", escaping, negation).
export function compileGitignore(patterns: string[]): GitignoreMatcher {
  const compiled = patterns
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .filter((line) => !line.startsWith("!")) // negation ignored in MVP
    .map((pat) => {
      const dirOnly = pat.endsWith("/");
      const anchored = pat.startsWith("/");
      const raw = pat.replace(/^\/+/, "").replace(/\/+$/, "");

      // Turn a small subset of glob syntax into a regex.
      const reSrc = raw
        .split("")
        .map((ch) => {
          if (ch === "*") return "[^/]*";
          if (ch === "?") return "[^/]";
          return escapeRegex(ch);
        })
        .join("");

      const re = anchored
        ? new RegExp("^" + reSrc + "(?:$|/)")
        : new RegExp("(^|/)" + reSrc + "(?:$|/)");

      return { re, dirOnly };
    });

  return {
    ignores(relPath: string, isDir: boolean) {
      const rel = normalizeRel(relPath);
      for (const { re, dirOnly } of compiled) {
        if (dirOnly && !isDir) continue;
        if (re.test(rel)) return true;
      }
      return false;
    },
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

