import assert from "node:assert/strict";
import test from "node:test";

let pickerOptions;
let browseCount = 0;

class FilePickerStub {
  constructor(options) {
    pickerOptions = options;
  }

  async browse() {
    browseCount += 1;
  }
}

globalThis.foundry = {
  applications: { apps: { FilePicker: { implementation: FilePickerStub } } },
  utils: {
    getProperty: (object, path) => path.split(".").reduce((value, key) => value?.[key], object),
  },
};
globalThis.game = { i18n: { localize: key => key } };

const { editDocumentImage } = await import("../module/sheet-dom.js");

test("shared portrait action persists the selected image through the Document", async () => {
  const updates = [];
  const sheet = {
    isEditable: true,
    document: {
      img: "icons/svg/mystery-man.svg",
      async update(update, options) {
        updates.push([update, options]);
        this.img = update.img;
      },
    },
  };
  let prevented = false;

  assert.equal(await editDocumentImage.call(
    sheet,
    { preventDefault() { prevented = true; } },
    { dataset: { edit: "img" } },
  ), true);
  assert.equal(prevented, true);
  assert.equal(browseCount, 1);
  assert.equal(pickerOptions.type, "image");
  assert.equal(pickerOptions.current, "icons/svg/mystery-man.svg");

  await pickerOptions.callback("systems/brinkwood-reforged/assets/portrait.webp");
  assert.deepEqual(updates, [[
    { img: "systems/brinkwood-reforged/assets/portrait.webp" },
    { render: true },
  ]]);
  assert.equal(sheet.document.img, "systems/brinkwood-reforged/assets/portrait.webp");
});

test("shared portrait action refuses read-only sheets", async () => {
  const before = browseCount;
  assert.equal(await editDocumentImage.call(
    { isEditable: false, document: { img: "old.webp" } },
    { preventDefault() {} },
    { dataset: { edit: "img" } },
  ), false);
  assert.equal(browseCount, before);
});
