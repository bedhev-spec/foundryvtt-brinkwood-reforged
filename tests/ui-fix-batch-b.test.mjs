import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Mask Essence uses assigned Character Oath and read-only items remain viewable", async () => {
  const [template, controller, tracker] = await Promise.all([
    read("templates/mask-sheet.html"),
    read("module/blades-mask-sheet.js"),
    read("templates/parts/sheet-identity-tracker.html"),
  ]);

  assert.match(controller, /context\.system\.oath\s*=\s*game\.user\.character\?\.system\?\.oath\s*\|\|\s*0/);
  assert.match(template, /rollValue=system\.oath/);
  assert.match(tracker, /data-roll-value="\{\{rollValue\}\}"/);
  assert.doesNotMatch(template, /data-roll-value="\{\{system\.essence\.value\}\}"/);
  assert.ok(controller.indexOf('querySelectorAll(".item-body")') < controller.indexOf("if (!this.isEditable) return;"));
  assert.doesNotMatch(controller, /\b_dig\s*\(|\b_setDeep\s*\(/);
});
