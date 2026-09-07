import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  LOADOUT_CATEGORY_DEFINITIONS,
  groupLoadoutItems,
  loadoutCategoryForItem,
  prepareLoadoutCategoryOptions,
} from "../module/character/loadout-categories.js";

const EXPECTED_CATEGORY_BY_NAME = {
  Blackjack: "Weapons",
  "Blade or Two": "Blades",
  Longsword: "Blades",
  Spear: "Blades",
  Pistol: "Firearms",
  "Second Pistol": "Firearms",
  Rifle: "Firearms",
  Crossbow: "Bows",
  "Hunting Bow": "Bows",
  Shortbow: "Bows",
  Longbow: "Bows",
  Buckler: "Shields and Armor",
  "Round Shield": "Shields and Armor",
  "Knightly Shield": "Shields and Armor",
  "Leather Armor": "Shields and Armor",
  Chainmail: "Shields and Armor",
  "Plated Jacket": "Shields and Armor",
  Lantern: "Tools",
  Censer: "Tools",
  "Manna Wood": "Tools",
  "Burglary Kit": "Tools",
  "Tinkering Tools": "Tools",
  "Demolition Tools": "Tools",
  "Subterfuge Supplies": "Tools",
  "Climbing Gear": "Tools",
  Ashwood: "Contraband",
  "Black Powder": "Contraband",
};

test("standard loadout follows the manual's equipment taxonomy", async () => {
  const source = await readFile(new URL("../packs/items.db", import.meta.url), "utf8");
  const items = source.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);

  assert.equal(items.length, 27);
  assert.deepEqual(
    Object.fromEntries(items.map(item => [item.name, loadoutCategoryForItem(item)])),
    EXPECTED_CATEGORY_BY_NAME,
  );
  assert.ok(items.every(item => loadoutCategoryForItem(item) !== "Other"));
});

test("loadout groups keep manual order and sort rows without reacting to selection", () => {
  const items = [
    { name: "Spear", system: { class: "", equipped: true } },
    { name: "Blackjack", system: { class: "", equipped: false } },
    { name: "Blade or Two", system: { class: "", equipped: false } },
    { name: "Family Keepsake", system: { class: "", equipped: true } },
  ];

  const groups = groupLoadoutItems(items);
  assert.deepEqual(groups.map(group => group.value), ["Weapons", "Blades", "Other"]);
  assert.deepEqual(groups[1].items.map(item => item.name), ["Blade or Two", "Spear"]);

  items[0].system.equipped = false;
  assert.deepEqual(groupLoadoutItems(items)[1].items.map(item => item.name), ["Blade or Two", "Spear"]);
});

test("stored manual category wins and item sheet options select it", () => {
  assert.equal(loadoutCategoryForItem({ name: "Spear", system: { class: "Tools" } }), "Tools");
  assert.equal(loadoutCategoryForItem({ name: "Unknown", system: { class: "tools" } }), "Tools");
  assert.equal(loadoutCategoryForItem({ name: "Unknown", system: { class: "custom" } }), "Other");

  const options = prepareLoadoutCategoryOptions("Contraband");
  assert.equal(options.length, LOADOUT_CATEGORY_DEFINITIONS.length);
  assert.deepEqual(options.filter(option => option.selected).map(option => option.value), ["Contraband"]);
});

test("character and item templates expose categorized loadout controls", async () => {
  const root = new URL("../", import.meta.url);
  const actorTemplate = await readFile(new URL("templates/actor-sheet.html", root), "utf8");
  const itemTemplate = await readFile(new URL("templates/items/item.html", root), "utf8");

  assert.match(actorTemplate, /#each loadoutGroups as \|group\|/);
  assert.match(actorTemplate, /bw-ruled-card--trait-palette/);
  assert.match(actorTemplate, /#each group\.items as \|item\|/);
  assert.match(itemTemplate, /select id="item-class" name="system\.class"/);
  assert.doesNotMatch(itemTemplate, /input id="item-class" type="text"/);
});
