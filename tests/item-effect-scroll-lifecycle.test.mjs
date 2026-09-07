import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

globalThis.Hooks = { on() {} };
globalThis.foundry = {
  applications: {
    api: { HandlebarsApplicationMixin: Base => Base },
    sheets: { ItemSheetV2: class {} },
  },
  documents: { ActiveEffect: class {} },
};

const { BladesItemSheet } = await import("../module/blades-item-sheet.js");

const root = new URL("../", import.meta.url);
const templates = ["item", "simple", "class", "trait", "moot_decision"];

test("Item sheet parts and templates expose one scrollable form root", async () => {
  const parts = Object.values(BladesItemSheet.PARTS);
  assert.ok(parts.length > 0);
  for (const part of parts) assert.deepEqual(part.scrollable, [""]);

  for (const name of templates) {
    const markup = await readFile(new URL(`templates/items/${name}.html`, root), "utf8");
    assert.equal(markup.split("<form").length - 1, 1, `${name} has one form root`);
    assert.equal(markup.split("</form>").length - 1, 1, `${name} closes that form root`);
  }
});
