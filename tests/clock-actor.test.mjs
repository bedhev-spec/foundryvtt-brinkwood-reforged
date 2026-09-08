import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");

globalThis.foundry = {
  applications: {
    api: { HandlebarsApplicationMixin: Base => Base },
    sheets: { ActorSheetV2: class { async _onRender() {} async _onClose() {} } },
  },
};

const { BladesClockSheet } = await import("../module/blades-clock-sheet.js");

test("Clock actor is registered as a standalone v13 Actor type", async () => {
  const [bootstrap, schemaSource, legacyTemplate] = await Promise.all([
    read("module/blades.js"),
    read("module/data/actor-data-models.js"),
    read("template.json"),
  ]);
  const template = JSON.parse(legacyTemplate);

  assert.match(schemaSource, /export class ClockData extends TypeDataModel/);
  assert.match(schemaSource, /type: new fields\.NumberField\([\s\S]*?choices: \[4, 6, 8\]/);
  assert.match(schemaSource, /value: new fields\.NumberField\([\s\S]*?min: 0, max: 8/);
  assert.match(bootstrap, /"clock":\s+ClockData/);
  assert.match(bootstrap, /BladesClockSheet, \{ types: \["clock"\], makeDefault: true \}/);
  assert.deepEqual(template.Actor.types, ["character", "clock", "npc", "mask", "rebelion"]);
  assert.deepEqual(template.Actor.clock, { type: 4, value: 0 });
});

test("Clock sheet retains ApplicationV2 lifecycle and one serialized clock persistence path", async () => {
  const source = await read("module/blades-clock-sheet.js");

  assert.match(source, /static DEFAULT_OPTIONS/);
  assert.match(source, /form: \{ closeOnSubmit: false, submitOnChange: false \}/);
  assert.match(source, /static PARTS[\s\S]*?scrollable: \[""\]/);
  assert.match(source, /async _prepareContext\(options\)/);
  assert.match(source, /async _onRender\(context, options\)/);
  assert.match(source, /_clockSheetListenerController\?\.abort\(\)/);
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /queueDocumentPathUpdate\(this\.document, "clock"/);
  assert.match(source, /input\[name="system\.value"\], select\[name="system\.type"\]/);
  assert.match(source, /path !== "system\.type" && path !== "system\.value"/);
  assert.doesNotMatch(source, /defaultOptions|getData\(|activateListeners|_updateObject/);
  assert.doesNotMatch(source, /global-clock-utils|nextGlobalClockValue|GLOBAL_CLOCK_FACE_BACKGROUND/);
});

test("Clock persistence clamps the selected size, synchronizes artwork, and rejects locked writes", async () => {
  const updates = [];
  const document = {
    system: { type: 4, value: 0 },
    getActiveTokens: () => [],
    update: async update => {
      updates.push(update);
      document.system.type = update["system.type"];
      document.system.value = update["system.value"];
    },
  };
  const sheet = Object.assign(Object.create(BladesClockSheet.prototype), { isEditable: true, document });

  assert.equal(await sheet._persistClock({ type: 6, value: 9 }), true);
  assert.deepEqual(updates, [{
    "system.type": 6,
    "system.value": 6,
    img: "systems/brinkwood-reforged/styles/assets/progressclocks-svg/Progress Clock 6-6.svg",
    "prototypeToken.texture.src": "systems/brinkwood-reforged/styles/assets/progressclocks-svg/Progress Clock 6-6.svg",
  }]);

  sheet.isEditable = false;
  assert.equal(await sheet._persistClock({ type: 8, value: 1 }), false);
  assert.equal(updates.length, 1);
});

test("Clock template retains the legacy direct segmented SVG control with accessible reset", async () => {
  const [template, locale] = await Promise.all([
    read("templates/clock-sheet.html"),
    read("lang/en.json"),
  ]);
  const messages = JSON.parse(locale);

  assert.match(template, /<form class="\{\{cssClass\}\} clock-block clock-sheet" autocomplete="off">/);
  assert.doesNotMatch(template, /<form[^>]*\sstyle=/);
  assert.match(template, /class="clock-sheet__identity bw-section-frame"/);
  assert.match(template, /class="clocks clocks-\{\{system\.type\}\}"/);
  assert.match(template, /\{\{\{blades-clock "system\.value" system\.type system\.value _id/);
  assert.match(template, /<select id="clock-\{\{_id\}\}-size" name="system.type"/);
  assert.match(template, /value="4"[\s\S]*?value="6"[\s\S]*?value="8"/);
  assert.equal(messages["BITD.Clock.Progress"], "Clock progress");
  assert.doesNotMatch(template, /global-clock/);
});

test("Clock sheet owns the legacy 200px direct-segment geometry without global overlay dependencies", async () => {
  const [scss, entrypoint, css] = await Promise.all([
    read("scss/import/clock-sheet.scss"),
    read("scss/style.scss"),
    read("styles/blades.css"),
  ]);

  assert.match(entrypoint, /&\.actor\.clock\s*\{\s*@import 'import\/clock-sheet\.scss';/);
  assert.match(scss, /form\.clock-sheet[\s\S]*?min-height: 320px/);
  assert.match(scss, /overflow: auto/);
  assert.match(scss, /&\.clocks-4 \{ @include clock\(4, 200\); \}/);
  assert.match(scss, /&\.clocks-6 \{ @include clock\(6, 200\); \}/);
  assert.match(scss, /&\.clocks-8 \{ @include clock\(8, 200\); \}/);
  assert.doesNotMatch(scss, /global-clock/);
  assert.match(css, /\.brinkwood\.actor\.clock form\.clock-sheet \.clocks\.clocks-4 \.blades-clock/);
  assert.match(css, /width: 200px/);
  assert.doesNotMatch(css.match(/\.brinkwood\.actor\.clock[\s\S]{0,5000}/)?.[0] ?? "", /global-clock/);
});
