import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

function renderEffectCardOpeningTag(partial, rootContext, section, effect) {
  const openingTag = partial.match(/<article class="[^"]+" data-effect-id="\{\{effect\.id\}\}">/)?.[0];
  assert.ok(openingTag, "active-effect partial has an effect-card opening tag");
  const contexts = [rootContext, section, effect];
  return openingTag.replace(/\{\{#if ([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, path, content) => {
    const parents = path.split("../").length - 1;
    const key = path.replace(/^(\.\.\/)+/, "");
    return contexts.at(-1 - parents)?.[key] ? content : "";
  });
}

test("modern item sheets retain their v13 root contract", async () => {
  const [controller, template] = await Promise.all([
    read("module/blades-item-sheet.js"),
    read("templates/items/item.html"),
  ]);

  assert.match(template, /class="\{\{cssClass\}\} loadout-item-sheet"/);
  assert.match(controller, /position:\s*\{ width:\s*720, height:\s*700 \}[\s\S]*?resizable:\s*false/);
});

test("legacy item sheets share the production body contract", async () => {
  const [simple, trait, itemClass, moot] = await Promise.all([
    read("templates/items/simple.html"),
    read("templates/items/trait.html"),
    read("templates/items/class.html"),
    read("templates/items/moot_decision.html"),
  ]);

  for (const template of [simple, trait, itemClass, moot]) {
    assert.match(template, /class="\{\{cssClass\}\} legacy-item-sheet"/);
  }
  assert.match(simple, /class="sheet-body legacy-item-sheet__body"/);
  assert.match(simple, /class="legacy-item-sheet__primary"/);
  assert.match(simple, /class="legacy-item-sheet__secondary"/);
  assert.match(simple, /class="legacy-item-sheet__effects"/);
});

test("item sheets opt into compact active-effect cards without changing shared sheets", async () => {
  const [partial, item, simple, trait, klass, styles, characterStyles] = await Promise.all([
    read("templates/parts/active-effects.html"),
    read("templates/items/item.html"),
    read("templates/items/simple.html"),
    read("templates/items/trait.html"),
    read("templates/items/class.html"),
    read("scss/import/general-styles.scss"),
    read("scss/import/character-sheet.scss"),
  ]);

  const compactCard = renderEffectCardOpeningTag(partial, { compact: true }, {}, { disabled: false });
  const defaultCard = renderEffectCardOpeningTag(partial, {}, {}, { disabled: false });
  assert.match(compactCard, /class="effect-card effect-card--compact"/);
  assert.doesNotMatch(defaultCard, /effect-card--compact/);
  for (const template of [item, simple, trait, klass]) {
    assert.match(template, /active-effects\.html" compact=true/);
    assert.doesNotMatch(template, /actor-active-effects\.html/);
  }
  assert.match(partial, /\{\{#if section\.canCreate\}\}\s*\{\{#unless \(eq section\.type "inactive"\)\}\}[\s\S]*?data-effect-action="create"[\s\S]*?\{\{\/unless\}\}/);
  assert.match(styles, /\.effect-card--compact\s*\{[\s\S]*?\.effect-card__image\s*\{[\s\S]*?width:\s*28px/);
  assert.match(styles, /\.effect-card--compact\s*\{[\s\S]*?button\.effect-control\s*\{[\s\S]*?block-size:\s*28px !important/);
  assert.match(styles, /\.effect-card--compact\s*\{[\s\S]*?inline-size:\s*fit-content[\s\S]*?justify-self:\s*end/);
  assert.match(styles, /\.effect-card--compact[\s\S]*?button\.effect-control\s*\{[\s\S]*?inline-size:\s*28px !important[\s\S]*?flex:\s*0 0 28px !important/);
  assert.match(styles, /@container \(max-width: 600px\)\s*\{[\s\S]*?\.effect-card--compact[\s\S]*?flex-wrap:\s*wrap/);
  assert.match(characterStyles, /\.loadout__controls\s*\{[\s\S]*?align-items:\s*center[\s\S]*?justify-content:\s*center[\s\S]*?gap:\s*7px/);
  assert.match(characterStyles, /\.loadout__weight\s*\{[\s\S]*?align-items:\s*center[\s\S]*?block-size:\s*20px[\s\S]*?font-size:\s*calc\(1em \+ 2px\)[\s\S]*?transform:\s*translateY\(2px\)/);
  assert.match(characterStyles, /\.loadout__level\s*\{[\s\S]*?select\s*\{[\s\S]*?inline-size:\s*82px; min-width:\s*82px; max-width:\s*82px[\s\S]*?height:\s*20px/);
  assert.doesNotMatch(characterStyles, /&:focus\s*\{\s*outline:\s*none !important/);
  assert.match(characterStyles, /&:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--bw-ink-soft\) !important/);
});

test("loadout items use v13 form editing and accessible active-effect controls", async () => {
  const [controller, template, source] = await Promise.all([
    read("module/blades-item-sheet.js"),
    read("templates/items/item.html"),
    read("scss/import/item-sheet.scss"),
  ]);

  assert.match(controller, /form:\s*\{ closeOnSubmit: false, submitOnChange: false \}/);
  assert.doesNotMatch(controller, /activateListeners\s*\(/);
  assert.doesNotMatch(controller, /_onChangeInput\s*\(/);
  assert.match(template, /<textarea id="item-description" name="system\.description" aria-labelledby="item-\{\{_id\}\}-description-heading">\{\{system\.description\}\}<\/textarea>/);
  assert.doesNotMatch(template, /<prose-mirror name="system\.description"/);
  assert.match(template, /aria-labelledby="item-\{\{_id\}\}-effects-heading"/);
  assert.match(template, /\{\{> "systems\/brinkwood-reforged\/templates\/parts\/active-effects\.html" compact=true\}\}/);
  assert.match(template, /name="system\.load"[\s\S]*?\{\{#unless canEditLoad\}\} disabled aria-disabled="true"/);
  assert.match(source, /\.loadout-item-sheet__section\s*\{[\s\S]*?h2\s*\{[\s\S]*?background: var\(--bw-ink\)/);
  assert.match(source, /\.loadout-item-sheet__section\s*\{[\s\S]*?display: block/);
  assert.match(source, /\.loadout-item-sheet__effects\s*\{[\s\S]*?\.effects-category\s*\{[\s\S]*?display: block/);
  assert.match(source, /\.effects-category \+ \.effects-category\s*\{[\s\S]*?margin-top: 8px/);
});
