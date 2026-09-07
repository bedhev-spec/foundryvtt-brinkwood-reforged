import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Rebellion uses shared tabs and one scroll workspace", async () => {
  const template = await read("templates/rebelion-sheet.html");
  for (const tab of ["aspects", "territories", "conclave"]) assert.match(template, new RegExp(`data-tab="${tab}" data-group="primary"`));
  assert.match(template, /sheet-identity-portrait\.html/);
  assert.match(template, /sheet-identity-name\.html/);
  assert.match(template, /sheet-identity-tracker\.html/);
  assert.doesNotMatch(template, /sheet-notes|data-tab="effects"/);
});

test("Rebellion separates unbounded Tyranny from shared progress trackers", async () => {
  const [template, source, styles] = await Promise.all([read("templates/rebelion-sheet.html"), read("module/blades-rebelion-sheet.js"), read("scss/import/rebelion-sheet.scss")]);
  assert.match(template, /data-tyranny-input/);
  assert.match(source, /normalizeTyranny/);
  assert.match(styles, /\.rebelion-tyranny/);
  assert.match(template, /trackerPath="system\.heat\.value"/);
  assert.match(template, /trackerPath="system\.resupply\.value"/);
});

test("Rebellion controls are keyboard-safe and records remain explicit", async () => {
  const [template, aspect] = await Promise.all([read("templates/rebelion-sheet.html"), read("templates/rebelion-sheet/moot-section.html")]);
  assert.match(template, /data-underground-actor/);
  assert.match(template, /type="button" data-rebellion-action="going-underground"/);
  assert.match(aspect, /data-moot-choice/);
  assert.match(aspect, /type="button" data-rebellion-action="save-moot-answer"/);
  assert.match(aspect, /rebelion-moot__recorded/);
  assert.match(template, /RebellionLegacyLands/);
});
