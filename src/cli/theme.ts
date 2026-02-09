import type { FlatNode } from "../core/tree.js";

// ── Color palette ──────────────────────────────────────────────────
export const colors = {
  brand: "#a78bfa",        // violet — headers, ASCII art, cursor
  accent: "#818cf8",       // indigo — active items, key hints
  accentBright: "#c4b5fd", // focused items
  success: "#34d399",      // emerald — checked items, completion
  warning: "#fbbf24",      // amber — preflight, partial checkbox
  error: "#f87171",        // red — errors
  info: "#60a5fa",         // blue — informational

  text: "#e2e8f0",
  textDim: "#94a3b8",
  textMuted: "#64748b",

  border: "#6366f1",
  borderDim: "#4338ca",

  dirName: "#818cf8",
  fileName: "#e2e8f0",

  checked: "#34d399",
  unchecked: "#64748b",
  partial: "#fbbf24",
} as const;

// ── Unicode symbols ────────────────────────────────────────────────
export const symbols = {
  checkboxChecked: "✓",
  checkboxUnchecked: "○",
  checkboxPartial: "◐",

  treeBranch: "├──",
  treeLast: "└──",
  treePipe: "│",
  treeBlank: "   ",

  expandOpen: "▾",
  expandClosed: "▸",

  cursor: "❯",
} as const;

// ── Braille spinner frames ─────────────────────────────────────────
export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
export const SPINNER_INTERVAL_MS = 80;

// ── ASCII art header (half-block font, 2 lines) ───────────────────
export const ASCII_HEADER_LINES = [
  "  ▄▀█ █▀▀ █▀▀ █▄░█ ▀█▀   █▀ ▀█▀ █▄█ █░░ █▀▀",
  "  █▀█ █▄█ ██▄ █░▀█ ░█░   ▄█ ░█░ ░█░ █▄▄ ██▄",
] as const;

// Gradient colors top→bottom
export const HEADER_GRADIENT = ["#c4b5fd", "#a78bfa"] as const;

export const ASCII_HEADER_COMPACT = "◆ agentstyle";

export const TAGLINE = "Teach AI your coding style.";

// ── Tree guide computation ─────────────────────────────────────────
export type TreeGuide = {
  prefix: string;
  isLast: boolean;
};

/**
 * Computes tree guide strings for a visible slice of FlatNodes.
 * For each node, determines whether it is the last sibling at its depth
 * and builds the prefix string from ancestor "isLast" info.
 */
export function computeTreeGuides(visible: FlatNode[]): TreeGuide[] {
  const guides: TreeGuide[] = [];

  for (let i = 0; i < visible.length; i++) {
    const { depth } = visible[i]!;

    // A node is "last" if no subsequent node at the same depth exists
    // before the next node at a shallower depth (or end of list).
    let isLast = true;
    for (let j = i + 1; j < visible.length; j++) {
      const d = visible[j]!.depth;
      if (d < depth) break;   // went up — no sibling found
      if (d === depth) {
        isLast = false;        // found a sibling
        break;
      }
    }

    // Build prefix by checking ancestor "isLast" at each depth level.
    // We look backwards for the last node we saw at each depth < current.
    let prefix = "";
    for (let d = 1; d < depth; d++) {
      // Find the last node before `i` at depth `d`
      let ancestorIsLast = true;
      for (let k = i - 1; k >= 0; k--) {
        if (visible[k]!.depth === d) {
          // Check if that ancestor is last among its siblings
          let aLast = true;
          for (let m = k + 1; m < visible.length; m++) {
            const md = visible[m]!.depth;
            if (md < d) break;
            if (md === d) { aLast = false; break; }
          }
          ancestorIsLast = aLast;
          break;
        }
        if (visible[k]!.depth < d) break;
      }
      prefix += ancestorIsLast ? symbols.treeBlank + " " : symbols.treePipe + "   ";
    }

    guides.push({ prefix, isLast });
  }

  return guides;
}
