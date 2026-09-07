import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  SHEET_TYPES,
  SHEET_WIDTHS,
  sheetMarkup,
} from "./browser/sheet-geometry-cases.mjs";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("browser geometry matrix covers production sheet roots at release widths", async () => {
  const manifest = JSON.parse(await read("tests/browser/manifest.json"));
  const geometry = manifest.geometryFixtures.find(entry => entry.path === "tests/browser/sheet-geometry-fixture.html");

  assert.deepEqual(SHEET_WIDTHS, [700, 480, 410]);
  assert.deepEqual(SHEET_TYPES, ["character", "mask", "rebelion", "npc", "item-modern", "item-legacy"]);
  assert.equal(geometry?.resultElement, "#sheet-geometry-results");

  for (const type of SHEET_TYPES) {
    const markup = sheetMarkup(type);
    assert.ok(markup.includes('class="window-content"'), `${type} includes the ApplicationV2 content wrapper`);
    assert.ok(markup.includes("fixture-focus"), `${type} includes a keyboard-focus target`);
    assert.ok(markup.includes("fixture-bottom"), `${type} includes a reachable end control`);
  }

  const character = sheetMarkup("character");
  assert.ok(character.includes('class="editable actor-sheet character-sheet"'));
  assert.ok(character.includes('class="character-sheet__workspace sheet-tab-workspace"'));
  assert.ok(character.includes('class="tab-content sheet-tab-content flex-vertical grow-two"'));
  assert.ok(character.includes('class="fixture-focus loadout-item-open"'));

  const mask = sheetMarkup("mask");
  assert.ok(mask.includes('class="editable actor-sheet mask-sheet"'));
  assert.ok(mask.includes('class="mask-sheet__main sheet-tab-workspace"'));
  assert.ok(mask.includes('class="mask-sheet__tab-content sheet-tab-content"'));
  const rebellion = sheetMarkup("rebelion");
  assert.ok(rebellion.includes('class="editable actor-sheet rebelion-sheet__form"'));
  assert.ok(rebellion.includes('class="sheet-tab-workspace rebelion-sheet__workspace"'));
  assert.ok(rebellion.includes('data-tab="territories"'));
  assert.ok(rebellion.includes('data-tab="conclave"'));
  assert.ok(rebellion.includes("rebelion-sheet__status-line"));
  assert.ok(rebellion.includes("rebelion-settlement__trackers"));
  assert.ok(rebellion.includes("rebelion-conclave__header"));
  assert.ok(sheetMarkup("npc").includes('class="editable actor-sheet npc-dossier"'));
  assert.ok(sheetMarkup("npc").includes('class="npc-dossier__editors"'));
  assert.ok(sheetMarkup("npc").includes('class="tabs sheet-tabs npc-dossier__editor-tabs"'));

  assert.ok(sheetMarkup("item-modern").includes('class="editable loadout-item-sheet"'));
  assert.ok(sheetMarkup("item-legacy").includes('class="editable legacy-item-sheet"'));
  assert.throws(() => sheetMarkup("unknown"), /Unknown sheet fixture type/);
});

test("browser geometry fixture executes every scroll, containment, reachability, and focus check", async () => {
  const source = await read("tests/browser/sheet-geometry-fixture.mjs");
  for (const check of [
    "verticalOwner",
    "singleVerticalOwner",
    "noHorizontalOverflow",
    "reachable",
    "npcSectionsDoNotCollapse",
    "visibleFocus",
  ]) {
    assert.ok(source.includes(check), `fixture measures ${check}`);
  }
  assert.ok(source.includes("focusVisible: true"), "fixture requests keyboard-visible programmatic focus");
});
