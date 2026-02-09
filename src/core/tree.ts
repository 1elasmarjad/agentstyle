import path from "node:path";
import type { FileEntry } from "./types.js";

export type NodeKind = "dir" | "file";

export type TreeNode = {
  kind: NodeKind;
  name: string;
  relPath: string; // "" for root
  absPath: string;
  children?: TreeNode[];
  expanded?: boolean;
};

export type CheckState = "checked" | "unchecked" | "partial";

export type FlatNode = {
  node: TreeNode;
  depth: number;
  check: CheckState;
};

export function buildTree(rootAbs: string, files: FileEntry[]): TreeNode {
  const root: TreeNode = {
    kind: "dir",
    name: path.basename(rootAbs) || rootAbs,
    relPath: "",
    absPath: rootAbs,
    expanded: true,
    children: [],
  };

  // Directory map keyed by relPath
  const dirMap = new Map<string, TreeNode>();
  dirMap.set("", root);

  for (const f of files) {
    const parts = f.relPath.split("/").filter(Boolean);
    let curRel = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const nextRel = curRel ? `${curRel}/${part}` : part;
      const isLeaf = i === parts.length - 1;

      if (isLeaf) {
        const parent = dirMap.get(curRel)!;
        parent.children ??= [];
        parent.children.push({
          kind: "file",
          name: part,
          relPath: nextRel,
          absPath: f.absPath,
        });
      } else {
        if (!dirMap.has(nextRel)) {
          const parent = dirMap.get(curRel)!;
          parent.children ??= [];
          const dirNode: TreeNode = {
            kind: "dir",
            name: part,
            relPath: nextRel,
            absPath: path.join(rootAbs, nextRel),
            expanded: false,
            children: [],
          };
          parent.children.push(dirNode);
          dirMap.set(nextRel, dirNode);
        }
      }

      curRel = nextRel;
    }
  }

  sortTree(root);
  return root;
}

function sortTree(node: TreeNode): void {
  if (!node.children) return;
  node.children.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const c of node.children) sortTree(c);
}

export function computeCheckState(node: TreeNode, selectedFiles: Set<string>): CheckState {
  if (node.kind === "file") return selectedFiles.has(node.relPath) ? "checked" : "unchecked";
  const children = node.children ?? [];
  if (children.length === 0) return "unchecked";
  let checked = 0;
  let unchecked = 0;
  for (const c of children) {
    const st = computeCheckState(c, selectedFiles);
    if (st === "partial") return "partial";
    if (st === "checked") checked++;
    else unchecked++;
  }
  if (checked === children.length) return "checked";
  if (unchecked === children.length) return "unchecked";
  return "partial";
}

export function toggleNode(node: TreeNode, selectedFiles: Set<string>): void {
  if (node.kind === "file") {
    if (selectedFiles.has(node.relPath)) selectedFiles.delete(node.relPath);
    else selectedFiles.add(node.relPath);
    return;
  }
  const current = computeCheckState(node, selectedFiles);
  const shouldSelect = current !== "checked";
  for (const file of iterFiles(node)) {
    if (shouldSelect) selectedFiles.add(file.relPath);
    else selectedFiles.delete(file.relPath);
  }
}

export function toggleExpanded(node: TreeNode): void {
  if (node.kind !== "dir") return;
  node.expanded = !node.expanded;
}

function* iterFiles(node: TreeNode): Generator<TreeNode, void, void> {
  if (node.kind === "file") {
    yield node;
    return;
  }
  for (const c of node.children ?? []) {
    yield* iterFiles(c);
  }
}

export function flattenTree(
  root: TreeNode,
  selectedFiles: Set<string>,
  filter: string,
): FlatNode[] {
  const f = filter.trim().toLowerCase();
  const out: FlatNode[] = [];
  const memo = new Map<string, CheckState>();

  const check = (n: TreeNode): CheckState => {
    const k = n.relPath;
    const cached = memo.get(k);
    if (cached) return cached;
    let st: CheckState;
    if (n.kind === "file") st = selectedFiles.has(n.relPath) ? "checked" : "unchecked";
    else {
      const children = n.children ?? [];
      if (children.length === 0) st = "unchecked";
      else {
        let checked = 0;
        let unchecked = 0;
        let partial = 0;
        for (const c of children) {
          const cst = check(c);
          if (cst === "partial") partial++;
          else if (cst === "checked") checked++;
          else unchecked++;
        }
        if (partial > 0) st = "partial";
        else if (checked === children.length) st = "checked";
        else if (unchecked === children.length) st = "unchecked";
        else st = "partial";
      }
    }
    memo.set(k, st);
    return st;
  };

  const matches = (n: TreeNode) => {
    if (!f) return true;
    const p = n.relPath ? n.relPath : n.absPath;
    return p.toLowerCase().includes(f);
  };

  const subtreeHasMatch = (n: TreeNode): boolean => {
    if (matches(n)) return true;
    for (const c of n.children ?? []) {
      if (subtreeHasMatch(c)) return true;
    }
    return false;
  };

  const walk = (n: TreeNode, depth: number) => {
    if (f && !subtreeHasMatch(n)) return;
    out.push({ node: n, depth, check: check(n) });

    if (n.kind !== "dir") return;
    const shouldExpand = f ? true : !!n.expanded;
    if (!shouldExpand) return;
    for (const c of n.children ?? []) walk(c, depth + 1);
  };

  walk(root, 0);
  return out;
}
