import fs from "node:fs/promises";
import path from "node:path";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput, useStdin, useStdout } from "ink";
import { detectRepoRoot } from "../core/repo.js";
import { discoverFiles } from "../core/discover.js";
import { buildTree, flattenTree, toggleExpanded, toggleNode, type FlatNode } from "../core/tree.js";
import type { FileEntry, SelectedFile } from "../core/types.js";
import { copyToClipboard } from "../core/clipboard.js";
import { openPath } from "../core/openPath.js";
import { filterSourceFiles } from "../core/sourceFilter.js";
import { smartPickFiles, truncateText, type SampledFile } from "../core/sample.js";
import { buildClaudePrompt } from "../core/prompt.js";
import { ClaudeProvider } from "../providers/claude.js";
import { colors, computeTreeGuides } from "./theme.js";
import { Header } from "./components/Header.js";
import { Spinner } from "./components/Spinner.js";
import { KeyHints } from "./components/KeyHints.js";
import { StatusBar } from "./components/StatusBar.js";
import { SectionTitle } from "./components/SectionTitle.js";
import { TreeRow } from "./components/TreeRow.js";

type Props = {
  cwd: string;
  options: {
    root?: string;
    noGit?: boolean;
    maxBytes: number;
    maxFileChars: number;
    out?: string;
    provider: "claude";
  };
};

type Screen =
  | { id: "scan" }
  | { id: "quickpick" }
  | { id: "select" }
  | { id: "preflight"; totalBytes: number }
  | { id: "run"; mode: "smart" | "all" }
  | { id: "result" }
  | { id: "error"; message: string };

function fmtBytes(n: number): string {
  const kb = 1024;
  const mb = kb * 1024;
  if (n >= mb) return `${(n / mb).toFixed(1)} MB`;
  if (n >= kb) return `${(n / kb).toFixed(1)} KB`;
  return `${n} B`;
}

