import assert from "node:assert/strict";
import test from "node:test";

let constructedDialog;

class DialogV2Stub {
  static prompt(options) {
    constructedDialog = new this(options);
    return constructedDialog;
  }

  constructor(options) {
    this.options = options;
  }

  async _onFirstRender() {}

  setPosition(position) {
    this.appliedPosition = position;
    return position;
  }
}

globalThis.foundry = {
  applications: {
    api: {
      DialogV2: DialogV2Stub,
    },
  },
};

const { promptItemPicker } = await import("../module/item-picker-dialog.js");

test("item picker prompt constructs the height-resizable DialogV2 subclass", async () => {
  const dialog = promptItemPicker({
    rows: [],
    inputType: "radio",
    title: "Add identity",
    addLabel: "Add",
    tooltipLabel: "Details",
  });

  assert.equal(dialog, constructedDialog);
  assert.ok(dialog instanceof DialogV2Stub);
  assert.notEqual(dialog.constructor, DialogV2Stub);

  dialog.setPosition({ width: 400, height: 500 });
  assert.deepEqual(dialog.appliedPosition, { width: 400, height: 500 });

  await dialog._onFirstRender({}, {});
  dialog.setPosition({ left: 10, top: 20, width: 640, height: 580 });
  assert.deepEqual(dialog.appliedPosition, { left: 10, top: 20, height: 580 });
});
