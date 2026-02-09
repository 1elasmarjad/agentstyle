import fs from "node:fs/promises";
import path from "node:path";

const binPath = path.resolve("dist/bin/agentstyle.js");

try {
  const txt = await fs.readFile(binPath, "utf8");
  if (!txt.startsWith("#!")) {
    await fs.writeFile(binPath, "#!/usr/bin/env node\n" + txt, "utf8");
  }
  await fs.chmod(binPath, 0o755);
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(`postbuild: failed to patch shebang for ${binPath}`);
  // eslint-disable-next-line no-console
  console.error(err?.message ?? String(err));
  process.exit(1);
}
