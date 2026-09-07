import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Mask uses the shared identity contract rather than an inline header implementation", async () => {
  const [sheet, portrait, name, row, tracker, styles, sharedStyles] = await Promise.all([
    read("templates/mask-sheet.html"),
    read("templates/parts/sheet-identity-portrait.html"),
    read("templates/parts/sheet-identity-name.html"),
    read("templates/parts/sheet-identity-row.html"),
    read("templates/parts/sheet-identity-tracker.html"),
    read("scss/import/mask-sheet.scss"),
    read("scss/import/sheet-identity.scss"),
  ]);

  assert.match(sheet, /class="mask-sheet__identity-block sheet-identity bw-section-frame\{\{#if maskItem\}\} mask-sheet__identity-block--with-attributes\{\{\/if\}\}"/);
  assert.match(sheet, /parts\/sheet-identity-portrait\.html/);
  assert.match(sheet, /parts\/sheet-identity-name\.html/);
  assert.match(sheet, /parts\/sheet-identity-row\.html" row=row editable=\.\.\/editable/);
  assert.equal((sheet.match(/parts\/sheet-identity-tracker\.html/g) ?? []).length, 2);
  assert.doesNotMatch(sheet, /mask-sheet__header|mask-sheet__portrait|mask-tracker__|mask-sheet__item-list/);
  assert.match(portrait, /data-action="editImage" data-edit="img" role="button" tabindex="0"/);
  assert.match(name, /class="name bw-text-field"/);
  assert.match(row, /class="item-delete identity-choice__remove"/);
  assert.match(row, /class="item-body identity-choice__text\{\{#if row\.reselect\}\} item-add-popup\{\{\/if\}\}"[\s\S]*?class="item-name identity-choice__content"/);
  assert.match(tracker, /data-path="\{\{\.\.\/trackerPath\}\}"/);
  assert.match(sharedStyles, /\.sheet-identity__portrait-frame[\s\S]*?width:\s*var\(--bw-portrait-size\)[\s\S]*?height:\s*var\(--bw-portrait-size\)/);
  assert.match(sharedStyles, /\.sheet-identity \.sheet-identity__rows\s*\{[\s\S]*?grid-auto-rows:\s*28px/);
  assert.match(styles, /\.mask-sheet__identity-block\s*\{[\s\S]*?grid-template-columns:\s*minmax\(150px, 200px\) minmax\(0, 1fr\)/);
  assert.match(styles, /\.mask-sheet__identity-block--with-attributes\s*\{[\s\S]*?grid-template-columns:\s*minmax\(150px, 200px\) minmax\(230px, 1fr\) 212px/);
  assert.match(styles, /\.mask-sheet__identity\s*\{[^}]*display:\s*grid;[^}]*gap:\s*10px;[^}]*min-width:\s*0/);
  assert.doesNotMatch(styles, /\.mask-sheet__identity\s*\{[^}]*(?:sheet-identity__rows|identity-choice__value)/);
  assert.doesNotMatch(styles, /\.mask-sheet__(?:header|portrait|item-list|item-open)\b/);
});

