import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Character sheet supports a 700px maximum and 480px responsive minimum", async () => {
  const [controller, styles, tabs] = await Promise.all([
    read("module/blades-actor-sheet.js"),
    read("scss/import/character-sheet.scss"),
    read("scss/import/sheet-tabs.scss"),
  ]);

  assert.match(controller, /position:\s*\{\s*width:\s*700,\s*height:\s*1170\s*\}/);
  assert.match(controller, /window:\s*\{\s*resizable:\s*true\s*\}/);
  assert.match(styles, /&\s*\{[\s\S]*?min-width:\s*480px;[\s\S]*?max-width:\s*700px;[\s\S]*?min-height:\s*560px;[\s\S]*?max-height:\s*calc\(100vh - 32px\)/);
  assert.match(styles, /\.name-alias\s*\{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?align-self:\s*stretch;/);
  assert.match(styles, /@container \(max-width: 640px\)[\s\S]*?form\.actor-sheet\s*\{[\s\S]*?padding:\s*14px;[\s\S]*?\.name-alias\s*\{[\s\S]*?grid-template-columns:\s*minmax\(110px, 150px\) minmax\(0, 1fr\)/);
  assert.match(styles, /@container \(max-width: 480px\)[\s\S]*?\.name-alias\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)[\s\S]*?\.sheet-identity__portrait\s*\{[\s\S]*?grid-row:\s*1;[\s\S]*?\.name-alias > \.sheet-identity__details\s*\{[\s\S]*?grid-row:\s*2;[\s\S]*?\.name-alias > \.sheet-identity__trackers\s*\{[\s\S]*?grid-row:\s*3;/);
  assert.match(styles, /@container \(max-width: 480px\)[\s\S]*?\.name-alias > \.sheet-identity__trackers\s*\{[\s\S]*?margin-top:\s*10px;[\s\S]*?padding-bottom:\s*10px;/);
  assert.doesNotMatch(styles, /\* The selected value owns an inner action track[\s\S]*?\*\/\s*min-width:\s*0/);
  assert.match(styles, /@container \(max-width: 570px\)[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@container \(max-width: 430px\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(styles, /@container \(max-width: 760px\)[\s\S]*?\.bans-armor\s*\{[\s\S]*?overflow-x:\s*auto/);
  assert.match(tabs, /@container \(max-width: 480px\)[\s\S]*?\.sheet-tabs\s*\{[\s\S]*?overflow-x:\s*auto/);
  assert.match(styles, /@container \(max-width: 480px\)[\s\S]*?\.character-sheet__workspace > \.sheet-tabs\s*\{[\s\S]*?overflow-x:\s*hidden[\s\S]*?\.character-sheet__workspace > \.sheet-tabs > \.item\s*\{[\s\S]*?flex:\s*1 1 0;[\s\S]*?padding-inline:\s*6px/);
});
