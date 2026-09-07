import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Character Attribute families use lightweight trait-palette cards", async () => {
  const [template, styles] = await Promise.all([
    read("templates/parts/attributes.html"),
    read("scss/import/character-sheet.scss"),
  ]);

  assert.match(template, /class="attribute character-attribute-card bw-ruled-card bw-ruled-card--trait-palette"/);
  assert.match(template, /class="attributes-exp bw-ruled-card__title-band"/);
  assert.match(template, /class="character-attribute-card__body bw-ruled-card__body"/);
  assert.match(styles, /\.character-attribute-card\s*\{[\s\S]*?--bw-attribute-dot-track:\s*24px;/);
  assert.match(styles, /\.character-attribute-card\s*\{[\s\S]*?border-left:\s*1px solid var\(--bw-ruled-card-rule\)/);
  assert.match(styles, /\.character-attribute-card \.stripe\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?color:\s*var\(--bw-ink\)/);
  assert.match(styles, /\.character-attribute-card__body > \.flex-horizontal \+ \.flex-horizontal\s*\{[\s\S]*?border-top:/);
});
