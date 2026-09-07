import assert from "node:assert/strict";
import test from "node:test";

const registeredHooks = [];
globalThis.Hooks = { on: (...args) => registeredHooks.push(args) };
globalThis.CONFIG = { Item: { documentClass: { metadata: { label: "DOCUMENT.Item" } } } };
globalThis.game = {
  user: { isGM: true },
  i18n: { localize: key => key === "DOCUMENT.Item" ? "Item" : key },
  settings: { get: () => false },
};

const {
  filterItemCreationTypes,
  registerItemCreationTypeFilter,
} = await import("../module/item-creation-types.js");

function creationDialog({ placeholder = "Item", values = ["item", "trait", "class"] } = {}) {
  const options = values.map(value => ({
    value,
    removed: false,
    remove() { this.removed = true; },
  }));
  const type = {
    options,
    value: values[0],
    querySelector: selector => selector === 'option[value="item"]'
      ? options.find(option => option.value === "item") : null,
  };
  const name = { placeholder };
  return {
    name,
    type,
    querySelector(selector) {
      if (selector === 'form.dialog-form input[name="name"]') return name;
      if (selector === 'form.dialog-form select[name="type"]') return type;
      return null;
    },
  };
}

test("Item creation keeps only the stable Item type by default", () => {
  const dialog = creationDialog();
  assert.equal(filterItemCreationTypes(dialog, { showAllTypes: false }), true);
  assert.equal(dialog.type.value, "item");
  assert.deepEqual(
    dialog.type.options.filter(option => !option.removed).map(option => option.value),
    ["item"],
  );
});

test("GM setting can preserve all Item creation types", () => {
  const dialog = creationDialog();
  assert.equal(filterItemCreationTypes(dialog, { showAllTypes: true }), false);
  assert.ok(dialog.type.options.every(option => !option.removed));
});

test("other typed document dialogs are not changed", () => {
  const dialog = creationDialog({ placeholder: "Actor", values: ["item", "character", "npc"] });
  assert.equal(filterItemCreationTypes(dialog, { showAllTypes: false }), false);
  assert.ok(dialog.type.options.every(option => !option.removed));
});

test("Item creation filter registers on the native DialogV2 render hook", () => {
  registerItemCreationTypeFilter();
  assert.equal(registeredHooks.length, 1);
  assert.equal(registeredHooks[0][0], "renderDialogV2");
  assert.equal(typeof registeredHooks[0][1], "function");
});
