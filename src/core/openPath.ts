import { execa, execaCommand } from "execa";

function quoteForShell(s: string): string {
  // Very small quoting helper for shell=true fallbacks.
  if (process.platform === "win32") return `"${s.replaceAll('"', '""')}"`;
  return `'${s.replaceAll("'", `'\\''`)}'`;
}

export async function openPath(absPath: string): Promise<void> {
  const editor = process.env.EDITOR?.trim();
  if (editor) {
    try {
      await execa(editor, [absPath], { stdio: "inherit" });
      return;
    } catch (err: any) {
      if (err?.code !== "ENOENT") throw err;
      // If EDITOR includes args, try shell mode.
      await execaCommand(`${editor} ${quoteForShell(absPath)}`, { stdio: "inherit", shell: true });
      return;
    }
  }

  if (process.platform === "darwin") {
    await execa("open", [absPath], { stdio: "ignore" });
    return;
  }
  if (process.platform === "win32") {
    await execa("cmd", ["/c", "start", "", absPath], { stdio: "ignore" });
    return;
  }

  await execa("xdg-open", [absPath], { stdio: "ignore" });
}

