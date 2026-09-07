import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Character and Mask traits share one static, wrapping Trait Card component", async () => {
  const [template, partial, styles, sharedStyles, componentStyles] = await Promise.all([
    read("templates/actor-sheet.html"),
    read("templates/parts/actor/trait-card.html"),
    read("scss/import/character-sheet.scss"),
    read("scss/import/general-styles.scss"),
    read("scss/import/trait-card.scss"),
  ]);

  const traitsPanel = template.slice(
    template.indexOf('id="character-{{_id}}-traits-tab"'),
    template.indexOf('id="character-{{_id}}-loadout"'),
  );

  assert.match(traitsPanel, /parts\/actor\/trait-card\.html/);
  assert.match(partial, /class="item trait-card bw-ruled-card bw-ruled-card--trait-palette"/);
  assert.match(partial, /class="trait-card__header bw-ruled-card__title-band"/);
  assert.match(partial, /class="trait-card__title bw-ruled-card__title"/);
  assert.match(partial, /class="trait-card__description bw-ruled-card__body"/);
  assert.match(partial, /\{\{#if canDelete\}\}[\s\S]*?trait-card__remove/);
  assert.doesNotMatch(partial, /effect-card|effect-control|disclosure|details-toggle/);

  assert.match(styles, /form\.actor-sheet \.tab\[data-tab="traits"\]/);
  assert.match(sharedStyles, /@import 'trait-card\.scss';/);
  assert.doesNotMatch(styles, /\.trait-card(?:__|\s*\{)/);
  assert.match(componentStyles, /\.trait-card \{[\s\S]*?min-width:\s*0[\s\S]*?min-height:\s*0[\s\S]*?height:\s*auto[\s\S]*?align-self:\s*start[\s\S]*?align-content:\s*start[\s\S]*?overflow:\s*visible/);
  assert.match(componentStyles, /\.trait-card__header \{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto/);
  assert.doesNotMatch(componentStyles, /background:\s*#e0d7c5/);
  assert.match(componentStyles, /\.trait-card__purchase \{[\s\S]*?appearance:\s*none\s*!important[\s\S]*?-webkit-appearance:\s*none\s*!important[\s\S]*?background:\s*#fff/);
  assert.match(componentStyles, /&:checked \{[\s\S]*?background-color:\s*#fff[\s\S]*?background-image:[\s\S]*?linear-gradient\(45deg[\s\S]*?linear-gradient\(-45deg/);
  assert.match(componentStyles, /\.trait-card__description \{[\s\S]*?max-height:\s*none[\s\S]*?align-self:\s*start[\s\S]*?overflow:\s*visible[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(sharedStyles, /\.bw-ruled-card \{[\s\S]*?--bw-ruled-card-title-band:\s*var\(--bw-paper-deep\)[\s\S]*?border:\s*1px solid var\(--bw-ruled-card-rule\)[\s\S]*?border-left:\s*5px solid var\(--bw-ruled-card-accent\)[\s\S]*?background:\s*var\(--bw-ruled-card-surface\)/);
  assert.match(sharedStyles, /\.bw-ruled-card--trait-palette \{[\s\S]*?--bw-ruled-card-title-band:\s*#e0d7c5/);
  assert.match(sharedStyles, /\.bw-ruled-card__title-band \{[\s\S]*?padding:\s*9px 12px[\s\S]*?background:\s*var\(--bw-ruled-card-title-band\)/);
  assert.match(sharedStyles, /\.bw-ruled-card__title \{[\s\S]*?margin:\s*0[\s\S]*?font-family:\s*"Crimson Text", serif[\s\S]*?font-size:\s*1\.2rem[\s\S]*?text-transform:\s*none/);
  assert.match(sharedStyles, /\.bw-ruled-card__body \{[\s\S]*?padding:\s*11px 12px 13px/);
  assert.match(sharedStyles, /\.bw-ruled-card__body > :first-child\s*\{[\s\S]*?margin-top:\s*0/);
  assert.match(sharedStyles, /\.bw-ruled-card__body > :last-child\s*\{[\s\S]*?margin-bottom:\s*0/);
});
