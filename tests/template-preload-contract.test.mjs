import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const partialReference = /\{\{>\s+"(systems\/brinkwood-reforged\/templates\/parts\/(?:sheet-identity-[^"]+|mask\/alchemic-blood\.html))"/g;
const sharedSheetPartialReference = /\{\{>\s+"(systems\/brinkwood-reforged\/templates\/(?:parts\/linked-journal-cta\.html|rebelion-sheet\/moot-section\.html))"/g;

test("Character and Mask root partials are preloaded before their sheet roots compile", async () => {
  const [templates, character, mask] = await Promise.all([
    read("module/blades-templates.js"),
    read("templates/actor-sheet.html"),
    read("templates/mask-sheet.html"),
  ]);
  const referenced = new Set(
    [...`${character}\n${mask}`.matchAll(partialReference)].map(([, path]) => path),
  );

  assert.deepEqual([...referenced].sort(), [
    "systems/brinkwood-reforged/templates/parts/mask/alchemic-blood.html",
    "systems/brinkwood-reforged/templates/parts/sheet-identity-field.html",
    "systems/brinkwood-reforged/templates/parts/sheet-identity-name.html",
    "systems/brinkwood-reforged/templates/parts/sheet-identity-portrait.html",
    "systems/brinkwood-reforged/templates/parts/sheet-identity-row.html",
    "systems/brinkwood-reforged/templates/parts/sheet-identity-tracker.html",
  ]);
  for (const path of referenced) assert.match(templates, new RegExp(`"${path}"`));
});

test("NPC and Rebellion shared partials are preloaded before their sheet roots compile", async () => {
  const [templates, npc, rebellion, aspect] = await Promise.all([
    read("module/blades-templates.js"),
    read("templates/npc-sheet.html"),
    read("templates/rebelion-sheet.html"),
    read("templates/rebelion-sheet/aspect-section.html"),
  ]);
  const referenced = new Set(
    [...`${npc}\n${rebellion}\n${aspect}`.matchAll(sharedSheetPartialReference)].map(([, path]) => path),
  );

  assert.deepEqual([...referenced].sort(), [
    "systems/brinkwood-reforged/templates/parts/linked-journal-cta.html",
    "systems/brinkwood-reforged/templates/rebelion-sheet/moot-section.html",
  ]);
  for (const path of referenced) assert.match(templates, new RegExp(`"${path}"`));
});
