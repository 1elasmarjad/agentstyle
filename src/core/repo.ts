import path from "node:path";
import { execa } from "execa";

export async function detectRepoRoot(cwd: string): Promise<{ root: string; isGit: boolean }> {
  try {
    const { stdout } = await execa("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      stdio: "pipe",
    });
    const root = stdout.trim();
    if (!root) return { root: path.resolve(cwd), isGit: false };
    return { root, isGit: true };
  } catch {
    return { root: path.resolve(cwd), isGit: false };
  }
}

