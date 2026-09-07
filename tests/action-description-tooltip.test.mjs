import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { prepareActionDescriptionTooltips } from "../module/action-description-tooltip.js";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("action descriptions use the shared titled tooltip component", async () => {
  const attributes = {
    insight: {
      skills: {
        hunt: { label: "Actor.Actions.Hunt.Name", desc: "Actor.Actions.Hunt.Description" },
      },
    },
  };
  const labels = {
    "Actor.Actions.Hunt.Name": "Hunt",
    "Actor.Actions.Hunt.Description": "Follow a <strong>target</strong>.<ul><li>Track them.</li></ul>",
  };

  prepareActionDescriptionTooltips(attributes, key => labels[key] ?? key);

  assert.match(attributes.insight.skills.hunt.tooltipHtml, /<header>Hunt<\/header>/);
  assert.match(attributes.insight.skills.hunt.tooltipHtml, /<strong>target<\/strong>/);
  assert.match(attributes.insight.skills.hunt.tooltipHtml, /<ul><li>Track them\.<\/li><\/ul>/);
  assert.doesNotMatch(attributes.insight.skills.hunt.tooltipHtml, /&lt;(?:strong|ul)&gt;/);

  const [character, mask] = await Promise.all([
    read("templates/parts/attributes.html"),
    read("templates/parts/mask-attributes.html"),
  ]);
  for (const template of [character, mask]) {
    assert.match(template, /data-tooltip-html="\{\{skill\.tooltipHtml\}\}"/);
    assert.match(template, /data-tooltip-class="brinkwood-item-tooltip-shell"/);
    assert.doesNotMatch(template, /data-tooltip="\{\{skill\.desc\}\}"/);
  }
});

test("additional Essence slots use the registered contains block helper", async () => {
  const tracker = await read("templates/parts/sheet-identity-tracker.html");
  assert.match(tracker, /\{\{#contains this \.\.\/tracker\.additionalSlots\}\}/);
  assert.doesNotMatch(tracker, /\{\{#if \(contains /);
});
