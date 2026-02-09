import React from "react";
import { Text } from "ink";
import type { FlatNode } from "../../core/tree.js";
import type { TreeGuide } from "../theme.js";
import { colors, symbols } from "../theme.js";

type Props = {
  flatNode: FlatNode;
  guide: TreeGuide;
  isCursor: boolean;
  showAbs: boolean;
};

export function TreeRow({ flatNode, guide, isCursor, showAbs }: Props) {
  const { node, depth, check } = flatNode;

  // Checkbox symbol + color
  let checkChar: string;
  let checkColor: string;
  if (check === "checked") {
    checkChar = symbols.checkboxChecked;
    checkColor = colors.checked;
  } else if (check === "partial") {
    checkChar = symbols.checkboxPartial;
    checkColor = colors.partial;
  } else {
    checkChar = symbols.checkboxUnchecked;
    checkColor = colors.unchecked;
  }

  // Expand/collapse indicator for dirs
  let expandChar = " ";
  if (node.kind === "dir") {
    expandChar = node.expanded ? symbols.expandOpen : symbols.expandClosed;
  }

  // Tree branch
  const branch = depth > 0
    ? (guide.isLast ? symbols.treeLast : symbols.treeBranch) + " "
    : "";

  const displayPath = showAbs ? node.absPath : (node.relPath || node.name);

  // Cursor indicator
  const cursorChar = isCursor ? symbols.cursor + " " : "  ";

  return (
    <Text>
      <Text color={isCursor ? colors.brand : undefined}>{cursorChar}</Text>
      <Text color={colors.textMuted}>{guide.prefix}{branch}</Text>
      <Text color={checkColor}>{checkChar}</Text>
      <Text> </Text>
      {node.kind === "dir" ? (
        <>
          <Text color={colors.accent}>{expandChar}</Text>
          <Text> </Text>
          <Text color={colors.dirName} bold>{displayPath}</Text>
        </>
      ) : (
        <>
          <Text>{expandChar}</Text>
          <Text> </Text>
          <Text color={isCursor ? colors.accentBright : colors.fileName}>{displayPath}</Text>
        </>
      )}
    </Text>
  );
}
