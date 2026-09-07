import assert from "node:assert/strict";
import test from "node:test";
import { renderDescriptionTooltip } from "../module/item-tooltip.js";

test("identity tooltip preserves HTML supplied by Foundry enrichment", () => {
  const classTooltip = renderDescriptionTooltip("class", () => "<ul><li>Class grant</li></ul>");
  const pactTooltip = renderDescriptionTooltip("pact", () => "<p><strong>Pact oath</strong></p>");

  assert.match(classTooltip, /<ul><li>Class grant<\/li><\/ul>/);
  assert.doesNotMatch(classTooltip, /&lt;ul/);
  assert.match(pactTooltip, /<strong>Pact oath<\/strong>/);
  assert.doesNotMatch(pactTooltip, /&lt;strong/);
});
