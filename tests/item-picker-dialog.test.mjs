import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

globalThis.foundry = {
  abstract: { TypeDataModel: class {} },
  data: { fields: {} },
  applications: {
    api: { HandlebarsApplicationMixin: Base => Base },
    sheets: { ActorSheetV2: class {} }
  }
};

const { BladesSheet, readItemPickerSelection } = await import("../module/blades-sheet.js");
const {
  createHeightResizablePickerDialog,
  itemPickerDialogHeight,
  promptItemPicker,
  renderItemPickerContent,
} = await import("../module/item-picker-dialog.js");

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("shared item picker owns rendering, height-only resizing, and list scrolling", async () => {
  const [controller, component, styles] = await Promise.all([
    read("module/blades-sheet.js"),
    read("module/item-picker-dialog.js"),
    read("scss/import/dialogs.scss"),
  ]);

  assert.match(controller, /promptItemPicker\(\{[\s\S]*?rows:\s*pickerRows[\s\S]*?inputType:\s*input_type/);
  assert.match(component, /classes:\s*\["item-picker-dialog"\]/);
  assert.doesNotMatch(component, /classes:\s*\[[^\]]*"brinkwood"/);
  assert.match(component, /createHeightResizablePickerDialog\(foundry\.applications\.api\.DialogV2\)/);
  assert.match(component, /resizable:\s*true/);
  assert.match(styles, /\.item-picker-dialog\s*\{[\s\S]*?\.dialog-form\s*\{[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\) auto;[\s\S]*?\.items-to-add\s*\{[\s\S]*?height:\s*100%;[\s\S]*?min-block-size:\s*0;[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;[\s\S]*?scrollbar-gutter:\s*stable;/);

  assert.equal(itemPickerDialogHeight(1, 1000), 220);
  assert.equal(itemPickerDialogHeight(30, 1000), 640);
  assert.equal(itemPickerDialogHeight(30, 500), 452);

  const html = renderItemPickerContent([
    { id: 'trait-"unsafe', name: "Taunt & Test", details: "(1)", tooltipHtml: "<p>Rule</p>" },
  ], { inputType: "checkbox", tooltipLabel: "Details" });
  assert.match(html, /class="item-picker-content"/);
  assert.doesNotMatch(html, /<form\b/);
  assert.match(html, /value="trait-&quot;unsafe"/);
  assert.match(html, /Taunt &amp; Test/);
  assert.match(html, /data-tooltip-html="&lt;p&gt;Rule&lt;\/p&gt;"/);

  let dialogOptions;
  globalThis.foundry.applications.api.DialogV2 = class {
    static prompt(options) {
      dialogOptions = options;
      return "selection-promise";
    }
  };
  let renderedDialog;
  assert.equal(promptItemPicker({
    rows: [],
    inputType: "radio",
    title: "Add identity",
    addLabel: "Add",
    tooltipLabel: "Details",
    onDialog: dialog => { renderedDialog = dialog; },
  }), "selection-promise");
  assert.equal(dialogOptions.window.resizable, true);
  assert.equal(dialogOptions.position.height, 220);
  const dialogReference = {};
  dialogOptions.render({}, dialogReference);
  assert.equal(renderedDialog, dialogReference);

  class DialogStub {
    async _onFirstRender() {}
    setPosition(position) {
      this.appliedPosition = position;
      return position;
    }
  }
  const HeightResizableDialog = createHeightResizablePickerDialog(DialogStub);
  const dialog = new HeightResizableDialog();
  dialog.setPosition({ width: 400, height: 500 });
  assert.deepEqual(dialog.appliedPosition, { width: 400, height: 500 });
  await dialog._onFirstRender({}, {});
  dialog.setPosition({ left: 10, top: 20, width: 640, height: 580 });
  assert.deepEqual(dialog.appliedPosition, { left: 10, top: 20, height: 580 });
});

test("item picker reads checked radios from the DialogV2 element when the action button has no form", () => {
  const checked = [{ value: "upbringing-apprentice" }];
  const dialog = {
    element: {
      querySelector(selector) {
        assert.equal(selector, "form");
        return {
          querySelectorAll(inputSelector) {
            assert.equal(inputSelector, ".items-to-add input:checked");
            return checked;
          },
          querySelector(inputSelector) {
            assert.equal(inputSelector, ".items-to-add");
            return {};
          }
        };
      }
    }
  };

  assert.deepEqual(readItemPickerSelection({ form: null }, dialog), ["upbringing-apprentice"]);
});

test("item picker ignores an unrelated action-button form and uses the DialogV2 picker form", () => {
  const unrelatedForm = {
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };
  const pickerForm = {
    querySelectorAll() { return [{ value: "upbringing-apprentice" }]; },
    querySelector(selector) { return selector === ".items-to-add" ? {} : null; }
  };
  const dialog = { element: { querySelector: () => pickerForm } };

  assert.deepEqual(readItemPickerSelection({ form: unrelatedForm }, dialog), ["upbringing-apprentice"]);
});

test("a sheet permits one item picker request per item type", async () => {
  const sheet = new BladesSheet();
  Object.defineProperty(sheet, "isEditable", { value: true });

  const openCounts = new Map();
  const finishPickers = new Map();
  const dialogs = new Map();
  sheet._openItemPicker = async (element, { onDialog }) => {
    const itemType = element.dataset.itemType;
    openCounts.set(itemType, (openCounts.get(itemType) ?? 0) + 1);
    const dialog = { bringToFrontCount: 0, bringToFront() { this.bringToFrontCount += 1; } };
    dialogs.set(itemType, dialog);
    onDialog(dialog);
    await new Promise(resolve => { finishPickers.set(itemType, resolve); });
  };

  const eventFor = itemType => ({
    currentTarget: { dataset: { itemType } },
    preventDefault() {},
  });
  const firstPact = sheet._onItemAddClick(eventFor("pact"));
  const duplicatePact = sheet._onItemAddClick(eventFor("pact"));
  const profession = sheet._onItemAddClick(eventFor("profession"));

  assert.equal(openCounts.get("pact"), 1);
  assert.equal(openCounts.get("profession"), 1);
  assert.equal(dialogs.get("pact").bringToFrontCount, 1);
  assert.equal(sheet._itemPickerRequests.size, 2);

  finishPickers.get("pact")();
  await Promise.all([firstPact, duplicatePact]);
  assert.equal(sheet._itemPickerRequests.has("pact"), false);
  assert.equal(sheet._itemPickerRequests.has("profession"), true);

  const nextPact = sheet._onItemAddClick(eventFor("pact"));
  assert.equal(openCounts.get("pact"), 2);
  finishPickers.get("pact")();
  finishPickers.get("profession")();
  await Promise.all([nextPact, profession]);
  assert.equal(sheet._itemPickerRequests.size, 0);
});
