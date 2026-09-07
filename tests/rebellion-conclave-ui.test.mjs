import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Rebellion Conclave presents full-width summary cards with a deliberate editor", async () => {
  const [template, styles] = await Promise.all([
    read("templates/rebelion-sheet.html"),
    read("scss/import/rebelion-sheet.scss"),
  ]);

  assert.match(template, /bw-section-frame bw-ruled-card--trait-palette rebelion-conclave/);
  assert.match(template, /bw-ruled-card__title-band rebelion-ally__summary/);
  assert.match(template, /class="rebelion-correction rebelion-ally__quick-remove"[^>]*data-rebellion-action="remove-ally"/);
  assert.match(template, /class="rebelion-ally__strengths"/);
  assert.match(template, /<details class="rebelion-ally__editor" data-ally-editor data-ally-id="\{\{id\}\}"\{\{#if editorOpen\}\} open\{\{\/if\}\}>/);
  assert.match(template, /class="bw-text-field"[^>]*data-ally-field="name"/);
  assert.match(template, /class="rebelion-ally__field-heading"[\s\S]*?<small>\{\{localize "BITD\.RebellionCommaSeparated"\}\}<\/small>[\s\S]*?data-ally-field="strengths"/);
  assert.match(styles, /\.rebelion-conclave__list\s*\{[\s\S]*?display:\s*grid;[\s\S]*?gap:\s*10px/);
  assert.match(styles, /\.rebelion-ally__fields\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
});

test("Conclave source Actor uses a picker, drop target, and functional link actions", async () => {
  const [template, source] = await Promise.all([
    read("templates/rebelion-sheet.html"),
    read("module/blades-rebelion-sheet.js"),
  ]);

  assert.doesNotMatch(template, /Source Actor UUID/);
  assert.match(template, /data-ally-actor-drop/);
  assert.match(template, /data-ally-source-select/);
  assert.match(template, /data-rebellion-action="open-ally-actor"/);
  assert.match(template, /data-rebellion-action="clear-ally-actor"/);
  assert.match(source, /actorUuidFromDrop/);
  assert.match(source, /resolveConclaveActor/);
  assert.match(source, /_setAllyActorUuid/);
  assert.match(source, /this\._openAllyEditors \?\?= new Set\(\);[\s\S]*?editorOpen: this\._openAllyEditors\.has\(ally\.id\)/);
  assert.match(source, /querySelectorAll\("\[data-ally-editor\]"\)[\s\S]*?addEventListener\("toggle"[\s\S]*?this\._openAllyEditors\.add\(editor\.dataset\.allyId\)/);
  assert.match(source, /async _setAllyActorUuid\(id, uuid\)[\s\S]*?this\._openAllyEditors\.add\(id\)/);
});
