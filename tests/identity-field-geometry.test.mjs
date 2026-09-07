import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Character Name and Alias share exact field geometry while retaining distinct type", async () => {
  const [character, field, name, styles] = await Promise.all([
    read("templates/actor-sheet.html"),
    read("templates/parts/sheet-identity-field.html"),
    read("templates/parts/sheet-identity-name.html"),
    read("scss/import/sheet-identity.scss"),
  ]);

  assert.match(name, /class="sheet-identity__field-box sheet-identity__name-box/);
  assert.match(character, /sheet-identity-field\.html"[\s\S]*?fieldBoxClass="sheet-identity__alias-box"[\s\S]*?fieldClass="alias bw-text-field"/);
  assert.match(field, /class="sheet-identity__field-box/);
  assert.match(styles, /\.sheet-identity__field-box\s*\{[\s\S]*?grid-template-rows:\s*16px 36px[\s\S]*?> label\s*\{[\s\S]*?height:\s*16px[\s\S]*?align-items:\s*flex-end[\s\S]*?input\[type="text"\]\s*\{[\s\S]*?width:\s*100%[\s\S]*?height:\s*36px[\s\S]*?margin:\s*0/);
  assert.match(styles, /\.sheet-identity__name-box[\s\S]*?\.bw-text-field\s*\{[\s\S]*?font-size:\s*1\.35rem/);
  assert.match(styles, /\.sheet-identity__alias-box \.alias\s*\{[\s\S]*?font-size:\s*1rem/);
});

test("Character identity rows keep selected and empty values clear of separators", async () => {
  const [character, mask, row, characterStyles, sharedStyles, legacyEffects, legacyPolish] = await Promise.all([
    read("templates/actor-sheet.html"),
    read("templates/mask-sheet.html"),
    read("templates/parts/sheet-identity-row.html"),
    read("scss/import/character-sheet.scss"),
    read("scss/import/sheet-identity.scss"),
    read("scss/import/legacy-character-effects.scss"),
    read("scss/import/legacy-character-sheet-polish.scss"),
  ]);

  assert.match(character, /class="sheet-identity__rows sheet-identity__rows--separated"/);
  assert.doesNotMatch(mask, /sheet-identity__rows--separated/);
  assert.match(row, /class="item identity-choice__slot identity-choice__value/);
  assert.match(row, /class="identity-choice__slot identity-choice__blank"/);
  assert.match(row, /class="item-add-popup identity-choice__text"[\s\S]*?<span class="identity-choice__content">\{\{localize row\.label\}\}<\/span>/);
  assert.match(row, /class="identity-choice__text"><span class="identity-choice__content">\{\{localize row\.label\}\}<\/span><\/span>/);
  assert.match(row, /<button type="button" class="item-body identity-choice__text\{\{#if row\.reselect\}\} item-add-popup\{\{\/if\}\}"[\s\S]*?<span class="item-name identity-choice__content">\{\{row\.item\.name\}\}<\/span><\/button>/);
  assert.match(row, /class="item-delete identity-choice__remove"[\s\S]*?<span class="identity-choice__content" aria-hidden="true">&times;<\/span>/);
  assert.doesNotMatch(row, /\{\{#if row\.reselect\}\}<button|\{\{else\}\}<div class="item-body/);
  assert.match(sharedStyles, /\.sheet-identity \.identity-choice__slot\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 18px;[\s\S]*?column-gap:\s*4px;[\s\S]*?height:\s*28px;[\s\S]*?margin:\s*0;[\s\S]*?padding:\s*0/);
  assert.match(sharedStyles, /\.sheet-identity \.identity-choice__text\s*\{[\s\S]*?display:\s*grid;[\s\S]*?box-sizing:\s*border-box;[\s\S]*?height:\s*28px;[\s\S]*?min-height:\s*28px;[\s\S]*?margin:\s*0;[\s\S]*?padding:\s*0;[\s\S]*?border:\s*0;[\s\S]*?font:\s*inherit;[\s\S]*?align-items:\s*center;[\s\S]*?justify-items:\s*start;[\s\S]*?line-height:\s*normal/);
  assert.match(sharedStyles, /\.sheet-identity \.identity-choice__content\s*\{[\s\S]*?display:\s*block;[\s\S]*?line-height:\s*1\.2/);
  assert.match(sharedStyles, /\.sheet-identity \.identity-choice__value \.item-body\s*\{[\s\S]*?display:\s*grid;[\s\S]*?justify-content:\s*end;[\s\S]*?justify-items:\s*end/);
  assert.match(sharedStyles, /\.sheet-identity \.identity-choice__value \.item-name\s*\{[\s\S]*?display:\s*block;[\s\S]*?height:\s*auto;[\s\S]*?line-height:\s*1\.2/);
  assert.match(sharedStyles, /\.sheet-identity \.identity-choice__remove\s*\{[\s\S]*?height:\s*28px;[\s\S]*?min-height:\s*28px;[\s\S]*?line-height:\s*normal/);
  assert.match(sharedStyles, /\.sheet-identity \.sheet-identity__rows\s*\{[\s\S]*?grid-auto-rows:\s*28px/);
  assert.match(sharedStyles, /\.sheet-identity \.sheet-identity__rows--separated \.sheet-identity__row\s*\{[^}]*border-block-end:\s*0;[^}]*box-shadow:\s*inset 0 -1px 0 rgba\(141, 98, 93, 0\.3\)/);
  assert.doesNotMatch(sharedStyles, /\.sheet-identity \.sheet-identity__rows--separated \.sheet-identity__row\s*\{[^}]*(?:height|min-height)\s*:/);
  assert.match(characterStyles, /\.item-block:not\(\.sheet-identity__row\)\s*\{/);
  assert.match(characterStyles, /\.sheet-identity__details > \.sheet-identity__rows,\s*\.sheet-identity__trackers > \.big-teeth-section\s*\{[\s\S]*?transform:\s*translateY\(10px\)/);
  assert.doesNotMatch(characterStyles, /\.sheet-identity__rows--separated\s*\.identity-choice__value > \.identity-choice__text > \.item-name\s*\{/);
  assert.doesNotMatch(characterStyles, /\.sheet-identity__rows--separated\s*\.identity-choice__value > \.identity-choice__remove\s*\{/);
  assert.doesNotMatch(characterStyles, /\.character-identity-choices \.identity-choice__/);
  assert.doesNotMatch(characterStyles, /(?:^|\n)\s*&?\s*\.identity-choice__remove(?:\s|:|\{)/);
  assert.doesNotMatch(characterStyles, /& \.character-identity-choices(?:\s|\{)/);
  assert.doesNotMatch(sharedStyles, /\.item-body\.item-add-popup\s*\{[^}]*justify-content\s*:/);
  assert.doesNotMatch(characterStyles, /\.sheet-identity__details > \.sheet-identity__rows,\s*\.sheet-identity__trackers > \.big-teeth-section\s*\{[^}]*(?:margin|padding|top|inset)[^}]*:/);
  assert.doesNotMatch(legacyEffects, /\.name-alias \.item-block \.item\s*\{/);
  assert.doesNotMatch(legacyPolish, /\.character-identity-choices \.item-name\s*\{[^}]*line-height\s*:/);
  assert.doesNotMatch(legacyPolish, /\.character-identity-choices/);
});
