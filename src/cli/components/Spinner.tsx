import React, { useEffect, useState } from "react";
import { Text } from "ink";
import { SPINNER_FRAMES, SPINNER_INTERVAL_MS, colors } from "../theme.js";

type Props = {
  label?: string;
  color?: string;
};

export function Spinner({ label, color = colors.brand }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % SPINNER_FRAMES.length);
    }, SPINNER_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <Text>
      <Text color={color}>{SPINNER_FRAMES[idx]}</Text>
      {label ? ` ${label}` : ""}
    </Text>
  );
}
