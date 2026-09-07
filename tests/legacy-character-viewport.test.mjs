import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("trait-card partial owns the purchase control and conditional safety action", async () => {
  const [actorTemplate, traitCard, controller] = await Promise.all([
    read("templates/actor-sheet.html"),
    read("templates/parts/actor/trait-card.html"),
    read("module/blades-actor-sheet.js"),
  ]);

  assert.match(actorTemplate, /parts\/actor\/trait-card\.html/);
  assert.match(traitCard, /class="trait-card__purchase bw-checkbox-x"/);
  assert.match(traitCard, /<article class="item trait-card bw-ruled-card bw-ruled-card--trait-palette" data-item-id="\{\{itemId\}\}">/);
  assert.match(traitCard, /\{\{#if canDelete\}\}[\s\S]*?class="item-delete trait-card__remove"/);
  assert.match(controller, /const canDelete = context\.isGM && !trait\.flags\?\.\["brinkwood-reforged"\]\?\.traitGrant/);
  assert.match(controller, /const element = ev\.currentTarget\.closest\("\.item"\);[\s\S]*?this\.actor\.items\.get\(element\.dataset\.itemId\)/);
  assert.match(controller, /item\.type === "trait" && \(!game\.user\.isGM \|\| item\.flags\?\.\["brinkwood-reforged"\]\?\.traitGrant\)/);
});
