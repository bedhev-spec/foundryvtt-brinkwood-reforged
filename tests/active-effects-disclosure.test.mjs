import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("active effect cards render prepared details permanently", async () => {
  const [template, controller, sheetController, styles, lateStyles, actorSheet, maskSheet, itemSheet, locale] = await Promise.all([
    read("templates/parts/active-effects.html"), read("module/blades-active-effect.js"), read("module/blades-sheet.js"),
    read("scss/import/general-styles.scss"), read("scss/import/legacy-character-effects.scss"),
    read("module/blades-actor-sheet.js"), read("module/blades-mask-sheet.js"), read("module/blades-item-sheet.js"), read("lang/en.json")
  ]);

  assert.match(template, /<article class="effect-card[\s\S]*?data-effect-id="\{\{effect\.id\}\}"/);
  assert.match(template, /<div class="effect-card__header">[\s\S]*?<div class="effect-card__summary">[\s\S]*?<div class="effect-card__actions"/);
  assert.match(template, /<div class="effect-card__details">/);
  assert.match(template, /class="effect-card__detail-group effect-card__status-group"/);
  assert.match(template, /data-effect-action="toggle"[\s\S]*?data-effect-action="edit"[\s\S]*?data-effect-action="delete"/);
  const readOnlyMarkup = template.replace(
    /\{\{#if \.\.\/\.\.\/editable\}\}\s*<div class="effect-card__actions"[\s\S]*?<\/div>\s*\{\{\/if\}\}/,
    ""
  );
  assert.doesNotMatch(readOnlyMarkup, /class="effect-card__actions"/);
  assert.match(readOnlyMarkup, /<\/div>\s*<div class="effect-card__details">/);
  assert.doesNotMatch(template, /<details\b|<summary\b|details-toggle|aria-expanded/);
  assert.doesNotMatch(sheetController, /EffectDisclosure|details-toggle|aria-expanded/);

  assert.match(controller, /static async prepareActiveEffectCategories\(effects, \{ owner \} = \{\}\)/);
  assert.match(controller, /TextEditor\?\.implementation\?\.enrichHTML/);
  assert.match(actorSheet, /await BladesActiveEffect\.prepareActiveEffectCategories\(this\.actor\.effects/);
  assert.match(maskSheet, /await BladesActiveEffect\.prepareActiveEffectCategories\(this\.actor\.effects/);
  assert.match(itemSheet, /await BladesActiveEffect\.prepareActiveEffectCategories\(doc\.effects/);

  assert.match(styles, /\.effect-card__summary\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(styles, /\.effect-card__header\s*\{[\s\S]*?border-bottom:\s*1px solid var\(--bw-rule\)/);
  assert.match(styles, /\.effect-card__description\s*\{[\s\S]*?flex:\s*1 1 100%[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(styles, /\.effect-card__statuses li\s*\{[\s\S]*?display:\s*inline-flex[\s\S]*?flex:\s*0 0 auto[\s\S]*?inline-size:\s*fit-content[\s\S]*?block-size:\s*28px[\s\S]*?min-block-size:\s*28px[\s\S]*?max-block-size:\s*28px/);
  assert.match(styles, /\.effect-card--compact[\s\S]*?button\.effect-control\s*\{[\s\S]*?inline-size:\s*28px !important/);
  assert.doesNotMatch(styles, /effect-card__(?:disclosure|details-toggle)|aria-expanded|\.effect-card\[open\]/);
  assert.doesNotMatch(lateStyles, /effect-card__(?:disclosure|details-toggle)|aria-expanded|disclosure/);

  for (const key of ["EffectDetails", "EffectStatuses", "EffectDescription", "EffectNoDetails", "EffectEnable", "EffectDisable"]) {
    assert.match(locale, RegExp(`"BITD\\.${key}"`));
  }
});
