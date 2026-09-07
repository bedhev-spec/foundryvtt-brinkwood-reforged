import assert from "node:assert/strict";
import test from "node:test";

globalThis.foundry = {
  documents: {
    Item: class {
      async _preCreate() {}
    },
  },
  abstract: { TypeDataModel: class {} },
  data: { fields: {} },
};
globalThis.game = {
  user: { id: "current-user", isGM: true },
  settings: { get: () => false },
};

const { BladesItem } = await import("../module/blades-item.js");
const { registerSystemSettings, SHOW_UNFINISHED_ITEM_TYPES_SETTING } = await import("../module/settings.js");

function parentWith(items) {
  const deleted = [];
  return {
    documentName: "Actor",
    items,
    deleteEmbeddedDocuments: async (...args) => { deleted.push(args); },
    deleted,
  };
}

test("unfinished Item type visibility is a disabled world setting by default", () => {
  const registrations = [];
  game.settings.register = (...args) => registrations.push(args);
  registerSystemSettings();

  const [, key, setting] = registrations.find(([, registeredKey]) =>
    registeredKey === SHOW_UNFINISHED_ITEM_TYPES_SETTING);
  assert.equal(key, SHOW_UNFINISHED_ITEM_TYPES_SETTING);
  assert.equal(setting.scope, "world");
  assert.equal(setting.config, true);
  assert.equal(setting.type, Boolean);
  assert.equal(setting.default, false);
});

test("configured Mask creation bypasses the legacy distinct-item deletion", async () => {
  const parent = parentWith([{ id: "mask-old", type: "mask", name: "Terror" }]);

  await BladesItem.prototype._preCreate.call(
    { parent },
    { type: "mask", name: "Violence" },
    { brinkwoodConfigureMask: true },
    game.user,
  );

  assert.deepEqual(parent.deleted, []);
});

test("managed trait grants bypass legacy same-name source deletion", async () => {
  const parent = parentWith([{ id: "upbringing-apprentice", type: "upbringing", name: "Apprentice" }]);

  await BladesItem.prototype._preCreate.call(
    { parent },
    { type: "trait", name: "Apprentice" },
    { brinkwoodTraitGrant: true },
    game.user,
  );

  assert.deepEqual(parent.deleted, []);
});

test("ordinary distinct Mask creation still removes the prior Mask", async () => {
  const parent = parentWith([{ id: "mask-old", type: "mask", name: "Terror" }]);

  await BladesItem.prototype._preCreate.call(
    { parent },
    { type: "mask", name: "Violence" },
    {},
    game.user,
  );

  assert.deepEqual(parent.deleted, [["Item", ["mask-old"]]]);
});
