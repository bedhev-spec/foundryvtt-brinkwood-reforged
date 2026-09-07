import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("sheet tabs and action surfaces expose keyboard semantics", async () => {
  const [character, mask, rebellion, npc, attributes, identityRow, portrait, baseSheet, actorSheet] = await Promise.all([
    read("templates/actor-sheet.html"), read("templates/mask-sheet.html"), read("templates/rebelion-sheet.html"), read("templates/npc-sheet.html"),
    read("templates/parts/attributes.html"), read("templates/parts/sheet-identity-row.html"),
    read("templates/parts/sheet-identity-portrait.html"), read("module/blades-sheet.js"), read("module/blades-actor-sheet.js"),
  ]);
  for (const template of [character, mask, rebellion]) {
    assert.match(template, /<button type="button"[^>]*role="tab"[^>]*tabindex="\{\{#if/);
    assert.doesNotMatch(template, /<a[^>]*role="tab"/);
  }
  assert.match(portrait, /data-action="editImage" data-edit="img" role="button" tabindex="0"/);
  assert.match(npc, /parts\/sheet-identity-portrait\.html/);
  assert.doesNotMatch(npc, /data-action="editImage"/);
  assert.match(identityRow, /<button type="button" class="item-body identity-choice__text/);
  assert.match(attributes, /<button type="button" class="attribute-label roll-die-attribute/);
  assert.match(attributes, /<button type="button" class="attribute-skill-label roll-die-attribute/);
  assert.match(baseSheet, /key === "Home"[\s\S]*?key === "End"[\s\S]*?key === "ArrowRight"[\s\S]*?key === "ArrowLeft"/);
  assert.match(baseSheet, /\[data-action="editImage"\]\[role="button"\]/);
  assert.match(actorSheet, /\.item-body\[role="button"\]/);
});
