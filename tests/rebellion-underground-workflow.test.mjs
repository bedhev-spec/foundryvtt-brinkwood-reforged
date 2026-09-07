import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

let rollResults = [5, 2];
let rollCount = 0;
let chatCount = 0;
let confirmAction = async () => true;
let confirmContent = "";

globalThis.foundry = {
  applications: {
    api: {
      HandlebarsApplicationMixin: Base => Base,
      DialogV2: {
        async confirm(options) {
          confirmContent = options.content;
          return confirmAction(options);
        },
      },
    },
    sheets: { ActorSheetV2: class { async _onRender() {} async _onClose() {} } },
  },
  dice: {
    Roll: class {
      constructor(formula) {
        this.formula = formula;
        this.dice = [{ results: rollResults.map(result => ({ result })) }];
        rollCount += 1;
      }
      async evaluate() { return this; }
      async toMessage() { chatCount += 1; }
    },
  },
  utils: {
    deepClone: value => structuredClone(value),
    getProperty: (object, path) => path.split(".").reduce((value, key) => value?.[key], object),
  },
};

const notices = { info: [], warn: [], error: [] };
globalThis.game = {
  actors: [],
  items: new Map(),
  packs: new Map(),
  user: { isGM: true },
  i18n: {
    format: (key, data) => `${key}:${JSON.stringify(data)}`,
    localize: key => key,
  },
};
globalThis.ui = {
  notifications: {
    error: message => notices.error.push(message),
    info: message => notices.info.push(message),
    warn: message => notices.warn.push(message),
  },
};

const { BladesRebelionSheet } = await import("../module/blades-rebelion-sheet.js");
const root = new URL("../", import.meta.url);

const aspects = () => [
  { name: "Organization", rank: 0, progress: [3, 0, 0], max_progress: [4, 6, 8], decisions: [] },
  { name: "Force", rank: 0, progress: [1, 0, 0], max_progress: [4, 6, 8], decisions: [] },
  { name: "Influence", rank: 0, progress: [1, 0, 0], max_progress: [4, 6, 8], decisions: [] },
];

function setPath(target, path, value) {
  const keys = path.split(".");
  let cursor = target;
  for (const key of keys.slice(0, -1)) cursor = cursor[key] ??= {};
  cursor[keys.at(-1)] = structuredClone(value);
}

function rebellionFixture() {
  const updates = [];
  const document = {
    system: {
      aspects: aspects(),
      heat: { value: 7, max: 10 },
      tyranny: { value: 2, max: 4 },
      resupply: { value: 0, max: 4 },
    },
    async update(update) {
      updates.push(structuredClone(update));
      for (const [path, value] of Object.entries(update)) setPath(this, path, value);
    },
  };
  const sheet = Object.assign(Object.create(BladesRebelionSheet.prototype), { document, isEditable: true });
  return { document, sheet, updates };
}

function targetActor(name, type, initialValue, { fail = false } = {}) {
  const updates = [];
  const actor = {
    id: name,
    name,
    type,
    system: type === "character" ? { stress: { value: initialValue } } : { essence: { value: initialValue } },
    async update(update) {
      updates.push(structuredClone(update));
      if (fail) throw new Error("reset failed");
      for (const [path, value] of Object.entries(update)) setPath(this, path, value);
    },
  };
  return { actor, updates };
}

function workflowContainer(actorIds = [], criticalAspect = "", leastAspect = "") {
  const action = {
    disabled: false,
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
  };
  const preview = { textContent: "" };
  const attributes = {};
  return {
    action,
    preview,
    attributes,
    setAttribute(name, value) { attributes[name] = value; },
    querySelectorAll(selector) {
      return selector === "[data-underground-actor]:checked" ? actorIds.map(value => ({ value })) : [];
    },
    querySelector(selector) {
      if (selector === "[data-underground-critical-aspect]") return { value: criticalAspect };
      if (selector === "[data-underground-least-aspect]") return { value: leastAspect };
      if (selector === '[data-rebellion-action="going-underground"]') return action;
      if (selector === "[data-underground-preview]") return preview;
      return null;
    },
  };
}