test("Mask name delegates Enter and change persistence to shared helpers", async () => {
  const [controller, dom] = await Promise.all([
    read("module/blades-mask-sheet.js"),
    read("module/sheet-dom.js"),
  ]);

  assert.match(controller, /form:\s*\{\s*submitOnChange:\s*false\s*\}/);
  assert.match(controller, /"keydown",\s*handleActorNameEnter/);
  assert.match(controller, /"change", event => this\._persistFormControl\(event\)/);
  assert.match(controller, /persistActorNameChange\(this, event\)/);
  assert.match(dom, /export function handleActorNameEnter\(event\)/);
  assert.match(dom, /event\.currentTarget\?\.blur\(\)/);
  assert.match(dom, /return persistFormControlChange\(sheet, input, \{/);
  assert.match(dom, /render: true/);
});

test("Mask retains the shared production tab workspace contract", async () => {
  const [entrypoint, sheet] = await Promise.all([
    read("scss/style.scss"),
    read("templates/mask-sheet.html"),
  ]);

  assert.match(entrypoint, /@import 'import\/sheet-identity\.scss'/);
  assert.match(entrypoint, /&\.actor\.mask\s*\{\s*@import 'import\/mask-sheet\.scss'/);
  assert.match(sheet, /class="mask-sheet__main sheet-tab-workspace"/);
  assert.match(sheet, /class="mask-sheet__tab-content sheet-tab-content"/);
});

test("Mask Ability CTA is gated by a configured Mask and uses the shared Trait Card", async () => {
  const [template, controller, sharedSheet] = await Promise.all([
    read("templates/mask-sheet.html"),
    read("module/blades-mask-sheet.js"),
    read("module/blades-sheet.js"),
  ]);

  const traitsPanel = template.match(/data-tab="traits"[\s\S]*?<\/section>/)?.[0] ?? "";
  assert.match(template, />\{\{localize "Mask\.Abilities"\}\}<\/button>/);
  assert.doesNotMatch(template, />\{\{localize "BITD\.Traits"\}\}<\/button>/);
  assert.match(traitsPanel, /\{\{#if canAddMaskTraits\}\}[\s\S]*?class="mask-sheet__trait-add item-add-popup"[\s\S]*?data-item-type="trait"/);
  assert.match(traitsPanel, /parts\/actor\/trait-card\.html/);
  assert.ok(traitsPanel.indexOf("mask-sheet__trait-add") < traitsPanel.indexOf("parts/actor/trait-card.html"));
  assert.doesNotMatch(traitsPanel, /<h2>\{\{localize "BITD\.Traits"\}\}<\/h2>/);
  assert.doesNotMatch(traitsPanel, /<p class="mask-sheet__empty">\{\{localize "BITD\.Traits"\}\}<\/p>/);
  assert.match(traitsPanel, /class="mask-sheet__trait-add-content"[\s\S]*?class="mask-sheet__trait-add-icon"[\s\S]*?class="mask-sheet__trait-add-label"/);
  assert.match(traitsPanel, /class="mask-sheet__trait-add-label">\{\{localize "Add"\}\} \{\{localize "Mask\.Ability"\}\}/);
  assert.match(await read("scss/import/mask-sheet.scss"), /\.mask-sheet__trait-add\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-height:\s*40px;[\s\S]*?border:\s*1px dashed var\(--bw-rule\);[\s\S]*?border-left:\s*5px solid var\(--bw-accent\)/);
  assert.match(await read("scss/import/mask-sheet.scss"), /\.mask-sheet__trait-add\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*start/);
  assert.match(await read("scss/import/mask-sheet.scss"), /\.mask-sheet__trait-add-content\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*center;[\s\S]*?height:\s*20px/);
  assert.match(await read("scss/import/mask-sheet.scss"), /\.mask-sheet__trait-add-icon\s*\{[\s\S]*?&::before,[\s\S]*?&::after[\s\S]*?inset-block-start:\s*50%;[\s\S]*?inset-inline-start:\s*50%/);
  assert.doesNotMatch(await read("scss/import/mask-sheet.scss"), /\.mask-sheet__trait-add-content\s*\{[\s\S]*?translateY/);
  assert.match(controller, /context\.maskItem = context\.items\.find\(item => item\.type === "mask"\) \?\? null;/);
  assert.match(controller, /context\.traits = this\._prepareTraitDisplayOrder\(getMaskTraitsForSource\(context\.items, context\.maskItem\)/);
  assert.match(controller, /context\.canAddMaskTraits = Boolean\(context\.maskItem\) && context\.editable;/);
  assert.match(controller, /async _getItemPickerItems\(itemType\)[\s\S]*?getEligibleMaskTraits\(items, this\.actor\.items, maskItem\)/);
  assert.match(controller, /repairTraitGrantsForSourceIds\(\[itemId\(maskItem\)\], false, traitSourceIds\)/);
  assert.match(sharedSheet, /async _getItemPickerItems\(itemType\)[\s\S]*?getItemsByType\(itemType, game\)/);
  assert.match(sharedSheet, /this\._getItemPickerLabel\(item_type\)/);
  assert.match(controller, /_getItemPickerLabel\(itemType\)[\s\S]*?itemType === "trait"[\s\S]*?Mask\.Ability/);
});
