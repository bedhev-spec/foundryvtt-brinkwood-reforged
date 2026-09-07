import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  formatPactTooltipDescription,
  formatTooltipDescription,
  renderDescriptionTooltip,
  renderItemTooltip,
} from "../module/item-tooltip.js";
import { prepareItemPickerRows } from "../module/item-picker-preparation.js";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("selected identity values use the same titled tooltip UI as picker items", async () => {
  const [template, identityRow, controller] = await Promise.all([
    read("templates/actor-sheet.html"), read("templates/parts/sheet-identity-row.html"), read("module/blades-actor-sheet.js"),
  ]);
  assert.equal((template.match(/parts\/sheet-identity-row\.html/g) ?? []).length, 1);
  assert.match(identityRow, /tooltip tooltip-trigger--plain/);
  assert.match(identityRow, /data-tooltip-html="\{\{row\.item\.identityTooltipHtml\}\}"/);
  assert.match(identityRow, /data-tooltip-class="brinkwood-item-tooltip-shell"/);
  assert.match(controller, /identityDefinitions[\s\S]*?itemType: "upbringing"[\s\S]*?descriptionRoot: "Actor\.Upbringings"[\s\S]*?itemType: "profession"[\s\S]*?descriptionRoot: "Actor\.Professions"[\s\S]*?itemType: "class"[\s\S]*?descriptionKey: "Actor\.Classes\.Description"[\s\S]*?itemType: "pact"[\s\S]*?descriptionRoot: "Actor\.Pacts"/);
  assert.match(controller, /const descriptionKey = definition\.descriptionKey \?\? `\$\{definition\.descriptionRoot\}\.\$\{item\.name\}`;/);
  assert.match(controller, /const enrichedDescription = await foundry\.applications\.ux\.TextEditor\.implementation\.enrichHTML\([\s\S]*?async: true,[\s\S]*?relativeTo: this\.document,[\s\S]*?secrets: this\.document\.isOwner/);
  assert.match(controller, /identityTooltipHtml = \["class", "profession"\]\.includes\(item\.type\)[\s\S]*?renderActionDotSourceTooltip\(item, enrichedDescription/);
  assert.doesNotMatch(controller, /identityTooltipHtml = escapeHTML/);
});

test("Character picker routes Class, Profession, and Pact through authoritative narrative tooltips", async () => {
  const controller = await read("module/blades-actor-sheet.js");
  assert.match(controller, /_renderItemPickerTooltip\(item, enrichedDescription\)[\s\S]*?\["class", "profession", "pact"\]\.includes\(item\?\.type\)/);
  assert.match(controller, /item\.type === "class"[\s\S]*?"Actor\.Classes\.Description"[\s\S]*?profession: `Actor\.Professions\.\$\{item\.name\}`[\s\S]*?pact: `Actor\.Pacts\.\$\{item\.name\}`/);
  assert.match(controller, /renderActionDotSourceTooltip\([\s\S]*?item,[\s\S]*?descriptionHtml/);
  assert.match(controller, /formatTooltipDescription\(descriptionHtml\)/);
  assert.match(controller, /: `<p>\$\{localizedDescription\}<\/p>`/);
  assert.doesNotMatch(controller, /escapeHTML\(localizedDescription\)/);
});

test("item-picker help preserves Foundry-enriched rich text without double encoding", () => {
  const enriched = [];
  const tooltip = renderItemTooltip(
    { name: "Apprentice", type: "upbringing", system: { description: '<p>Learned &rsquo;<strong>the craft</strong>.<script>bad()</script></p>' } },
    key => key,
    value => { enriched.push(value); return value.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ""); },
  );
  assert.equal(enriched.length, 1);
  assert.match(tooltip, /<p>Learned &rsquo;<strong>the craft<\/strong>\.<\/p>/);
  assert.doesNotMatch(tooltip, /&lt;p&gt;|&amp;rsquo;|<script|bad\(\)/);
});

test("description-only identity tooltips retain readable paragraph structure", () => {
  const tooltip = renderDescriptionTooltip("First sentence. Second sentence. Third sentence. Fourth sentence.");
  assert.match(tooltip, /brinkwood-item-tooltip--description-only/);
  assert.match(tooltip, /<p>First sentence\. Second sentence\.<\/p><p>Third sentence\. Fourth sentence\.<\/p>/);
});

test("plain prose and semicolon clauses gain paragraphs without changing words", () => {
  assert.equal(
    formatTooltipDescription("First sentence. Second sentence. Third sentence."),
    "<p>First sentence. Second sentence.</p><p>Third sentence.</p>",
  );
  assert.equal(
    formatTooltipDescription("<p>First promise; second promise; final promise.</p>"),
    "<p>First promise;</p><p>second promise;</p><p>final promise.</p>",
  );
});

test("Pact vows render semicolon-delimited clauses as bullets", () => {
  assert.equal(
    formatPactTooltipDescription("<p>You swear your <strong>Pact to Beauty</strong>, to write; to demand bread; to find hope.</p>"),
    "<p>You swear your <strong>Pact to Beauty</strong></p><ul><li>to write;</li><li>to demand bread;</li><li>to find hope.</li></ul>",
  );
  assert.equal(
    formatPactTooltipDescription("<p>You swear a <strong>Pact of Vengeance</strong>, to humble the proud.</p>"),
    "<p>You swear a <strong>Pact of Vengeance</strong></p><ul><li>to humble the proud.</li></ul>",
  );
  assert.equal(
    formatPactTooltipDescription("<p>You swear a single promise.</p>"),
    "<p>You swear a single promise.</p>",
  );
});

test("the picker prepares enriched rows with document-relative Foundry options", async () => {
  const document = { isOwner: true };
  const calls = [];
  const tooltips = [];
  const rows = await prepareItemPickerRows([
    { _id: "mask-1", name: "TYPES.Item.mask", system: { description: "<p>Mask</p>", load: 2 } },
    { _id: "trait-1", name: "TYPES.Item.trait", system: { description: "<p>Trait</p>", price: 3 } },
  ], {
    document,
    localize: key => `localized:${key}`,
    enrichHTML: async (description, options) => {
      calls.push({ description, options });
      return `enriched:${description}`;
    },
    renderTooltip: (item, enrichedDescription) => {
      tooltips.push({ id: item._id, enrichedDescription });
      return `tooltip:${item._id}`;
    },
  });

  assert.deepEqual(calls, [
    { description: "<p>Mask</p>", options: { async: true, relativeTo: document, secrets: true } },
    { description: "<p>Trait</p>", options: { async: true, relativeTo: document, secrets: true } },
  ]);
  assert.deepEqual(tooltips, [
    { id: "mask-1", enrichedDescription: "enriched:<p>Mask</p>" },
    { id: "trait-1", enrichedDescription: "enriched:<p>Trait</p>" },
  ]);
  assert.deepEqual(rows, [
    { id: "mask-1", name: "localized:TYPES.Item.mask", details: "(2)", tooltipHtml: "tooltip:mask-1" },
    { id: "trait-1", name: "localized:TYPES.Item.trait", details: "(3)", tooltipHtml: "tooltip:trait-1" },
  ]);
});

test("the shared picker retains Mask tooltip specialization and dialog escaping", async () => {
  const [sheet, picker, maskSheet] = await Promise.all([
    read("module/blades-sheet.js"),
    read("module/item-picker-dialog.js"),
    read("module/blades-mask-sheet.js"),
  ]);
  assert.match(sheet, /prepareItemPickerRows\(items,[\s\S]*?renderTooltip: \(item, enrichedDescription\) => this\._renderItemPickerTooltip\(item, enrichedDescription\)/);
  assert.match(picker, /const tooltipHtml = escapeHTML\(row\.tooltipHtml\)/);
  assert.match(sheet, /_renderItemPickerTooltip\(item, enrichedDescription\)[\s\S]*?renderItemTooltip\([\s\S]*?\(\) => enrichedDescription/);
  assert.match(maskSheet, /_renderItemPickerTooltip\(item, enrichedDescription\)[\s\S]*?item\?\.type === "mask"[\s\S]*?renderMaskPickerTooltip\(item, enrichedDescription\)[\s\S]*?super\._renderItemPickerTooltip\(item, enrichedDescription\)/);
  assert.doesNotMatch(maskSheet, /_getItemPickerInputType/);
});

test("item-picker tooltip styles preserve paragraph spacing", async () => {
  const styles = await read("scss/import/tooltip.scss");
  assert.match(styles, /\.tooltip\[data-tooltip-html\]:not\(\.tooltip-trigger--plain\)\s*\{[\s\S]*?padding:\s*4px/);
  assert.doesNotMatch(styles, /\.tooltip\[data-tooltip-html\]\s*\{[\s\S]*?padding:\s*4px/);
  assert.match(styles, /brinkwood-item-tooltip-shell[\s\S]*?font-size:\s*17px[\s\S]*?line-height:\s*1\.35/);
  assert.match(styles, /\.brinkwood-item-tooltip\s*\{\s*font-size:\s*inherit;/);
  assert.match(styles, /\.brinkwood-item-tooltip header\s*\{[\s\S]*?font-size:\s*calc\(1\.15rem \+ 2px\)/);
  assert.doesNotMatch(styles, /aside#tooltip\.brinkwood-tooltip\s*\{[^}]*font-size:\s*17px/);
  assert.match(styles, /\.brinkwood-item-tooltip__description\s*\{[\s\S]*?margin-top:\s*8px/);
  assert.match(styles, /\.brinkwood-item-tooltip__description[\s\S]*?p\s*\{[\s\S]*?margin:\s*0 0 \.8em/);
});
