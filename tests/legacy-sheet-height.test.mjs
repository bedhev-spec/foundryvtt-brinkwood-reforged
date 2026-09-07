import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Legacy actor sheet keeps the Notes-sized bounded ApplicationV2 frame", async () => {
  const [character, styles, tabStyles] = await Promise.all([
    read("module/blades-actor-sheet.js"),
    read("scss/import/character-sheet.scss"),
    read("scss/import/sheet-tabs.scss"),
  ]);

 assert.match(character, /position:\s*\{\s*width:\s*700,\s*height:\s*1170\s*\}/);
 assert.doesNotMatch(character, /position:\s*\{[^}]*height:\s*["']auto["']/);
 assert.match(styles, /max-height:\s*calc\(100vh - 32px\)/);
  assert.match(styles, /character-sheet__workspace > \.tab-content\s*\{[\s\S]*?overflow:\s*hidden/);
  assert.match(tabStyles, /> \.tab\.active\s*\{[\s\S]*?overflow-y:\s*auto/);
});
