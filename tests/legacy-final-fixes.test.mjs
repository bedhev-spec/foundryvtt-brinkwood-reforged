import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Legacy XP updates and framing remain blue", async () => {
  const [controller, template, styles] = await Promise.all([
    read("module/blades-actor-sheet.js"),
    read("templates/actor-sheet.html"),
    read("scss/import/legacy-character-effects.scss")
  ]);

  assert.match(controller, /closest\?\.\("\.character-xp, \.character-stress"\)/);
  assert.match(controller, /classList\.contains\("character-xp"\) \? "blue" : "red"/);
  assert.match(template, /big-teeth-section character-xp-section/);
  assert.match(styles, /\.character-xp-section\s*\{[\s\S]*?border-color:\s*#315f82/);
});

test("Shared primary tabs receive their final equal-width layout from the base stylesheet", async () => {
  const [source, sharedTabs, compiled] = await Promise.all([
    read("scss/import/character-sheet.scss"),
    read("scss/import/sheet-tabs.scss"),
    read("styles/blades.css")
  ]);

  assert.match(source, /\.character-sheet__workspace[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  for (const styles of [sharedTabs, compiled]) {
    assert.match(styles, /\.sheet-tabs \.item\s*\{[\s\S]*?flex:\s*1 1 0[\s\S]*?min-width:\s*0/);
  }
});

test("Character sheets override shared bounded tabs with one form scroller", async () => {
 const [styles, tabStyles] = await Promise.all([
   read("scss/import/character-sheet.scss"),
   read("scss/import/sheet-tabs.scss"),
 ]);

 assert.match(styles, /form\.actor-sheet\s*\{[\s\S]*?display:\s*flex[\s\S]*?overflow-y:\s*auto/);
 assert.match(styles, /character-sheet__workspace\s*\{[\s\S]*?grid-template-rows:\s*auto auto[\s\S]*?overflow:\s*visible/);
  assert.match(styles, /character-sheet__workspace > \.tab-content\s*\{[\s\S]*?height:\s*auto[\s\S]*?overflow:\s*visible/);
  assert.match(tabStyles, /> \.tab\.active\s*\{[\s\S]*?overflow-y:\s*auto[\s\S]*?scrollbar-gutter:\s*stable[\s\S]*?scrollbar-width:\s*thin/);
});

test("Legacy sheets reset to Traits only when genuinely closed", async () => {
  const controller = await read("module/blades-actor-sheet.js");

  assert.match(controller, /async close\(options = \{\}\)[\s\S]*?this\._sheetViewState = undefined[\s\S]*?this\.tabGroups\.primary = "traits"[\s\S]*?super\.close\(options\)/);
});

test("Bans and Armor content meets the lower frame without excess parchment space", async () => {
  const styles = await read("scss/import/character-sheet.scss");

  assert.match(styles, /\.bans-armor\s*\{[\s\S]*?padding:\s*0/);
});
