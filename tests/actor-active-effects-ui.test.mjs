import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Character and Mask alone use the shared Actor Effect component", async () => {
  const [partial, character, mask, preloader, source, sharedStyles, viewState] = await Promise.all([
    read("templates/parts/actor-active-effects.html"),
    read("templates/actor-sheet.html"),
    read("templates/mask-sheet.html"),
    read("module/blades-templates.js"),
    read("scss/import/actor-effect-card.scss"),
    read("scss/import/general-styles.scss"),
    read("module/sheet-view-state.js"),
  ]);

  assert.match(character, /parts\/actor-active-effects\.html/);
  assert.match(mask, /parts\/actor-active-effects\.html/);
  assert.doesNotMatch(character, /parts\/active-effects\.html/);
  assert.doesNotMatch(mask, /parts\/active-effects\.html/);
  assert.match(preloader, /parts\/actor-active-effects\.html/);
  assert.match(sharedStyles, /@import 'actor-effect-card\.scss';/);

  assert.match(partial, /<div class="actor-effects">/);
  assert.match(viewState, /const CHARACTER_EFFECTS_VIEWPORT_SELECTOR = "\.actor-effects";/);
  assert.match(partial, /class="effects-tabs actor-effects__tabs" role="tablist"/);
  assert.match(partial, /class="effects-tab actor-effects__tab[^"]*"[\s\S]*?role="tab"[\s\S]*?data-effect-tab="\{\{section\.type\}\}"/);
  assert.match(partial, /data-effect-panel="\{\{section\.type\}\}" role="tabpanel"/);
  assert.match(partial, /class="actor-effects__category" data-effect-type="\{\{section\.type\}\}"/);
  assert.match(partial, /\{\{#if section\.canCreate\}\}\s*\{\{#unless \(eq section\.type "inactive"\)\}\}[\s\S]*?class="effect-control actor-effects__add"[\s\S]*?data-effect-action="create"[\s\S]*?\{\{\/unless\}\}/);
  assert.match(partial, /class="actor-effects__add-label"/);
  assert.match(partial, /class="actor-effect-card bw-ruled-card/);
  assert.match(partial, /class="actor-effect-card__header bw-ruled-card__title-band"/);
  assert.match(partial, /<h4 class="actor-effect-card__title bw-ruled-card__title">\{\{effect\.name\}\}<\/h4>/);
  assert.match(partial, /class="actor-effect-card__summary"[\s\S]*?actor-effect-card__image[\s\S]*?actor-effect-card__metadata/);
  assert.match(partial, /class="actor-effect-card__details"[\s\S]*?actor-effect-card__statuses[\s\S]*?actor-effect-card__description/);
  assert.doesNotMatch(partial, /type="checkbox"/);

  assert.match(source, /button\.actor-effects__add\s*\{[\s\S]*?border:\s*1px dashed var\(--bw-rule\)[\s\S]*?border-left:\s*5px solid var\(--bw-accent\)/);
  assert.match(source, /\.actor-effects__add-label\s*\{[\s\S]*?line-height:\s*20px;[\s\S]*?transform:\s*translateY\(2px\)/);
  assert.match(source, /\.actor-effects__tabs\s*\{[\s\S]*?display:\s*flex[\s\S]*?flex-wrap:\s*wrap[\s\S]*?width:\s*100%/);
  assert.match(source, /button\.actor-effects__tab\s*\{[\s\S]*?flex:\s*1 1 8rem[\s\S]*?&\.active\s*\{[\s\S]*?background:/);
  assert.match(source, /@container \(max-width: 410px\)[\s\S]*?button\.actor-effects__tab\s*\{[\s\S]*?flex-basis:\s*100%/);
  assert.match(source, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?button\.actor-effects__tab\s*\{[\s\S]*?transition-duration:\s*0\.01ms/);
  assert.match(source, /\.actor-effects__category\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)[\s\S]*?justify-content:\s*stretch/);
  assert.match(source, /\.actor-effects__list\s*\{[\s\S]*?gap:\s*8px/);
  assert.match(source, /\.actor-effect-card__header\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto/);
  assert.match(source, /\.actor-effect-card__summary\s*\{[\s\S]*?border-bottom:\s*1px solid var\(--bw-rule\)/);
});

test("Item sheets retain their existing compact Effect component", async () => {
  const templates = await Promise.all([
    read("templates/items/item.html"),
    read("templates/items/simple.html"),
    read("templates/items/trait.html"),
    read("templates/items/class.html"),
  ]);

  for (const template of templates) {
    assert.match(template, /parts\/active-effects\.html" compact=true/);
    assert.doesNotMatch(template, /actor-active-effects\.html/);
  }
});