test("Going Underground template uses shared checkboxes, aligned resource values, two pre-roll targets, and disabled CTA", async () => {
  const [template, controller, styles] = await Promise.all([
    readFile(new URL("templates/rebelion-sheet.html", root), "utf8"),
    readFile(new URL("module/blades-rebelion-sheet.js", root), "utf8"),
    readFile(new URL("scss/import/rebelion-sheet.scss", root), "utf8"),
  ]);
  assert.match(template, /class="bw-checkbox-x"[^>]*data-underground-actor/);
  assert.match(template, /class="rebelion-underground__actor-checkbox"[\s\S]*?class="bw-checkbox-x"/);
  assert.match(template, /class="rebelion-underground__actor-name" title="\{\{name\}\}">\{\{name\}\}<\/span>/);
  assert.match(template, /class="rebelion-underground__actor-resource"[\s\S]*?class="rebelion-underground__actor-resource-label">\{\{resourceLabel\}\}:<\/span>[\s\S]*?class="rebelion-underground__actor-resource-value">\{\{resourceValue\}\}<\/span>/);
  assert.match(template, /rebelion-underground__actor-group/);
  assert.match(template, /rebelion-underground__actor-text/);
  assert.match(styles, /\.rebelion-underground__actor-text\s*\{[\s\S]*?align-items:\s*baseline;/);
  assert.match(styles, /\.rebelion-underground__body\s*\{[\s\S]*?font-size:\s*calc\(1rem \+ 1\.5px\)/);
  assert.match(styles, /\.rebelion-underground__actor\s*\{[\s\S]*?grid-template-columns:\s*18px minmax\(0, 1fr\);[\s\S]*?height:\s*30px/);
  assert.match(styles, /\.rebelion-underground__actor-name,[\s\S]*?\.rebelion-underground__actor-resource-value\s*\{[\s\S]*?line-height:\s*20px/);
  assert.match(styles, /\.rebelion-underground__actor-resource\s*\{[\s\S]*?display:\s*grid;[\s\S]*?font-weight:\s*700/);
  assert.match(styles, /\.rebelion-underground__actor-group h4\s*\{[\s\S]*?font-size:\s*calc\(0\.85rem \+ 1\.5px\)/);
  assert.match(styles, /\.rebelion-underground__body select\s*\{[\s\S]*?font-size:\s*inherit/);
  assert.match(styles, /\.rebelion-underground__body button\s*\{[\s\S]*?font-size:\s*inherit/);
  assert.match(styles, /\.rebelion-underground__actor-name\s*\{[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?white-space:\s*nowrap/);
  assert.doesNotMatch(styles, /\.rebelion-underground__actors\s+(?:label|small)/);
  assert.match(template, /bw-section-frame bw-ruled-card--trait-palette rebelion-underground/);
  assert.match(controller, /RebellionCharacterActors/);
  assert.match(controller, /RebellionMaskActors/);
  assert.match(controller, /const underground = html\.querySelector\("\.rebelion-underground"\)/);
  assert.match(controller, /typeof this\._undergroundOpen === "boolean"[\s\S]*?underground\.open = this\._undergroundOpen/);
  assert.match(controller, /underground\.addEventListener\("toggle",[\s\S]*?this\._undergroundOpen = underground\.open/);
  assert.ok(controller.indexOf('const underground = html.querySelector(".rebelion-underground")') < controller.indexOf("if (!this.isEditable) return"));
  assert.match(template, /data-underground-critical-aspect/);
  assert.match(template, /data-underground-least-aspect/);
  assert.match(template, /data-rebellion-action="going-underground" disabled aria-disabled="true"/);
});

test("Going Underground preflight enables only with actors and both legal outcome targets", () => {
  const character = targetActor("Character A", "character", 5);
  const unselectedCharacter = targetActor("Character Unselected", "character", 4);
  const unselectedMask = targetActor("Mask Unselected", "mask", 6);
  game.actors = [character.actor, unselectedCharacter.actor, unselectedMask.actor];
  const { sheet } = rebellionFixture();
  const incomplete = workflowContainer([character.actor.id], "Organization", "");
  sheet._syncGoingUnderground(incomplete);
  assert.equal(incomplete.action.disabled, true);

  const complete = workflowContainer([character.actor.id], "Organization", "Influence");
  sheet._syncGoingUnderground(complete);
  assert.equal(complete.action.disabled, false);
  assert.deepEqual(sheet._readGoingUndergroundSelection(complete).actors.map(actor => actor.name), ["Character A"]);
  assert.match(complete.preview.textContent, /Character A/);
  assert.doesNotMatch(complete.preview.textContent, /Character Unselected/);
  assert.doesNotMatch(complete.preview.textContent, /Mask Unselected/);
  assert.match(complete.preview.textContent, /Stress/);
  assert.match(complete.preview.textContent, /Influence/);
});

test("Going Underground zero-dice result uses the preselected least-progress Aspect and resets selected actors", async () => {
  const character = targetActor("Character B", "character", 5);
  const mask = targetActor("Mask A", "mask", 6);
  game.actors = [character.actor, mask.actor];
  rollResults = [5, 2];
  rollCount = 0;
  chatCount = 0;
  confirmAction = async () => true;
  const { document, sheet, updates } = rebellionFixture();

  assert.equal(await sheet._applyGoingUnderground(workflowContainer(
    [character.actor.id, mask.actor.id], "Organization", "Influence",
  )), true);
  assert.equal(rollCount, 1);
  assert.equal(chatCount, 1);
  assert.equal(document.system.tyranny.value, 1);
  assert.equal(document.system.heat.value, 0);
  assert.equal(document.system.aspects[2].progress[0], 0);
  assert.equal(character.actor.system.stress.value, 0);
  assert.equal(mask.actor.system.essence.value, 0);
  assert.equal(updates.length, 1);
  assert.match(confirmContent, /Character B/);
  assert.match(confirmContent, /Mask A/);
});

test("Cancelling pre-roll confirmation preserves all documents and posts no roll", async () => {
  const character = targetActor("Character C", "character", 4);
  game.actors = [character.actor];
  rollCount = 0;
  chatCount = 0;
  confirmAction = async () => false;
  const { document, sheet, updates } = rebellionFixture();

  assert.equal(await sheet._applyGoingUnderground(workflowContainer([character.actor.id], "Force", "Influence")), false);
  assert.equal(rollCount, 0);
  assert.equal(chatCount, 0);
  assert.equal(document.system.tyranny.value, 2);
  assert.equal(character.actor.system.stress.value, 4);
  assert.equal(updates.length, 0);
});

test("Going Underground suppresses duplicate clicks while confirmation is pending", async () => {
  const character = targetActor("Character D", "character", 3);
  game.actors = [character.actor];
  let release;
  confirmAction = () => new Promise(resolve => { release = resolve; });
  rollResults = [6, 2];
  rollCount = 0;
  const { sheet } = rebellionFixture();
  const container = workflowContainer([character.actor.id], "Force", "Influence");

  const first = sheet._applyGoingUnderground(container);
  assert.equal(await sheet._applyGoingUnderground(container), false);
  assert.equal(container.action.disabled, true);
  release(true);
  assert.equal(await first, true);
  assert.equal(rollCount, 1);
});

test("Named partial reset warning states Rebellion update already succeeded", async () => {
  const character = targetActor("Character E", "character", 3);
  const mask = targetActor("Mask Failed", "mask", 7, { fail: true });
  game.actors = [character.actor, mask.actor];
  confirmAction = async () => true;
  rollResults = [6, 2];
  notices.warn.length = 0;
  const { document, sheet } = rebellionFixture();

  assert.equal(await sheet._applyGoingUnderground(workflowContainer(
    [character.actor.id, mask.actor.id], "Force", "Influence",
  )), false);
  assert.equal(document.system.tyranny.value, 1);
  assert.match(notices.warn.at(-1), /RebellionUndergroundPartialReset/);
  assert.match(notices.warn.at(-1), /Mask Failed/);
});
