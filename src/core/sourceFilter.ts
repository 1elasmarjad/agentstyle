import path from "node:path";
import type { FileEntry } from "./types.js";

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".go", ".rs", ".java", ".c", ".cpp", ".cc", ".h", ".hpp",
  ".cs", ".rb", ".php", ".swift", ".kt", ".kts", ".scala",
  ".vue", ".svelte", ".astro",
  ".css", ".scss", ".sass", ".less",
  ".html", ".htm",
  ".sql", ".sh", ".bash", ".zsh",
  ".lua", ".zig", ".nim",
  ".ex", ".exs", ".erl", ".hs", ".ml",
  ".clj", ".cljs", ".dart",
  ".r", ".jl",
  ".proto", ".graphql", ".gql",
]);

const DOC_EXTENSIONS = new Set([".md", ".txt", ".rst"]);

const TEST_NAME_PATTERNS = [".test.", ".spec.", "_test.", "_spec."];
const TEST_DIR_PREFIXES = ["test/", "tests/", "__tests__/", "spec/"];

const ROOT_CONFIG_PATTERNS = [".config.", ".conf."];
const ROOT_CONFIG_NAMES = ["eslint", "prettier", "tsconfig", "jest", "vite.config", "webpack"];

const LOCK_FILES = new Set([
  "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
  "bun.lockb", "composer.lock", "Gemfile.lock",
  "Cargo.lock", "poetry.lock", "go.sum",
]);

function isTestFile(relPath: string): boolean {
  const name = path.basename(relPath);
  for (const p of TEST_NAME_PATTERNS) {
    if (name.includes(p)) return true;
  }
  for (const prefix of TEST_DIR_PREFIXES) {
    if (relPath.startsWith(prefix)) return true;
  }
  return false;
}

function isRootConfig(relPath: string): boolean {
  if (relPath.includes("/")) return false;
  const lower = relPath.toLowerCase();
  for (const p of ROOT_CONFIG_PATTERNS) {
    if (lower.includes(p)) return true;
  }
  for (const name of ROOT_CONFIG_NAMES) {
    if (lower.startsWith(name)) return true;
  }
  return false;
}

function isDocFile(relPath: string): boolean {
  const ext = path.extname(relPath).toLowerCase();
  if (DOC_EXTENSIONS.has(ext)) return true;
  const name = path.basename(relPath).toUpperCase();
  if (name.startsWith("LICENSE") || name.startsWith("CHANGELOG")) return true;
  return false;
}

function isLockFile(relPath: string): boolean {
  return LOCK_FILES.has(path.basename(relPath));
}

export function filterSourceFiles(files: FileEntry[]): Set<string> {
  const result = new Set<string>();
  for (const f of files) {
    const ext = path.extname(f.relPath).toLowerCase();
    if (!SOURCE_EXTENSIONS.has(ext)) continue;
    if (isTestFile(f.relPath)) continue;
    if (isRootConfig(f.relPath)) continue;
    if (isDocFile(f.relPath)) continue;
    if (isLockFile(f.relPath)) continue;
    result.add(f.relPath);
  }
  return result;
}
