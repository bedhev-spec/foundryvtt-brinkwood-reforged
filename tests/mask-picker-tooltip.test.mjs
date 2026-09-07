import assert from "node:assert/strict";
import test from "node:test";

const descriptions = {
  "Mask.Descriptions.Terror": "Terror description",
  "Mask.Descriptions.Violence": "Violence description",
  "Mask.Descriptions.Lies": "Lies description",
  "Mask.Descriptions.Riot": "Riot description",
  "Mask.Descriptions.Torment": "Torment description",
  "Mask.Descriptions.Judgement": "Judgement description",
  "Mask.Descriptions.Ruin": "Ruin description",
};

globalThis.game = {
  i18n: {
    localize: key => descriptions[key] ?? key,
  },
};

const { renderMaskPickerTooltip } = await import("../module/mask-picker-tooltip.js");

test("every Mask type receives its localized fallback description", () => {
  for (const name of ["Terror", "Violence", "Lies", "Riot", "Torment", "Judgement", "Ruin"]) {
    const tooltip = renderMaskPickerTooltip({ name, system: { load: 4 } }, "");
    assert.match(tooltip, /class="brinkwood-item-tooltip"/);
    assert.match(tooltip, new RegExp(`<header>${name}</header>`));
    assert.match(tooltip, new RegExp(`brinkwood-item-tooltip__description"><p>${name} description</p>`));
    assert.doesNotMatch(tooltip, /brinkwood-item-tooltip__stats/);
  }
});

test("Judgment spelling uses the rulebook Judgement description", () => {
  const tooltip = renderMaskPickerTooltip({ name: "Judgment", system: {} }, "");
  assert.match(tooltip, /<p>Judgement description<\/p>/);
});

test("an authored rich-text description takes priority over the fallback", () => {
  const tooltip = renderMaskPickerTooltip(
    { name: "Terror", system: {} },
    "<p><strong>Authored description</strong></p>",
  );
  assert.match(tooltip, /<p><strong>Authored description<\/strong><\/p>/);
  assert.doesNotMatch(tooltip, /Terror description/);
});

test("fallback descriptions remain escaped", () => {
  descriptions["Mask.Descriptions.Terror"] = "Fear <script>alert(1)</script>";
  const tooltip = renderMaskPickerTooltip({ name: "Terror", system: {} }, "");
  assert.match(tooltip, /Fear &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(tooltip, /<script>/);
});
