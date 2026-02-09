import React from "react";
import { Text } from "ink";
import { colors } from "../theme.js";

type Hint = { keys: string; action: string };

type Props = {
  hints: Hint[];
};

export function KeyHints({ hints }: Props) {
  return (
    <Text>
      {hints.map((h, i) => (
        <Text key={i}>
          {i > 0 && <Text color={colors.textMuted}> · </Text>}
          <Text color={colors.accent}>{h.keys}</Text>
          <Text color={colors.textDim}> {h.action}</Text>
        </Text>
      ))}
    </Text>
  );
}
