import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("tracker help uses the identity tooltip hierarchy", async () => {
  const [tracker, styles] = await Promise.all([
    read("templates/parts/sheet-identity-tracker.html"),
    read("scss/import/tooltip.scss"),
  ]);

  assert.match(tracker, /\{\{#if tooltip\}\} data-tooltip-html=/);
  assert.match(tracker, /brinkwood-item-tooltip brinkwood-tracker-tooltip/);
  assert.match(tracker, /<header>\{\{#if label\}\}\{\{localize label\}\}/);
  assert.match(tracker, /brinkwood-item-tooltip__description/);
  assert.match(tracker, /brinkwood-tracker-tooltip__subinfo/);
  assert.match(tracker, /\{\{localize 'BITD\.Progress'\}\}/);
  assert.match(tracker, /<strong>\{\{tracker\.value\}\}<\/strong> \/ \{\{tracker\.max\}\}/);
  assert.match(tracker, /data-tooltip-class="brinkwood-item-tooltip-shell"/);
  assert.doesNotMatch(tracker, /data-tooltip="\{\{tooltip\}\}"/);
  assert.match(styles, /\.brinkwood-tracker-tooltip__subinfo\s*\{[\s\S]*?border-top:/);
});
