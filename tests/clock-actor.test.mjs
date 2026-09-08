import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");

class TestField {
  constructor(options = {}) {
    this.options = options;
  }
}

class TestTypeDataModel {
  static validateJoint() {}

  constructor(data = {}) {
    this.updateSource(data);
  }

  updateSource(changes = {}) {
    const next = { ...this, ...changes };
    this.constructor.validateJoint(next);
    Object.assign(this, next);
    return this;
  }
}

globalThis.foundry = {
  abstract: { TypeDataModel: TestTypeDataModel },
  data: {
    fields: {
      ArrayField: TestField,
      BooleanField: TestField,
      HTMLField: TestField,
      NumberField: TestField,
      ObjectField: TestField,
      SchemaField: TestField,
      StringField: TestField,
    },
  },
  utils: { deepClone: value => structuredClone(value) },
  applications: {
    api: { HandlebarsApplicationMixin: Base => Base },
    sheets: { ActorSheetV2: class { async _onRender() {} async _onClose() {} } },
  },
};

const { BladesClockSheet } = await import("../module/blades-clock-sheet.js");

test("Clock actor is registered as a standalone v13 Actor type", async () => {
  const [bootstrap, schemaSource, templateSource, actorSource, imageSource] = await Promise.all([
    read("module/blades.js"), read("module/data/actor-data-models.js"), read("template.json"),
    read("module/blades-actor.js"), read("module/actor-images.js"),
  ]);
  const template = JSON.parse(templateSource);
  assert.match(schemaSource, /export class ClockData extends TypeDataModel/);
  assert.match(schemaSource, /type: new fields\.NumberField\([\s\S]*?choices: \[4, 6, 8\]/);
  assert.match(schemaSource, /value: new fields\.NumberField\([\s\S]*?min: 0, max: 8/);
  assert.match(bootstrap, /"clock":\s+ClockData/);
  assert.match(bootstrap, /BladesClockSheet, \{ types: \["clock"\], makeDefault: true \}/);
  assert.match(actorSource, /data\.type === "clock"[\s\S]*?clockActorImage\(data\.img\)/);
  assert.match(imageSource, /DEFAULT_CLOCK_ACTOR_IMAGE = "systems\/brinkwood-reforged\/styles\/assets\/progressclocks-svg\/Progress Clock 4-0\.svg"/);
  assert.deepEqual(template.Actor.types, ["character", "clock", "npc", "mask", "rebelion"]);
  assert.deepEqual(template.Actor.clock, { type: 4, value: 0 });
});

test("Clock data rejects progress beyond its size at create and update boundaries", async () => {
  const { ClockData } = await import("../module/data/actor-data-models.js");

  assert.throws(
    () => new ClockData({ type: 4, value: 8 }),
    /Clock progress cannot exceed its segment count/,
  );

  const clock = new ClockData({ type: 8, value: 8 });
  assert.throws(
    () => clock.updateSource({ type: 4 }),
    /Clock progress cannot exceed its segment count/,
  );
  assert.deepEqual({ type: clock.type, value: clock.value }, { type: 8, value: 8 });

  clock.updateSource({ type: 4, value: 4 });
  assert.deepEqual({ type: clock.type, value: clock.value }, { type: 4, value: 4 });
});

test("Clock sheet keeps v13 lifecycle and one serialized persistence path", async () => {
  const source = await read("module/blades-clock-sheet.js");
  assert.match(source, /static DEFAULT_OPTIONS/);
  assert.match(source, /position: \{ width: 520, height: 640 \}/);
  assert.match(source, /form: \{ closeOnSubmit: false, submitOnChange: false \}/);
  assert.match(source, /static PARTS[\s\S]*?scrollable: \[""\]/);
  assert.match(source, /get title\(\)[\s\S]*?TYPES\.Actor\.clock[\s\S]*?return `\$\{typeLabel\}: \$\{this\.document\.name\}`/);
  assert.match(source, /async _prepareContext\(options\)/);
  assert.match(source, /async _onRender\(context, options\)/);
  assert.match(source, /_clockSheetListenerController\?\.abort\(\)/);
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /queueDocumentPathUpdate\(this\.document/);
  assert.match(source, /input\[name="system\.value"\], select\[name="system\.type"\]/);
  assert.match(source, /input\[type="radio"\]\[name="system\.value"\]\[value="1"\]/);
  assert.match(source, /async _clearSingleClockSegment\(event\)/);
  assert.doesNotMatch(source, /defaultOptions|getData\(|activateListeners|_updateObject/);
  assert.doesNotMatch(source, /global-clock-utils|nextGlobalClockValue|GLOBAL_CLOCK_FACE_BACKGROUND/);
});

test("Clock persistence clamps value and synchronizes clock images", async () => {
  const updates = [];
  const document = {
    system: { type: 4, value: 0 },
    async update(update) {
      updates.push(update);
      this.system.type = update["system.type"];
      this.system.value = update["system.value"];
    },
    getActiveTokens: () => [],
  };
  const sheet = Object.assign(Object.create(BladesClockSheet.prototype), {
    document, isEditable: true, _syncActiveTokenImages: async () => {},
  });
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

test("Clock's only filled segment can be clicked again to clear progress", async () => {
  const persisted = [];
  const document = { system: { value: 1 } };
  const sheet = Object.assign(Object.create(BladesClockSheet.prototype), {
    document,
    isEditable: true,
    async _persistClock(update) {
      persisted.push(update);
      return true;
    },
  });

  assert.equal(await sheet._clearSingleClockSegment({ currentTarget: { checked: true, value: "1" } }), true);
  assert.deepEqual(persisted, [{ value: 0 }]);

  document.system.value = 2;
  assert.equal(await sheet._clearSingleClockSegment({ currentTarget: { checked: true, value: "1" } }), false);
  assert.equal(await sheet._clearSingleClockSegment({ currentTarget: { checked: false, value: "1" } }), false);
  assert.equal(persisted.length, 1);
});

test("Clock sheet title localizes the Actor type before adding the document name", () => {
  const previousGame = globalThis.game;
  globalThis.game = { i18n: { localize: key => key === "TYPES.Actor.clock" ? "Clock" : key } };
  try {
    const sheet = Object.assign(Object.create(BladesClockSheet.prototype), { document: { name: "Countdown" } });
    assert.equal(sheet.title, "Clock: Countdown");
  } finally {
    globalThis.game = previousGame;
  }
});

test("Clock template uses direct segmented controls inside one Aspect-style ruled card", async () => {
  const [template, locale] = await Promise.all([read("templates/clock-sheet.html"), read("lang/en.json")]);
  const messages = JSON.parse(locale);
  assert.match(template, /class="\{\{cssClass\}\} clock-block clock-sheet"/);
  assert.match(template, /class="clock-sheet__card bw-ruled-card bw-ruled-card--trait-palette" aria-label="\{\{localize 'BITD\.Clock\.Details'\}\}"/);
  assert.match(template, /<header class="clock-sheet__header bw-ruled-card__title-band">[\s\S]*?name="name"[\s\S]*?name="system\.type"[\s\S]*?<\/header>/);
  assert.match(template, /class="clock-sheet__body bw-ruled-card__body" aria-label="\{\{localize "BITD\.Clock\.Progress"\}\}"/);
  assert.match(template, /clocks clocks-\{\{system\.type\}\}/);
  assert.match(template, /\{\{\{blades-clock "system\.value" system\.type system\.value _id/);
  assert.match(template, /id="clock-\{\{_id\}\}-size" name="system\.type"/);
  assert.match(template, /value="4"[\s\S]*?value="6"[\s\S]*?value="8"/);
  assert.equal(messages["BITD.Clock.Progress"], "Clock progress");
  assert.equal(messages["BITD.Clock.Details"], "Clock details");
  assert.equal(messages.TYPES.Actor.clock, "Clock");
  assert.doesNotMatch(template, /bw-section-frame|<h2/);
  assert.doesNotMatch(template, /global-clock/);
});

test("Clock SCSS owns centered direct-segment geometry inside the shared ruled card", async () => {
  const [scss, entrypoint, css, shared] = await Promise.all([
    read("scss/import/clock-sheet.scss"), read("scss/style.scss"), read("styles/blades.css"), read("scss/import/general-styles.scss"),
  ]);
  assert.match(entrypoint, /&\.actor\.clock\s*\{\s*@import 'import\/clock-sheet\.scss';/);
  assert.match(scss, /form\.clock-sheet[\s\S]*?min-height: 320px/);
  assert.match(scss, /& \{[\s\S]*?min-width: 290px;[\s\S]*?max-width: 560px;[\s\S]*?min-height: 420px;[\s\S]*?max-height: 680px/);
  assert.match(scss, /overflow: auto/);
  assert.match(scss, /clock-sheet__card[\s\S]*?grid-template-rows: auto minmax\(280px, 1fr\)[\s\S]*?width: 100%/);
  assert.match(scss, /clock-sheet__header[\s\S]*?grid-template-columns: minmax\(160px, 1fr\) 132px[\s\S]*?width: 100%/);
  assert.match(scss, /clock-sheet__body[\s\S]*?display: flex[\s\S]*?align-items: center[\s\S]*?justify-content: center[\s\S]*?width: 100%[\s\S]*?min-height: 280px/);
  assert.match(shared, /\.bw-ruled-card\s*\{[\s\S]*?border-left: 5px solid var\(--bw-ruled-card-accent\)/);
  assert.match(shared, /\.bw-ruled-card--trait-palette\s*\{[\s\S]*?--bw-ruled-card-accent: var\(--bw-accent\)/);
  assert.match(scss, /\.clocks \{[\s\S]*?width: 200px[\s\S]*?justify-self: center[\s\S]*?margin-inline: auto/);
  assert.match(scss, /grid-template-rows: 200px auto/);
  assert.match(scss, /@include clock\(4, 200, var\(--bw-paper-deep\), var\(--bw-accent\)\)/);
  assert.match(scss, /@include clock\(6, 200, var\(--bw-paper-deep\), var\(--bw-accent\)\)/);
  assert.match(scss, /@include clock\(8, 200, var\(--bw-paper-deep\), var\(--bw-accent\)\)/);
  assert.match(scss, /border: 2px solid var\(--bw-ink\)/);
  assert.match(scss, /\.clocks-4 \.blades-clock::after[\s\S]*?linear-gradient\(to right[\s\S]*?linear-gradient\(to bottom/);
  assert.match(scss, /\.clocks-6 \.blades-clock::after[\s\S]*?linear-gradient\(90deg[\s\S]*?linear-gradient\(30deg[\s\S]*?linear-gradient\(150deg/);
  assert.match(scss, /\.clocks-8 \.blades-clock::after[\s\S]*?linear-gradient\(90deg[\s\S]*?linear-gradient\(45deg[\s\S]*?linear-gradient\(0deg[\s\S]*?linear-gradient\(135deg/);
  assert.doesNotMatch(scss, /repeating-conic-gradient/);
  assert.match(scss, /pointer-events: none/);
  assert.match(scss, /\.clock-zero-label[\s\S]*?clip: rect\(0, 0, 0, 0\)/);
  assert.doesNotMatch(scss, /\.clock-zero-label\s*\{[\s\S]*?display:\s*none/);
  assert.match(scss, /@container \(max-width: 420px\)[\s\S]*?clock-sheet__header[\s\S]*?grid-template-columns: minmax\(0, 1fr\) minmax\(88px, 112px\)/);
  assert.match(scss, /@container \(max-width: 420px\)[\s\S]*?\.clocks \{[\s\S]*?width: 160px/);
  assert.doesNotMatch(scss, /global-clock/);
  assert.match(css, /\.brinkwood\.actor\.clock form\.clock-sheet \.clocks\.clocks-4 \.blades-clock/);
  assert.match(css, /width: 200px/);
});

test("every clock artwork state has a light parchment face for dark actor lists", async () => {
  const facePaths = [4, 6, 8].flatMap(size => Array.from({ length: size + 1 }, (_, value) =>
    `styles/assets/progressclocks-svg/Progress Clock ${size}-${value}.svg`));
  const faces = await Promise.all(facePaths.map(read));
  for (const face of faces) {
    assert.match(face, /<circle cx="[\d.]+" cy="[\d.]+" r="[\d.]+" fill="#f3ecdf"\/>/);
  }
});
