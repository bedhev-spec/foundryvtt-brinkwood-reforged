import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Mask Attributes live in the identity header and share Character presentation", async () => {
  const [maskSheet, maskAttributes, maskStyles, sharedStyles, characterSheet, controller] = await Promise.all([
    read("templates/mask-sheet.html"),
    read("templates/parts/mask-attributes.html"),
    read("scss/import/mask-sheet.scss"),
    read("scss/import/general-styles.scss"),
    read("templates/actor-sheet.html"),
    read("module/blades-mask-sheet.js"),
  ]);

  const header = maskSheet.match(/<header\b[\s\S]*?<\/header>/)?.[0] ?? "";
  const traitsPanel = maskSheet.match(/data-tab="traits"[\s\S]*?<\/section>/)?.[0] ?? "";
  assert.match(header, /\{\{#if maskItem\}\}[\s\S]*?parts\/mask-attributes\.html[\s\S]*?\{\{\/if\}\}/);
  assert.doesNotMatch(traitsPanel, /parts\/mask-attributes\.html/);

  assert.match(maskAttributes, /class="mask-attributes mask-attribute-card sheet-attribute-presentation bw-ruled-card bw-ruled-card--trait-palette"/);
  assert.match(maskAttributes, /class="attributes-exp bw-ruled-card__title-band"[\s\S]*?class="stripe"[\s\S]*?<button type="button" class="attribute-label roll-die-attribute rollable-text"[\s\S]*?data-roll-attribute="\{\{system\.type\}\}"[\s\S]*?data-roll-value="\{\{system\.mask_attributes\.value\}\}"/);
  assert.match(maskAttributes, /class="mask-attribute-card__body bw-ruled-card__body"/);
  assert.match(maskAttributes, /class="attributes-container mask-skill"[\s\S]*?dot-value--empty[\s\S]*?dot-value--filled[\s\S]*?class="attribute-skill-label roll-die-attribute/);
  assert.match(characterSheet, /class="character-attributes sheet-attribute-presentation"/);
  assert.match(sharedStyles, /\.sheet-attribute-presentation\s*\{[\s\S]*?--bw-attribute-header-height:\s*34px;[\s\S]*?--bw-attribute-header-font-family:\s*"Crimson Text", serif;[\s\S]*?--bw-attribute-row-height:\s*28px;[\s\S]*?--bw-attribute-dot-track:\s*26px;[\s\S]*?\.stripe\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;[\s\S]*?min-height:\s*var\(--bw-attribute-header-height\);[\s\S]*?\.attribute-skill-label\s*\{[\s\S]*?font-family:\s*var\(--bw-attribute-row-font-family\);[\s\S]*?\.attributes-container\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, var\(--bw-attribute-dot-track\)\) minmax\(0, 1fr\)[\s\S]*?button\.dot-value\s*\{[\s\S]*?font-size:\s*var\(--bw-attribute-row-font-size\);[\s\S]*?transform:\s*translateY\(7px\)[\s\S]*?\.dot-value--filled::before/);

  assert.match(controller, /MASK_SHEET_DEFAULT_WIDTH\s*=\s*680/);
  assert.match(controller, /MASK_SHEET_ATTRIBUTES_WIDTH\s*=\s*760/);
  assert.match(controller, /position:\s*\{\s*width:\s*MASK_SHEET_DEFAULT_WIDTH,\s*height:\s*840\s*\}/);
  assert.match(controller, /async _syncMaskAttributeAvailability\(hasMaskType\)[\s\S]*?const becameAvailable = available && !this\._maskAttributesAvailable;[\s\S]*?if \(becameAvailable\) await this\._expandForMaskAttributes\(\);[\s\S]*?else if \(!available && wasAvailable\) await this\._shrinkForMaskAttributes\(\);/);
  assert.match(controller, /await this\._syncMaskAttributeAvailability\(Boolean\(context\.maskItem\)\);/);
  assert.match(maskStyles, /\.mask-sheet__identity-block\s*\{[\s\S]*?grid-template-columns:\s*minmax\(150px, 200px\) minmax\(0, 1fr\);[\s\S]*?column-gap:\s*20px;[\s\S]*?block-size:\s*222px;/);
  assert.match(maskStyles, /\.window-content\s*\{\s*padding:\s*0;/);
  assert.match(maskStyles, /\.mask-sheet__identity-block--with-attributes\s*\{[\s\S]*?grid-template-columns:\s*minmax\(150px, 200px\) minmax\(230px, 1fr\) 212px;/);
  assert.match(maskStyles, /\.mask-attributes\s*\{[\s\S]*?align-self:\s*start;[\s\S]*?margin-block-start:\s*20px;/);
  assert.match(maskStyles, /\.mask-attribute-card\s*\{[\s\S]*?border-left:\s*1px solid var\(--bw-ruled-card-rule\)/);
  assert.match(maskStyles, /\.mask-attribute-card \.stripe\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?color:\s*var\(--bw-ink\)/);
  assert.match(maskStyles, /\.mask-attribute-card__body \.flex-horizontal \+ \.flex-horizontal\s*\{[\s\S]*?border-top:/);
  assert.match(maskStyles, /@container \(max-width: 650px\)\s*\{[\s\S]*?\.mask-sheet__identity-block\s*\{[\s\S]*?grid-template-columns:\s*minmax\(150px, 200px\) minmax\(0, 1fr\)[\s\S]*?block-size:\s*auto;[\s\S]*?\.mask-attributes\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1/);
  assert.match(maskStyles, /&\.mask-sheet--attribute-resizing\s*\{\s*transition:\s*width 180ms ease;/);
  assert.doesNotMatch(maskStyles, /color:\s*var\(--bw-ink\);\s*transition:/);
  assert.match(maskStyles, /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?&\.mask-sheet--attribute-resizing\s*\{\s*transition:\s*none;/);
});

test("Mask Attribute parity has one shared visual owner and preserves its responsive and persistence contracts", async () => {
  const [maskSheet, maskAttributes, maskStyles, sharedStyles, legacyEffects, legacyPolish, compiledStyles] = await Promise.all([
    read("templates/mask-sheet.html"),
    read("templates/parts/mask-attributes.html"),
    read("scss/import/mask-sheet.scss"),
    read("scss/import/general-styles.scss"),
    read("scss/import/legacy-character-effects.scss"),
    read("scss/import/legacy-character-sheet-polish.scss"),
    read("styles/blades.css"),
  ]);

  assert.match(maskAttributes, /data-path="system\.attributes\.\{\{\.\.\/\.\.\/system\.type\}\}\.skills\.\{\{skill_name\}\}\.value"/);
  assert.match(maskAttributes, /\{\{#unless \.\.\/\.\.\/editable\}\} disabled\{\{\/unless\}\}/);
  assert.match(maskSheet, /tracker=system\.essence[\s\S]*?tooltip="Mask\.Essence\.Tooltip"/);
  assert.match(maskStyles, /\.mask-essence \.dot-value--additional-essence\s*\{[\s\S]*?opacity:\s*0\.5;[\s\S]*?filter:\s*grayscale\(1\);[\s\S]*?outline:\s*1px dotted/);

  assert.match(sharedStyles, /h2\.attribute-label\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*center;[\s\S]*?min-height:\s*var\(--bw-attribute-header-height\);[\s\S]*?font-family:\s*var\(--bw-attribute-header-font-family\);[\s\S]*?font-size:\s*var\(--bw-attribute-header-font-size\);[\s\S]*?line-height:\s*var\(--bw-attribute-header-line-height\);/);
  assert.match(sharedStyles, /&:focus,\s*&:active\s*\{[\s\S]*?box-shadow:\s*none;/);
  assert.match(sharedStyles, /&:focus-visible::before\s*\{[\s\S]*?outline-offset:\s*3px;/);
  assert.doesNotMatch(legacyEffects, /\.attributes-container button\.dot-value/);
  assert.doesNotMatch(legacyPolish, /\.attributes \.attributes-container/);

  assert.match(maskStyles, /\.mask-sheet__traits-workspace\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/);
  assert.doesNotMatch(maskStyles, /0\.42fr/);
  assert.match(maskStyles, /\.mask-sheet__trait-library\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1;[\s\S]*?inline-size:\s*100%;/);
  assert.match(maskStyles, /@container \(max-width: 480px\)\s*\{[\s\S]*?\.mask-sheet__identity-block\s*\{[\s\S]*?grid-template-columns:\s*96px minmax\(0, 1fr\);[\s\S]*?\.sheet-identity__portrait\s*\{[\s\S]*?--bw-portrait-size:\s*96px;[\s\S]*?grid-row:\s*span 3;/);

  assert.match(compiledStyles, /\.brinkwood \.sheet-attribute-presentation h2\.attribute-label\s*\{[\s\S]*?min-height:\s*var\(--bw-attribute-header-height\);[\s\S]*?font-size:\s*var\(--bw-attribute-header-font-size\);/);
  assert.match(compiledStyles, /\.brinkwood\.actor\.mask\.mask-sheet--attribute-resizing\s*\{\s*transition:\s*width 180ms ease;/);
  assert.doesNotMatch(compiledStyles, /\.brinkwood\.actor\.mask\s*\{[^}]*transition:\s*width/);
  assert.match(compiledStyles, /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.brinkwood\.actor\.mask\.mask-sheet--attribute-resizing\s*\{\s*transition:\s*none;/);
  assert.match(compiledStyles, /\.brinkwood\.actor\.mask \.mask-sheet__traits-workspace\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/);
  assert.match(compiledStyles, /@container \(max-width: 480px\)\s*\{[\s\S]*?\.brinkwood\.actor\.mask \.mask-sheet__identity-block\s*\{[\s\S]*?grid-template-columns:\s*96px minmax\(0, 1fr\);/);
});

test("configured Mask Attribute column matches one default Character Attribute column", async () => {
  const [characterStyles, maskStyles] = await Promise.all([
    read("scss/import/character-sheet.scss"),
    read("scss/import/mask-sheet.scss"),
  ]);
  const characterColumnWidth = (700 - (20 * 2) - (12 * 2)) / 3;
  const configuredMaskContentWidth = 780 - (16 * 2);
  const compactMaskContentWidth = 700 - (16 * 2);
  const maskHeaderMinimumWidth = 150 + 230 + characterColumnWidth + (20 * 2);

  assert.equal(characterColumnWidth, 212);
  assert.equal(configuredMaskContentWidth, 748);
  assert.equal(compactMaskContentWidth, 668);
  assert.equal(maskHeaderMinimumWidth, 632);
  assert.ok(configuredMaskContentWidth > maskHeaderMinimumWidth);
  assert.ok(compactMaskContentWidth > 650);
  assert.match(characterStyles, /form\.actor-sheet\s*\{[\s\S]*?padding:\s*20px;/);
  assert.match(characterStyles, /character-attributes > \.attributes\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)[\s\S]*?gap:\s*12px;/);
  assert.match(maskStyles, /grid-template-columns:\s*minmax\(150px, 200px\) minmax\(230px, 1fr\) 212px;/);
  assert.match(maskStyles, /@container \(max-width: 650px\)/);
});

test("Attribute typography and centering have one shared cascade owner", async () => {
  const [sharedStyles, characterStyles, maskStyles, compiledStyles] = await Promise.all([
    read("scss/import/general-styles.scss"),
    read("scss/import/character-sheet.scss"),
    read("scss/import/mask-sheet.scss"),
    read("styles/blades.css"),
  ]);

  assert.match(sharedStyles, /\.sheet-attribute-presentation\s*\{[\s\S]*?\.stripe\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;[\s\S]*?min-height:\s*var\(--bw-attribute-header-height\);[\s\S]*?font-family:\s*var\(--bw-attribute-header-font-family\);[\s\S]*?font-size:\s*var\(--bw-attribute-header-font-size\);[\s\S]*?line-height:\s*var\(--bw-attribute-header-line-height\);/);
  assert.match(sharedStyles, /\.attribute-label\s*\{[\s\S]*?justify-content:\s*center;[\s\S]*?width:\s*100%;[\s\S]*?text-align:\s*center;/);
  assert.match(sharedStyles, /\.attributes-container\s*\{[\s\S]*?font-family:\s*var\(--bw-attribute-row-font-family\);[\s\S]*?font-size:\s*var\(--bw-attribute-row-font-size\);[\s\S]*?button\.dot-value\s*\{[\s\S]*?width:\s*var\(--bw-attribute-dot-track\);[\s\S]*?height:\s*var\(--bw-attribute-row-height\);/);
  assert.doesNotMatch(characterStyles, /character-attributes[\s\S]*?attribute-(?:label|skill-label)[\s\S]*?font-(?:family|size)/);
  assert.doesNotMatch(maskStyles, /mask-attributes[\s\S]*?attribute-(?:label|skill-label)[\s\S]*?font-(?:family|size)/);
  assert.doesNotMatch(maskStyles, /font:\s*inherit/);
  assert.match(compiledStyles, /\.brinkwood \.sheet-attribute-presentation \.stripe\s*\{[\s\S]*?min-height:\s*var\(--bw-attribute-header-height\);[\s\S]*?align-items:\s*center;/);
});
