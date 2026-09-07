import { mkdtemp, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cssContentsMatch } from "./css-parity.mjs";

const directory = await mkdtemp(join(tmpdir(), "brinkwood-css-"));
const output = join(directory, "blades.css");

try {
  const result = spawnSync(process.execPath, [
    "node_modules/sass/sass.js",
    "--no-source-map",
    "scss/style.scss",
    output,
  ], { stdio: "inherit" });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  else {
    const [generated, committed] = await Promise.all([
      readFile(output),
      readFile("styles/blades.css"),
    ]);
    if (!cssContentsMatch(generated, committed)) {
      throw new Error("styles/blades.css is stale; run npm run build:css.");
    }
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
