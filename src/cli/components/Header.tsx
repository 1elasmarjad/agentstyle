import React from "react";
import { Box, Text } from "ink";
import { ASCII_HEADER_LINES, ASCII_HEADER_COMPACT, HEADER_GRADIENT, TAGLINE, colors } from "../theme.js";

type Props = {
  cols?: number;
};

export function Header({ cols = 80 }: Props) {
  if (cols < 50) {
    return (
      <Box>
        <Text color={colors.brand} bold>{ASCII_HEADER_COMPACT}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {ASCII_HEADER_LINES.map((line, i) => (
        <Text key={i} color={HEADER_GRADIENT[i]} bold>{line}</Text>
      ))}
      <Text color={colors.textDim}>  {TAGLINE}</Text>
      <Text>{""}</Text>
    </Box>
  );
}
