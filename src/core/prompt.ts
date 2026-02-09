import type { SampledFile } from "./sample.js";

export function buildClaudePrompt(files: SampledFile[]): string {
  const header = [
    "You are analyzing a software repository to infer its coding style and conventions.",
    "",
    "Return ONLY Markdown starting with the heading:",
    "## Code Style",
    "",
    "Formatting requirements:",
    "- Start with a short intro paragraph.",
    "- Use bullets grouped by themes (naming, formatting, structure, tests, error handling, types, etc.).",
    "- Include concrete examples only when helpful; do not include code blocks longer than 30 lines.",
    "",
    "Input follows. First: a manifest of included files (absolute paths and byte sizes). Then each file's content.",
  ].join("\n");

  const manifest = ["MANIFEST:"]
    .concat(files.map((f) => `- ${f.absPath} (${f.sizeBytes} bytes${f.truncated ? ", truncated" : ""})`))
    .join("\n");

  const body = files
    .map((f) => {
      return [`FILE: ${f.absPath}`, "-----", f.content, "-----"].join("\n");
    })
    .join("\n\n");

  return [header, "", manifest, "", body].join("\n");
}

