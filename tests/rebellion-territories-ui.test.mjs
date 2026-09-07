import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Rebellion Territories uses full-width aligned settlement records", async () => {
  const [sheet, section, styles] = await Promise.all([
    read("templates/rebelion-sheet.html"),
    read("templates/rebelion-sheet/sedition-section.html"),
    read("scss/import/rebelion-sheet.scss"),
  ]);

  assert.match(sheet, /class="rebelion-sheet__panel-stack rebelion-territories"/);
  assert.match(section, /bw-section-frame bw-ruled-card--trait-palette rebelion-settlements/);
  assert.match(section, /class="rebelion-settlement__identity"/);
  assert.match(section, /class="rebelion-settlement__status"/);
  assert.match(section, /data-rebellion-action="undo-territory-level"/);
  assert.match(sheet, /canCorrectTerritory=rebellion\.canCorrectTerritory/);
  assert.match(styles, /\.rebelion-settlement\s*\{[\s\S]*?grid-template-columns:\s*minmax\(150px, \.42fr\) minmax\(360px, 1fr\)/);
  assert.match(styles, /\.rebelion-settlement__trackers\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@container \(max-width: 520px\)[\s\S]*?\.rebelion-settlement__trackers\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
});

test("Territory paths remain stable and legacy Lands stay visibly secondary", async () => {
  const [sheet, section, styles] = await Promise.all([
    read("templates/rebelion-sheet.html"),
    read("templates/rebelion-sheet/sedition-section.html"),
    read("scss/import/rebelion-sheet.scss"),
  ]);

  assert.match(section, /rebellion\.location\." collection "\." index "\.clock/);
  assert.match(section, /rebellion\.location\." collection "\." index "\.level/);
  assert.match(sheet, /class="rebelion-legacy"[\s\S]*?RebellionLegacyLandsHint[\s\S]*?label="BITD\.Lands"/);
  assert.match(styles, /\.rebelion-legacy\s*\{[\s\S]*?border:\s*1px dashed var\(--bw-rule\)/);
});
