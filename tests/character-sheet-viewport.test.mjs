import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Character sheet keeps fixed window chrome and one form scroll surface", async () => {
  const [controller, styles, compiled] = await Promise.all([
    read("module/blades-actor-sheet.js"),
    read("scss/import/character-sheet.scss"),
    read("styles/blades.css"),
  ]);

  assert.match(controller, /position:\s*\{\s*width:\s*700,\s*height:\s*1170\s*\}/);
  assert.match(styles, /\.window-content\s*\{[\s\S]*?overflow-y:\s*hidden/);
  assert.match(styles, /form\.actor-sheet\s*\{[\s\S]*?display:\s*flex[\s\S]*?flex-direction:\s*column[\s\S]*?overflow-y:\s*auto[\s\S]*?overscroll-behavior:\s*contain/);
  assert.match(compiled, /\.brinkwood\.actor\.pc\.character form\.actor-sheet\s*\{[\s\S]*?display:\s*flex[\s\S]*?overflow-y:\s*auto/);
});

test("Character panels expand under sticky tabs at every viewport height", async () => {
  const [styles, compiled] = await Promise.all([
    read("scss/import/character-sheet.scss"),
    read("styles/blades.css"),
  ]);

  assert.match(styles, /character-sheet__workspace > \.sheet-tabs\s*\{[\s\S]*?position:\s*sticky[\s\S]*?top:\s*0/);
  assert.match(styles, /character-sheet__workspace\s*\{[\s\S]*?height:\s*auto[\s\S]*?grid-template-rows:\s*auto auto[\s\S]*?overflow:\s*visible/);
  assert.match(styles, /character-sheet__workspace > \.tab-content\s*\{[\s\S]*?grid-template-rows:\s*auto[\s\S]*?height:\s*auto[\s\S]*?overflow:\s*visible/);
  assert.match(styles, /\.tab\[data-tab\]\.active\s*\{[\s\S]*?height:\s*auto[\s\S]*?overflow:\s*visible/);
  assert.doesNotMatch(styles, /@media\s*\(max-height:\s*1201px\)/);
  assert.match(compiled, /character-sheet__workspace > \.sheet-tabs\s*\{[\s\S]*?position:\s*sticky/);
  assert.doesNotMatch(compiled, /@media\s*\(max-height:\s*1201px\)/);
});
