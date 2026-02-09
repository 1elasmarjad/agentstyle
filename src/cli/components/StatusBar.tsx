import React from "react";
import { Box, Text } from "ink";
import { colors } from "../theme.js";

type Props = {
  left?: string;
  center?: string;
  right?: string;
};

export function StatusBar({ left, center, right }: Props) {
  return (
    <Box flexDirection="column">
      <Text color={colors.borderDim}>{"─".repeat(40)}</Text>
      <Box justifyContent="space-between">
        <Text color={colors.textDim}>{left ?? ""}</Text>
        {center && <Text color={colors.info}>{center}</Text>}
        <Text color={colors.textDim}>{right ?? ""}</Text>
      </Box>
    </Box>
  );
}
