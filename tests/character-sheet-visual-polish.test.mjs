import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("character load-level control is a styled native menu with accessible overload feedback", async () => {
  const [template, styles, polishStyles, generalStyles] = await Promise.all([
    read("templates/actor-sheet.html"),
    read("scss/import/character-sheet.scss"),
    read("scss/import/legacy-character-sheet-polish.scss"),
    read("scss/import/general-styles.scss"),
  ]);

  assert.match(template, /<select id="character-\{\{_id\}\}-load-level" name="system\.selected_load_level"/);
  assert.match(template, /<option value="BITD\.Light"[\s\S]*?<option value="BITD\.Normal"[\s\S]*?<option value="BITD\.Heavy"/);
  assert.match(template, /selectedLoadLevel/);
  assert.doesNotMatch(template, /type="radio" name="system\.selected_load_level"/);
  assert.match(template, /class="loadout__heading">\{\{localize "BITD\.Loadout"\}\}<\/h2>/);
  assert.doesNotMatch(template, /class="visually-hidden">\{\{localize "BITD\.Loadout"\}\}<\/span>/);
  assert.doesNotMatch(template, /aria-hidden="true">!<\/span>/);
  assert.match(template, /class="loadout-item-select bw-checkbox-x"[\s\S]*?data-loadout-source-id="\{\{item\.sourceId\}\}"[\s\S]*?data-item-id="\{\{item\.actorItemId\}\}"[\s\S]*?aria-label="\{\{item\.name\}\}"/);
  assert.match(template, /<button type="button" class="loadout-item-open" data-loadout-source-id="\{\{item\.sourceId\}\}" data-item-id="\{\{item\.actorItemId\}\}" aria-label="\{\{item\.name\}\}">/);
  assert.match(template, /<input class="loadout-item-load" type="number" min="0" step="1" value="\{\{item\.system\.load\}\}" data-item-id="\{\{item\.actorItemId\}\}" data-loadout-source-id="\{\{item\.sourceId\}\}" data-loadout-item-name="\{\{item\.name\}\}" aria-label="\{\{localize "BITD\.Load"\}\}: \{\{item\.name\}\}"\{\{#unless \.\.\/\.\.\/isGM\}\} disabled\{\{\/unless\}\}>/);
  assert.match(template, /isLoadoutOverloaded[\s\S]*?aria-label="\{\{system\.loadout\}\}\/\{\{loadoutCapacity\}\}[\s\S]*?BITD\.Overloaded/);
  assert.match(styles, /\.loadout__level \{[\s\S]*?select \{[\s\S]*?border: 1px solid var\(--bw-rule\);[\s\S]*?&:focus-visible \{[\s\S]*?outline: 3px solid var\(--bw-focus\)/);
  assert.match(styles, /\.loadout__weight\.is-overloaded \{ color: #d97b76; \}/);
  assert.match(styles, /\.loadout__header \{ display: grid; grid-template-columns: minmax\(0, 1fr\) 120px;[\s\S]*?min-height: 38px;[\s\S]*?padding: 0 8px; \}/);
  assert.match(template, /class="loadout__controls">[\s\S]*?class="loadout__weight[\s\S]*?class="loadout__level"/);
  assert.match(styles, /\.loadout__controls \{ display: flex; align-items: center; justify-content: center; gap: 7px;/);
  assert.match(template, /class="loadout__panel bw-section-frame">[\s\S]*?class="label-stripe loadout__header bw-section-frame__header"[\s\S]*?class="loadout__categories"[\s\S]*?class="loadout__catalogue bw-ruled-card__body"/);
  assert.match(styles, /\.loadout__panel\s*\{[\s\S]*?height:\s*max-content;[\s\S]*?overflow:\s*visible;/);
  assert.match(template, /class="bans-armor bw-section-frame"[\s\S]*?<thead class="bw-section-frame__header">/);
  assert.match(generalStyles, /\.bw-section-frame \{[\s\S]*?border: 1px solid var\(--bw-rule\);[\s\S]*?border-radius: 8px;[\s\S]*?overflow: hidden;/);
  assert.match(styles, /\.loadout__category \{ display: grid; grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(styles, /\.loadout__catalogue \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?padding: 7px 8px 8px;/);
  assert.match(styles, /@container \(min-width: 840px\) \{ \.loadout__catalogue \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \} \}/);
  assert.match(styles, /inline-size: 82px; min-width: 82px; max-width: 82px;[\s\S]*?height: 20px; min-height: 20px;[\s\S]*?text-align: center; text-align-last: center;[\s\S]*?option \{ text-align: center; \}/);
  assert.doesNotMatch(styles, /field-sizing:\s*content/);
  assert.match(styles, /\.loadout-item-select \{ display: block; inline-size: 18px; block-size: 18px;[\s\S]*?opacity: 1;/);
  assert.match(styles, /\.loadout__item \{[\s\S]*?min-height: 38px;[\s\S]*?background: transparent; box-shadow: none;[\s\S]*?&:has\(\.loadout-item-select:checked\) \{ background: rgba\(141, 98, 93, 0\.18\); box-shadow: none; \}/);
  assert.doesNotMatch(styles, /\.loadout__item \{[^\n]*&:(?:hover|focus-within)/);
  assert.match(styles, /\.loadout-item-open \{[\s\S]*?min-height: 38px;[\s\S]*?&:focus:not\(:focus-visible\) \{ outline: 0; box-shadow: none; \}[\s\S]*?&:focus-visible \{ outline: 3px solid var\(--bw-focus\); outline-offset: 2px; \}/);
  assert.match(styles, /\.loadout__item-name \{[\s\S]*?overflow-wrap: anywhere;[\s\S]*?text-overflow: clip; white-space: normal;/);
  assert.doesNotMatch(template, /class="loadout__custom-item"/);
  assert.match(styles, /\.bans-armor \{[\s\S]*?padding: 0;/);
  assert.match(styles, /\.loadout-item-load \{[\s\S]*?inline-size: 32px;[\s\S]*?min-height: 32px;[\s\S]*?border: 1px solid transparent;[\s\S]*?&:hover \{[\s\S]*?border-color: rgba\(141, 98, 93, 0\.58\);[\s\S]*?&:focus-visible \{[\s\S]*?outline: 3px solid var\(--bw-focus\)/);
  assert.doesNotMatch(styles, /loadout__level-option/);
  assert.doesNotMatch(polishStyles, /selected_load_level/);
});

test("character clocks keep every state legible in the Brinkwood palette", async () => {
  const styles = await read("scss/import/character-sheet.scss");

  assert.match(styles, /\.character-scars-clock \.blades-clock,[\s\S]*?\.character-oath-clock \.blades-clock \{[\s\S]*?--character-clock-fill: var\(--bw-accent\);[\s\S]*?border: 2px solid var\(--bw-ink\);/);
  for (let value = 0; value <= 4; value += 1) {
    assert.match(styles, new RegExp(`&\\.clock-4-${value} \\{[\\s\\S]*?linear-gradient\\(to right[\\s\\S]*?linear-gradient\\(to bottom[\\s\\S]*?conic-gradient[\\s\\S]*?!important;`));
  }
  assert.match(styles, /linear-gradient\(to right, transparent calc\(50% - 1px\), var\(--bw-ink\) calc\(50% - 1px\) calc\(50% \+ 1px\), transparent calc\(50% \+ 1px\)\)/);
});
