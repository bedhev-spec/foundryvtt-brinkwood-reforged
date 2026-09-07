import assert from "node:assert/strict";
import test from "node:test";

globalThis.Hooks = { on() {} };
globalThis.CONST = { ACTIVE_EFFECT_MODES: { CUSTOM: 0 } };
globalThis.foundry = {
  abstract: { TypeDataModel: class {} }, data: { fields: {} },
  applications: { api: { HandlebarsApplicationMixin: Base => Base }, sheets: { ActorSheetV2: class {} } },
  documents: { ActiveEffect: class {} },
  utils: { getProperty: (object, path) => path.split(".").reduce((value, key) => value?.[key], object) },
};
const { BladesActorSheet, updateCharacterClockDisplay } = await import("../module/blades-actor-sheet.js");
const { onLoadoutItemToggle } = await import("../module/character/loadout.js");
const { clockImagePath } = await import("../module/clock-utils.js");

test("first legacy loadout selection persists provenance and equipped state atomically without render", async () => {
  const timeline = [];
  const item = { id: "owned", type: "item", name: "Longsword", flags: {}, system: { equipped: false },
    async update(changes, options) {
      timeline.push({ changes, options });
    if (changes["flags.brinkwood-reforged.loadoutSourceId"]) this.flags["brinkwood-reforged"] = { loadoutSourceId: "sword" };
      if ("system.equipped" in changes) this.system.equipped = changes["system.equipped"];
    },
  };
  let renders = 0;
  const sheet = {
    isEditable: true,
    actor: { items: [item], system: { selected_load_level: "BITD.Light" } },
    element: { querySelectorAll: () => [], querySelector: () => null },
    async render() { renders += 1; },
  };

  await onLoadoutItemToggle(sheet, { currentTarget: {
    checked: true, dataset: { loadoutSourceId: "sword", loadoutItemName: "Longsword" },
  } });

  assert.equal(item.system.equipped, true);
  assert.equal(renders, 0);
  assert.deepEqual(timeline, [{
    changes: {
      "system.equipped": true,
      "flags.brinkwood-reforged.loadoutSourceId": "sword",
    },
    options: { render: false },
  }]);
});

function clockDom() {
  const progress = { textContent: "0/4" };
  const classes = new Set(["clock-4-0"]);
  const clock = { style: {}, classList: { toggle: (name, active) => active ? classes.add(name) : classes.delete(name) },
    parentElement: { querySelector: () => progress } };
  const controls = Array.from({ length: 5 }, (_, value) => ({ value: String(value), checked: value === 0, closest: () => clock }));
  return { root: { querySelectorAll: () => controls }, clock, controls, progress, classes };
}

test("Character clock completion updates artwork and counter as well as radios, without a render", async () => {
  const { root, clock, controls, progress, classes } = clockDom();
  const document = { system: { scars: 0 }, async update(changes, options) {
    assert.deepEqual(options, { render: false });
    this.system.scars = changes["system.scars"];
  } };
  const sheet = { isEditable: true, document, element: root };
  await BladesActorSheet.prototype._onClockClick.call(sheet, {
    currentTarget: { name: "system.scars", value: "2" }, preventDefault() {}, stopPropagation() {},
  });
  assert.equal(document.system.scars, 2);
  assert.equal(clock.style.backgroundImage, `url('${clockImagePath(4, 2)}')`);
  assert.equal(progress.textContent, "2/4");
  assert.deepEqual(controls.filter(control => control.checked).map(control => control.value), ["2"]);
  assert.deepEqual([...classes], ["clock-4-2"]);
  updateCharacterClockDisplay(root, "system.scars", 0);
  assert.equal(progress.textContent, "0/4");
  assert.deepEqual([...classes], ["clock-4-0"]);
});

test("Character declares its root form to Foundry's pre-replacement scroll synchronizer", () => {
  assert.deepEqual(BladesActorSheet.PARTS.sheet.scrollable, [""]);
});
