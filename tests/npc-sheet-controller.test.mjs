import assert from "node:assert/strict";
import test from "node:test";

globalThis.foundry = {
  applications: {
    api: { HandlebarsApplicationMixin: Base => Base },
    sheets: {
      ActorSheetV2: class {
        async _onRender() {}
        async _onClose() {}
      },
    },
  },
};

const { BladesNPCSheet } = await import("../module/blades-npc-sheet.js");

class MockControl extends EventTarget {
  constructor({ tagName = "INPUT", name, type = "text", value = "", checked = false }) {
    super();
    Object.assign(this, { tagName, name, type, value, checked, disabled: false, readOnly: false });
  }

  setAttribute(name, value) {
    this[name] = value;
  }
}

function sheetRoot(controls) {
  return {
    querySelectorAll(selector) {
      if (selector === "input, select") {
        return controls.filter(control => ["INPUT", "SELECT"].includes(control.tagName));
      }
      if (selector === "textarea") {
        return controls.filter(control => control.tagName === "TEXTAREA");
      }
      if (selector === 'input[name], select[name], textarea[name]') {
        return controls.filter(control => control.name && control.tagName !== "PROSE-MIRROR");
      }
      if (selector === "prose-mirror[name]") return controls.filter(control => control.tagName === "PROSE-MIRROR");
      return [];
    },
  };
}

const flushSaveQueue = () => new Promise(resolve => setImmediate(resolve));

test("NPC details default to the first tab and preserve a valid selection", () => {
  const context = {};
  const sheet = Object.assign(Object.create(BladesNPCSheet.prototype), {
    tabGroups: { npcDetails: undefined },
  });

  sheet._ensureValidNpcDetailsTab(context);
  assert.equal(sheet.tabGroups.npcDetails, "description");
  assert.equal(context.npcDetailsTab, "description");

  sheet.tabGroups.npcDetails = "abilities";
  sheet._ensureValidNpcDetailsTab(context);
  assert.equal(sheet.tabGroups.npcDetails, "abilities");
  assert.equal(context.npcDetailsTab, "abilities");
});

test("NPC rich-text fields hydrate, save once, and replace render-owned listeners", async () => {
  assert.equal(BladesNPCSheet.DEFAULT_OPTIONS.form.submitOnChange, false);
  assert.deepEqual(BladesNPCSheet.DEFAULT_OPTIONS.tabGroups, { npcDetails: "description" });
  assert.deepEqual(BladesNPCSheet.PARTS.sheet.scrollable, [""]);
  const controls = ["description", "abilities", "schemes"].map(field => new MockControl({
    tagName: "PROSE-MIRROR", name: `system.${field}`, value: "",
  }));
  const updates = [];
  const document = {
    system: { description: "Description", abilities: "Abilities", schemes: "Schemes" },
    async update(change) { updates.push(change); },
  };
  const sheet = Object.assign(Object.create(BladesNPCSheet.prototype), {
    isEditable: true, document, element: sheetRoot(controls),
  });
  await sheet._onRender({}, {});
  assert.deepEqual(controls.map(control => control.value), ["Description", "Abilities", "Schemes"]);
  assert.equal(updates.length, 0, "hydration does not save");
  await sheet._onRender({}, {});
  for (const control of controls) {
    control.value = `Edited ${control.name}`;
    control.dispatchEvent(new Event("change"));
  }
  await flushSaveQueue();
  assert.deepEqual(updates, controls.map(control => ({ [control.name]: control.value })));
  await sheet._onClose({});
  controls[0].dispatchEvent(new Event("change"));
  await flushSaveQueue();
  assert.equal(updates.length, 3, "closed sheet listeners are disposed");
});

test("NPC render lifecycle persists named controls, replaces listeners, and enforces read-only mode", async () => {
  const updates = [];
  const document = {
    async update(change) {
      updates.push(change);
    },
  };
  const firstControl = new MockControl({ name: "system.threat", type: "number", value: "2" });
  const sheet = Object.assign(Object.create(BladesNPCSheet.prototype), {
    isEditable: true,
    document,
    element: sheetRoot([firstControl]),
  });

  await BladesNPCSheet.prototype._onRender.call(sheet, { editable: true }, {});
  const firstListenerController = sheet._npcSheetListenerController;
  firstControl.dispatchEvent(new Event("change"));
  await flushSaveQueue();
  assert.deepEqual(updates, [{ "system.threat": "2" }]);

  const secondControl = new MockControl({ name: "system.elite", type: "checkbox", checked: true });
  sheet.element = sheetRoot([secondControl]);
  await BladesNPCSheet.prototype._onRender.call(sheet, { editable: true }, {});
  assert.equal(firstListenerController.signal.aborted, true);

  firstControl.value = "3";
  firstControl.dispatchEvent(new Event("change"));
  await flushSaveQueue();
  assert.equal(updates.length, 1);

  secondControl.dispatchEvent(new Event("change"));
  await flushSaveQueue();
  assert.deepEqual(updates, [
    { "system.threat": "2" },
    { "system.elite": true },
  ]);

  const lockedInput = new MockControl({ name: "system.tier", type: "number", value: "4" });
  const lockedTextarea = new MockControl({ tagName: "TEXTAREA", name: "system.description", value: "Locked" });
  sheet.isEditable = false;
  sheet.element = sheetRoot([lockedInput, lockedTextarea]);
  await BladesNPCSheet.prototype._onRender.call(sheet, { editable: false }, {});

  assert.equal(lockedInput.disabled, true);
  assert.equal(lockedInput["aria-disabled"], "true");
  assert.equal(lockedTextarea.readOnly, true);
  assert.equal(lockedTextarea["aria-readonly"], "true");
  assert.equal(await BladesNPCSheet.prototype._persistFormControl.call(sheet, {
    currentTarget: lockedInput,
  }), false);
  assert.equal(updates.length, 2);
});
