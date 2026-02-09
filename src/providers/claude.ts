import { execa } from "execa";
import type { Provider } from "./types.js";

export class ClaudeProvider implements Provider {
  id = "claude";

  async run(prompt: string): Promise<string> {
    try {
      const { stdout } = await execa("claude", ["-p", prompt], {
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 50 * 1024 * 1024,
      });
      return stdout;
    } catch (err: any) {
      const stderr = (err?.stderr ?? "").toString();
      const msg = stderr.trim() ? stderr.trim() : (err?.message ?? "Claude CLI failed");
      const e = new Error(msg);
      (e as any).code = err?.code;
      throw e;
    }
  }
}

