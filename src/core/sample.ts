import type { SelectedFile } from "./types.js";

export type SampleOptions = {
  bucketLimit: number;
  maxFileChars: number;
};

export type SampledFile = SelectedFile & {
  content: string;
  truncated: boolean;
};

export function smartPickFiles(selected: SelectedFile[], opts: SampleOptions): SelectedFile[] {
  const byRel = [...selected].sort((a, b) => a.relPath.localeCompare(b.relPath));

  const picked = new Map<string, SelectedFile>();
  const pick = (f: SelectedFile) => picked.set(f.relPath, f);

  const base = (p: string) => p.split("/").at(-1) ?? p;
  const isPrefix = (b: string, prefix: string) => b.toLowerCase().startsWith(prefix.toLowerCase());
  const isReadme = (b: string) => isPrefix(b, "readme");

  for (const f of byRel) {
    const b = base(f.relPath);
    if (b === "package.json") pick(f);
    else if (b === "biome.json") pick(f);
    else if (b === "go.mod") pick(f);
    else if (b === "Cargo.toml") pick(f);
    else if (b === "pyproject.toml") pick(f);
    else if (b === "Makefile") pick(f);
    else if (isReadme(b)) pick(f);
    else if (isPrefix(b, "tsconfig") && b.endsWith(".json")) pick(f);
    else if (isPrefix(b, "eslint")) pick(f);
    else if (isPrefix(b, "prettier")) pick(f);
    else if (isPrefix(b, "requirements") && b.toLowerCase().endsWith(".txt")) pick(f);
  }

  const buckets: Array<{ prefix: string; limit: number }> = [
    { prefix: "src/", limit: opts.bucketLimit },
    { prefix: "lib/", limit: opts.bucketLimit },
    { prefix: "app/", limit: opts.bucketLimit },
    { prefix: "packages/", limit: opts.bucketLimit },
    { prefix: "test/", limit: opts.bucketLimit },
    { prefix: "tests/", limit: opts.bucketLimit },
    { prefix: "__tests__/", limit: opts.bucketLimit },
  ];

  for (const { prefix, limit } of buckets) {
    const candidates = byRel
      .filter((f) => f.relPath.startsWith(prefix))
      .sort((a, b) => a.sizeBytes - b.sizeBytes || a.relPath.localeCompare(b.relPath))
      .slice(0, limit);
    for (const f of candidates) pick(f);
  }

  // If we still have very few files, include some smallest overall.
  if (picked.size < Math.min(10, byRel.length)) {
    const extra = byRel
      .slice()
      .sort((a, b) => a.sizeBytes - b.sizeBytes || a.relPath.localeCompare(b.relPath))
      .slice(0, Math.min(30, byRel.length));
    for (const f of extra) pick(f);
  }

  return [...picked.values()].sort((a, b) => a.relPath.localeCompare(b.relPath));
}

export function truncateText(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  const slice = text.slice(0, maxChars);
  return {
    text: slice + `\n\n[TRUNCATED: ${text.length - maxChars} chars removed]\n`,
    truncated: true,
  };
}

