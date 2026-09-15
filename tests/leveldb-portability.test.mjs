import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("shipped LevelDB CURRENT pointers retain exact LF-terminated manifest names", async () => {
  const manifest = JSON.parse(await readFile(new URL("system.json", root), "utf8"));
  for (const pack of manifest.packs) {
    const directory = new URL(`${pack.path}/`, root);
    const pointer = await readFile(new URL("CURRENT", directory), "utf8");
    assert.match(pointer, /^MANIFEST-\d+\n$/, `${pack.path}/CURRENT must have LF, not CRLF; Git must not transform database bytes`);
    await access(new URL(pointer.slice(0, -1), directory));
  }
});

test("Git disables text conversion throughout LevelDB directories", async () => {
  const attributes = await readFile(new URL(".gitattributes", root), "utf8");
  assert.match(attributes, /^packs\/\*\/\*\* -text$/m);
});
