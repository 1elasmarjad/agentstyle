import { execa } from "execa";

export async function copyToClipboard(text: string): Promise<void> {
  const plat = process.platform;
  if (plat === "darwin") {
    await execa("pbcopy", [], { input: text });
    return;
  }
  if (plat === "win32") {
    await execa("clip", [], { input: text });
    return;
  }

  // linux / other unix: try wl-copy then xclip
  try {
    await execa("wl-copy", [], { input: text });
    return;
  } catch {
    // ignore
  }

  await execa("xclip", ["-selection", "clipboard"], { input: text });
}

