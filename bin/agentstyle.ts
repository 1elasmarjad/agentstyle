#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import App from "../src/cli/App.js";

type Options = {
  root?: string;
  noGit?: boolean;
  maxBytes: number;
  maxFileChars: number;
  out?: string;
  provider: "claude";
};

function printHelp(): void {
  // Keep help non-interactive, so users can discover flags without Ink.
  // eslint-disable-next-line no-console
  console.log(`agentstyle

Usage:
  agentstyle [--root <path>] [--no-git] [--max-bytes <n>] [--max-file-chars <n>] [--out <path>] [--provider claude]

Flags:
  --root <path>          Override repo root (default: auto-detect from cwd)
  --no-git               Disable git-based discovery even inside a git repo
  --max-bytes <n>        Size guard threshold (default: 400000)
  --max-file-chars <n>   Truncate each file to at most N chars (default: 20000)
  --out <path>           Save path used by 's' key in result screen (default: <root>/agentstyle.md)
  --provider <id>        Only 'claude' is supported in MVP
  -h, --help             Show help
`);
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    maxBytes: 400000,
    maxFileChars: 20000,
    provider: "claude",
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    }
    if (a === "--root") {
      opts.root = argv[++i];
      continue;
    }
    if (a === "--no-git") {
      opts.noGit = true;
      continue;
    }
    if (a === "--max-bytes") {
      const v = Number(argv[++i]);
      if (!Number.isFinite(v) || v < 0) throw new Error(`Invalid --max-bytes: ${String(argv[i])}`);
      opts.maxBytes = v;
      continue;
    }
    if (a === "--max-file-chars") {
      const v = Number(argv[++i]);
      if (!Number.isFinite(v) || v < 0) throw new Error(`Invalid --max-file-chars: ${String(argv[i])}`);
      opts.maxFileChars = v;
      continue;
    }
    if (a === "--out") {
      opts.out = argv[++i];
      continue;
    }
    if (a === "--provider") {
      const v = argv[++i];
      if (v !== "claude") throw new Error(`Unsupported provider: ${String(v)}`);
      opts.provider = "claude";
      continue;
    }
    throw new Error(`Unknown argument: ${a}`);
  }

  return opts;
}

try {
  const options = parseArgs(process.argv.slice(2));
  render(React.createElement(App, { cwd: process.cwd(), options }));
} catch (err: any) {
  // eslint-disable-next-line no-console
  console.error(err?.message ?? String(err));
  process.exit(1);
}