export default function App({ cwd, options }: Props) {
  const { exit } = useApp();
  const { setRawMode } = useStdin();
  const { stdout } = useStdout();
  const [dims, setDims] = useState<{ cols: number; rows: number }>(() => ({
    cols: stdout?.columns ?? 80,
    rows: stdout?.rows ?? 24,
  }));

  const [screen, setScreen] = useState<Screen>({ id: "scan" });

  const [rootAbs, setRootAbs] = useState<string>("");
  const [usedGit, setUsedGit] = useState<boolean>(false);

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [fileByRel, setFileByRel] = useState<Map<string, FileEntry>>(new Map());

  const [treeRoot, setTreeRoot] = useState<ReturnType<typeof buildTree> | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const [quickPickIdx, setQuickPickIdx] = useState<number>(0);

  const [cursor, setCursor] = useState<number>(0);
  const [filter, setFilter] = useState<string>("");
  const [filterMode, setFilterMode] = useState<boolean>(false);
  const [filterDraft, setFilterDraft] = useState<string>("");
  const [showAbs, setShowAbs] = useState<boolean>(true);

  const [result, setResult] = useState<string>("");
  const [resultScroll, setResultScroll] = useState<number>(0);
  const [statusLine, setStatusLine] = useState<string>("");

  const busyRef = useRef(false);

  useEffect(() => {
    if (!stdout) return;
    const onResize = () => setDims({ cols: stdout.columns ?? 80, rows: stdout.rows ?? 24 });
    onResize();
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  useEffect(() => {
    (async () => {
      try {
        const initialRoot = options.root ? path.resolve(options.root) : cwd;
        const { root, isGit } = await detectRepoRoot(initialRoot);
        setRootAbs(root);
        setStatusLine(`Discovering files in ${root}...`);
        const { files: discovered, usedGit } = await discoverFiles({
          rootAbs: root,
          useGit: !!isGit && !options.noGit,
        });
        setUsedGit(usedGit);
        setFiles(discovered);
        const map = new Map<string, FileEntry>();
        for (const f of discovered) map.set(f.relPath, f);
        setFileByRel(map);
        const tr = buildTree(root, discovered);
        setTreeRoot(tr);
        const sel = new Set<string>(discovered.map((f) => f.relPath));
        setSelectedFiles(sel);
        setCursor(0);
        setScreen({ id: "quickpick" });
        setStatusLine("");
      } catch (err: any) {
        setScreen({ id: "error", message: err?.message ?? String(err) });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flat: FlatNode[] = useMemo(() => {
    if (!treeRoot) return [];
    return flattenTree(treeRoot, selectedFiles, filter);
  }, [treeRoot, selectedFiles, filter]);

  const selectedStats = useMemo(() => {
    let count = 0;
    let bytes = 0;
    for (const rel of selectedFiles) {
      const f = fileByRel.get(rel);
      if (!f) continue;
      count++;
      bytes += f.sizeBytes;
    }
    return { count, bytes };
  }, [selectedFiles, fileByRel]);

  const viewHeight = Math.max(5, dims.rows - 4);
  const listStart = Math.max(0, Math.min(cursor - Math.floor(viewHeight / 2), Math.max(0, flat.length - viewHeight)));
  const listEnd = Math.min(flat.length, listStart + viewHeight);
  const visible = flat.slice(listStart, listEnd);

  const guides = useMemo(() => computeTreeGuides(visible), [visible]);

  useInput((input, key) => {
    if (screen.id === "scan") {
      if (input === "q") exit();
      return;
    }
    if (screen.id === "error") {
      if (input === "q" || key.escape || key.return) exit();
      return;
    }

    if (screen.id === "quickpick") {
      if (input === "q") { exit(); return; }
      if (key.upArrow || key.downArrow) {
        setQuickPickIdx((i) => (i === 0 ? 1 : 0));
        return;
      }
      if (key.return) {
        if (quickPickIdx === 0) {
          setSelectedFiles(filterSourceFiles(files));
        }
        setScreen({ id: "select" });
        return;
      }
      return;
    }

    if (filterMode) {
      if (key.escape) {
        setFilterMode(false);
        setFilterDraft(filter);
        return;
      }
      if (key.return) {
        setFilter(filterDraft);
        setFilterMode(false);
        setCursor(0);
        return;
      }
      if (key.backspace || key.delete) {
        setFilterDraft((s) => s.slice(0, -1));
        return;
      }
      if (input) {
        setFilterDraft((s) => s + input);
      }
      return;
    }

    if (screen.id === "select") {
      if (input === "q" || key.escape) {
        exit();
        return;
      }
      if (input === "/") {
        setFilterMode(true);
        setFilterDraft(filter);
        return;
      }
      if (input === "p") {
        setShowAbs((s) => !s);
        return;
      }
      if (key.upArrow) {
        setCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (key.downArrow) {
        setCursor((c) => Math.min(flat.length - 1, c + 1));
        return;
      }

      const focused = flat[cursor]?.node;
      if (!focused) return;

      if (key.leftArrow) {
        if (focused.kind === "dir" && focused.expanded) toggleExpanded(focused);
        else if (focused.relPath) {
          // jump to parent
          const parentRel = focused.relPath.includes("/") ? focused.relPath.split("/").slice(0, -1).join("/") : "";
          const parentIdx = flat.findIndex((n) => n.node.relPath === parentRel);
          if (parentIdx >= 0) setCursor(parentIdx);
        }
        setTreeRoot((r) => (r ? { ...r } : r));
        return;
      }
      if (key.rightArrow) {
        if (focused.kind === "dir") {
          if (!focused.expanded) toggleExpanded(focused);
          else {
            // move to first child
            const idx = flat.findIndex((n, i) => i > cursor && n.depth === flat[cursor]!.depth + 1);
            if (idx >= 0) setCursor(idx);
          }
          setTreeRoot((r) => (r ? { ...r } : r));
        }
        return;
      }
      if (input === "o") {
        if (busyRef.current) return;
        busyRef.current = true;
        void (async () => {
          try {
            setStatusLine(`Opening ${focused.absPath}...`);
            setRawMode?.(false);
            await openPath(focused.absPath);
          } catch (err: any) {
            setStatusLine(`Open failed: ${err?.message ?? String(err)}`);
          } finally {
            setRawMode?.(true);
            setStatusLine("");
            busyRef.current = false;
          }
        })();
        return;
      }
      if (key.return) {
        if (selectedStats.count === 0) {
          setStatusLine("Select at least one file.");
          return;
        }
        if (selectedStats.bytes > options.maxBytes) {
          setScreen({ id: "preflight", totalBytes: selectedStats.bytes });
        } else {
          setScreen({ id: "run", mode: "all" });
        }
        return;
      }
      if (input === " " && flat[cursor]) {
        const next = new Set(selectedFiles);
        toggleNode(flat[cursor]!.node, next);
        setSelectedFiles(next);
        return;
      }
      return;
    }

    if (screen.id === "preflight") {
      if (input === "b" || key.escape) {
        setScreen({ id: "select" });
        return;
      }
      if (input === "1" || key.return) {
        setScreen({ id: "run", mode: "smart" });
        return;
      }
      if (input === "2") {
        setScreen({ id: "run", mode: "all" });
        return;
      }
      return;
    }

    if (screen.id === "run") {
      if (input === "q") exit();
      return;
    }

    if (screen.id === "result") {
      if (input === "q" || key.escape) exit();
      if (input === "b") {
        setScreen({ id: "select" });
        return;
      }
      if (key.upArrow) {
        setResultScroll((s) => Math.max(0, s - 1));
        return;
      }
      if (key.downArrow) {
        setResultScroll((s) => s + 1);
        return;
      }
      if (input === "c") {
        if (busyRef.current) return;
        busyRef.current = true;
        void (async () => {
          try {
            await copyToClipboard(result);
            setStatusLine("Copied to clipboard.");
          } catch (err: any) {
            setStatusLine(`Copy failed: ${err?.message ?? String(err)}`);
          } finally {
            busyRef.current = false;
            setTimeout(() => setStatusLine(""), 1200);
          }
        })();
        return;
      }
      if (input === "s") {
        if (busyRef.current) return;
        busyRef.current = true;
        void (async () => {
          try {
            const outPath = options.out ? path.resolve(options.out) : path.join(rootAbs, "agentstyle.md");
            await fs.writeFile(outPath, result, "utf8");
            setStatusLine(`Saved to ${outPath}`);
          } catch (err: any) {
            setStatusLine(`Save failed: ${err?.message ?? String(err)}`);
          } finally {
            busyRef.current = false;
          }
        })();
        return;
      }
    }
  });

  useEffect(() => {
    if (screen.id !== "run") return;
    if (!rootAbs) return;

    let cancelled = false;
    void (async () => {
      try {
        setStatusLine("Preparing prompt...");

        const selected: SelectedFile[] = [];
        for (const rel of [...selectedFiles].sort()) {
          const f = fileByRel.get(rel);
          if (f) selected.push(f);
        }

        const picked =
          screen.mode === "smart"
            ? smartPickFiles(selected, { bucketLimit: 10, maxFileChars: options.maxFileChars })
            : selected;

        const sampled: SampledFile[] = [];
        for (let i = 0; i < picked.length; i++) {
          if (cancelled) return;
          const f = picked[i]!;
          setStatusLine(`Reading files ${i + 1}/${picked.length}...`);
          let content = "";
          try {
            content = await fs.readFile(f.absPath, "utf8");
          } catch {
            content = "[UNREADABLE FILE]";
          }
          const { text, truncated } = truncateText(content, options.maxFileChars);
          sampled.push({ ...f, content: text, truncated });
        }

        setStatusLine("Running Claude...");
        const provider = new ClaudeProvider();
        const prompt = buildClaudePrompt(sampled);
        let md = await provider.run(prompt);
        const trimmed = md.trimStart();
        if (!trimmed.startsWith("## Code Style")) {
          md = `## Code Style\n\n${trimmed}`;
        }
        if (cancelled) return;
        setResult(md.trimEnd() + "\n");
        setResultScroll(0);
        setScreen({ id: "result" });
        setStatusLine("");
      } catch (err: any) {
        if (cancelled) return;
        setScreen({ id: "error", message: err?.message ?? String(err) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [screen, rootAbs, selectedFiles, fileByRel, options.maxFileChars]);

  // ── Scan screen ────────────────────────────────────────────────
  if (screen.id === "scan") {
    return (
      <Box flexDirection="column">
        <Header cols={dims.cols} />
        <Spinner label="Scanning..." />
        {!!statusLine && <Text color={colors.textDim}>{statusLine}</Text>}
        <Text>{""}</Text>
        <KeyHints hints={[{ keys: "q", action: "quit" }]} />
      </Box>
    );
  }

  // ── Quick-pick screen ────────────────────────────────────────────
  if (screen.id === "quickpick") {
    const sourceSet = filterSourceFiles(files);
    const sourceCount = sourceSet.size;
    const sourceBytes = files.reduce((sum, f) => sourceSet.has(f.relPath) ? sum + f.sizeBytes : sum, 0);
    const allCount = files.length;
    const allBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);

    const options = [
      { label: "Source code only", count: sourceCount, bytes: sourceBytes },
      { label: "Customize", count: allCount, bytes: allBytes },
    ];

    return (
      <Box flexDirection="column">
        <Header cols={dims.cols} />
        <SectionTitle title="What should I analyze?" />
        <Text>{""}</Text>
        <Box flexDirection="column" paddingLeft={2}>
          {options.map((opt, i) => {
            const active = i === quickPickIdx;
            return (
              <Box key={i}>
                <Text color={active ? colors.brand : colors.textMuted}>
                  {active ? "❯ " : "  "}
                </Text>
                <Text color={active ? colors.text : colors.textDim} bold={active}>
                  {opt.label}
                </Text>
                <Text color={colors.textDim}>
                  {"  "}{opt.count} files · {fmtBytes(opt.bytes)}
                </Text>
              </Box>
            );
          })}
        </Box>
        <Text>{""}</Text>
        <KeyHints hints={[
          { keys: "↑/↓", action: "move" },
          { keys: "Enter", action: "select" },
          { keys: "q", action: "quit" },
        ]} />
      </Box>
    );
  }

  // ── Error screen ───────────────────────────────────────────────
  if (screen.id === "error") {
    return (
      <Box flexDirection="column">
        <SectionTitle title="Error" color={colors.error} />
        <Text>{""}</Text>
        <Box flexDirection="column" borderStyle="round" borderColor={colors.error} paddingX={1}>
          <Text color={colors.text}>{screen.message}</Text>
        </Box>
        <Text>{""}</Text>
        <KeyHints hints={[
          { keys: "Enter", action: "exit" },
          { keys: "q", action: "quit" },
        ]} />
      </Box>
    );
  }

  // ── Preflight screen ──────────────────────────────────────────
  if (screen.id === "preflight") {
    return (
      <Box flexDirection="column">
        <SectionTitle
          title="Size Warning"
          subtitle={`${fmtBytes(screen.totalBytes)} exceeds ${fmtBytes(options.maxBytes)} limit`}
          color={colors.warning}
        />
        <Text>{""}</Text>
        <Box flexDirection="column" paddingLeft={2}>
          <Text>
            <Text color={colors.accent} bold>1</Text>
            <Text color={colors.text}> Smart sample </Text>
            <Text color={colors.textDim}>(recommended)</Text>
          </Text>
          <Text>
            <Text color={colors.accent} bold>2</Text>
            <Text color={colors.text}> Continue anyway</Text>
          </Text>
          <Text>
            <Text color={colors.accent} bold>b</Text>
            <Text color={colors.text}> Go back</Text>
          </Text>
        </Box>
        <Text>{""}</Text>
        <Text color={colors.textDim}>Enter defaults to Smart sample.</Text>
      </Box>
    );
  }

  // ── Run screen ────────────────────────────────────────────────
  if (screen.id === "run") {
    const stages = ["Preparing", "Reading files", "Running Claude"];
    let activeStage = 0;
    if (statusLine.includes("Reading")) activeStage = 1;
    else if (statusLine.includes("Claude")) activeStage = 2;

    return (
      <Box flexDirection="column">
        <Header cols={dims.cols} />
        <SectionTitle
          title={screen.mode === "smart" ? "Smart Sampling" : "Analyzing"}
          subtitle={`${selectedStats.count} files`}
        />
        <Text>{""}</Text>
        <Box flexDirection="column" paddingLeft={2}>
          {stages.map((stage, i) => {
            const isDone = i < activeStage;
            const isActive = i === activeStage;
            return (
              <Box key={i}>
                {isDone && <Text color={colors.success}>✓ </Text>}
                {isActive && <Spinner />}
                {!isDone && !isActive && <Text color={colors.textMuted}>  </Text>}
                <Text color={isDone ? colors.success : isActive ? colors.text : colors.textMuted}>
                  {isDone || isActive ? " " : " "}{stage}
                </Text>
              </Box>
            );
          })}
        </Box>
        {!!statusLine && (
          <>
            <Text>{""}</Text>
            <Text color={colors.textDim}>{statusLine}</Text>
          </>
        )}
        <Text>{""}</Text>
        <KeyHints hints={[{ keys: "q", action: "quit" }]} />
      </Box>
    );
  }

  // ── Result screen ─────────────────────────────────────────────
  if (screen.id === "result") {
    const lines = result.split("\n");
    const maxScroll = Math.max(0, lines.length - viewHeight);
    const scroll = Math.max(0, Math.min(resultScroll, maxScroll));
    const slice = lines.slice(scroll, scroll + viewHeight);
    const scrollPct = maxScroll > 0 ? Math.round((scroll / maxScroll) * 100) : 100;

    return (
      <Box flexDirection="column">
        <Header cols={dims.cols} />
        <SectionTitle
          title="Result"
          subtitle={`${lines.length} lines${usedGit ? " · git" : ""} · ${rootAbs}`}
        />
        <Text>{""}</Text>
        <Box flexDirection="column" borderStyle="round" borderColor={colors.border} paddingX={1}>
          {slice.map((l, idx) => (
            <Text key={idx} color={colors.text}>
              {l.length > dims.cols - 4 ? l.slice(0, Math.max(0, dims.cols - 7)) + "..." : l}
            </Text>
          ))}
        </Box>
        <Text color={colors.textDim}> {scrollPct}%</Text>
        {!!statusLine && <Text color={colors.info}>{statusLine}</Text>}
        <Text>{""}</Text>
        <KeyHints hints={[
          { keys: "↑/↓", action: "scroll" },
          { keys: "c", action: "copy" },
          { keys: "s", action: "save" },
          { keys: "b", action: "back" },
          { keys: "q", action: "quit" },
        ]} />
      </Box>
    );
  }

  // ── Select screen ─────────────────────────────────────────────
  const filterLabel = filterMode ? filterDraft : filter;
  const pathMode = showAbs ? "abs" : "rel";

  return (
    <Box flexDirection="column">
      <Header cols={dims.cols} />
      <SectionTitle
        title="Select Files"
        subtitle={`${files.length} discovered${usedGit ? " · git" : ""} · paths: ${pathMode}`}
      />
      {filterLabel && (
        <Text>
          <Text color={colors.accent}>/</Text>
          <Text color={colors.textDim}> {filterLabel}</Text>
        </Text>
      )}
      <Text color={colors.textMuted}>{rootAbs}</Text>
      <Text>{""}</Text>
      <Box flexDirection="column" borderStyle="round" borderColor={colors.border} paddingX={1}>
        {visible.map((flatNode, idx) => {
          const absoluteIdx = listStart + idx;
          const isCursor = absoluteIdx === cursor;
          return (
            <TreeRow
              key={flatNode.node.relPath || "__root"}
              flatNode={flatNode}
              guide={guides[idx]!}
              isCursor={isCursor}
              showAbs={showAbs}
            />
          );
        })}
        {visible.length === 0 && <Text color={colors.textMuted}>(no matches)</Text>}
      </Box>
      <StatusBar
        left={`${selectedStats.count} files · ${fmtBytes(selectedStats.bytes)}`}
        center={statusLine || undefined}
      />
      <Text>{""}</Text>
      <KeyHints hints={[
        { keys: "↑/↓", action: "move" },
        { keys: "Space", action: "toggle" },
        { keys: "←/→", action: "collapse/expand" },
        { keys: "/", action: "filter" },
        { keys: "p", action: "paths" },
        { keys: "o", action: "open" },
        { keys: "Enter", action: "analyze" },
        { keys: "q", action: "quit" },
      ]} />
      {filterMode && (
        <Text>
          <Text color={colors.accent}>Filter: </Text>
          <Text color={colors.text}>type to filter, </Text>
          <Text color={colors.accent}>Enter</Text>
          <Text color={colors.text}> apply, </Text>
          <Text color={colors.accent}>Esc</Text>
          <Text color={colors.text}> cancel</Text>
        </Text>
      )}
    </Box>
  );
}
