import React from "react";
import { Box, Text } from "ink";
import { colors } from "../theme.js";

type Props = {
  title: string;
  subtitle?: string;
  color?: string;
};

export function SectionTitle({ title, subtitle, color = colors.brand }: Props) {
  return (
    <Box>
      <Text color={color} bold>{title}</Text>
      {subtitle && <Text color={colors.textDim}> {subtitle}</Text>}
    </Box>
  );
}
