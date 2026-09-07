import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("selected Mask type uses the same titled tooltip UI as the Mask picker", async () => {
  const [template, row, controller] = await Promise.all([
    read("templates/mask-sheet.html"),
    read("templates/parts/sheet-identity-row.html"),
    read("module/blades-mask-sheet.js"),
  ]);

  assert.match(template, /parts\/sheet-identity-row\.html" row=row editable=\.\.\/editable/);
  assert.match(row, /data-tooltip-html="\{\{row\.item\.identityTooltipHtml\}\}"/);
  assert.match(row, /data-tooltip-class="brinkwood-item-tooltip-shell"/);
  assert.match(controller, /context\.maskItem = context\.items\.find\(item => item\.type === "mask"\) \?\? null;/);
  assert.match(controller, /const descriptionKey = maskDescriptionKey\(context\.maskItem\.name\);/);
  assert.match(controller, /TextEditor\.implementation\.enrichHTML\([\s\S]*?relativeTo: this\.document,[\s\S]*?secrets: this\.document\.isOwner/);
  assert.match(controller, /context\.maskItem\.identityTooltipHtml = renderMaskPickerTooltip\([\s\S]*?context\.maskItem,[\s\S]*?enrichedDescription/);
});

test("expanded Mask view preserves its 80px growth from the compact width", async () => {
  const controller = await read("module/blades-mask-sheet.js");

  assert.match(controller, /MASK_SHEET_DEFAULT_WIDTH = 680/);
  assert.match(controller, /MASK_SHEET_ATTRIBUTES_WIDTH = 760/);
});
