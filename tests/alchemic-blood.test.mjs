import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ALCHEMIC_BLOOD_EFFECT_IDS,
  alchemicBloodEffectUpdate,
  findAlchemicBloodTrait,
  isRuinMask,
  prepareAlchemicBloodContext,
  selectedAlchemicBloodEffectIds,
} from "../module/mask/alchemic-blood.js";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");
const mask = {
  id: "mask-ruin",
  type: "mask",
  _stats: { compendiumSource: "Compendium.brinkwood-reforged.mask.ST9JeQURSTd6qZM4" },
};
const trait = {
  id: "trait-alchemic",
  type: "trait",
  system: { alchemicBlood: { effects: { soporific: true, caustic: true } } },
  flags: { "brinkwood-reforged": { traitGrant: {
    sourceItemId: mask.id,
    sourceItemType: "mask",
    traitSourceId: "N2EkeiPK88YhzIEP",
  } } },
};

test("Alchemic Blood uses the exact six keyed, cumulative effects", () => {
  assert.deepEqual(ALCHEMIC_BLOOD_EFFECT_IDS, [
    "soporific", "ashen", "caustic", "flechette", "naptha", "narcotic",
  ]);
  assert.deepEqual(selectedAlchemicBloodEffectIds(trait), ["soporific", "caustic"]);
  assert.equal(prepareAlchemicBloodContext(trait, { editable: true }).count, 2);
  assert.equal(prepareAlchemicBloodContext(trait, { editable: true }).effects[1].actionLabelKey,
    "Mask.AlchemicBlood.RecordAdvancement");
  assert.equal(prepareAlchemicBloodContext(trait, { editable: false }).effects[0].canSelect, false);
  assert.equal(prepareAlchemicBloodContext(trait, { editable: true }).effects[0].canSelect, true);
  assert.equal(prepareAlchemicBloodContext(trait, { editable: true }).effects[0].actionSelected, false);
  assert.equal(prepareAlchemicBloodContext(trait, { editable: true }).effects[0].actionLabelKey,
    "Mask.AlchemicBlood.Remove");
});

test("Alchemic Blood ownership is resolved by source IDs, not display names", () => {
  assert.equal(isRuinMask(mask), true);
  assert.equal(isRuinMask({ name: "Ruin", type: "mask" }), false);
  assert.equal(findAlchemicBloodTrait([trait], mask), trait);
  assert.equal(findAlchemicBloodTrait([{ ...trait, name: "Alchemic Blood", flags: {} }], mask), null);
});

test("effect writes target independent boolean leaves and reject unknown effects", () => {
  assert.deepEqual(alchemicBloodEffectUpdate(trait, "ashen", true), {
    _id: trait.id,
    "system.alchemicBlood.effects.ashen": true,
  });
  assert.deepEqual(alchemicBloodEffectUpdate(trait, "caustic", false), {
    _id: trait.id,
    "system.alchemicBlood.effects.caustic": false,
  });
  assert.throws(() => alchemicBloodEffectUpdate(trait, "other", true), TypeError);
});

test("Mask navigation stays stable and the focused partial is accessible", async () => {
  const [sheet, partial, controller] = await Promise.all([
    read("templates/mask-sheet.html"),
    read("templates/parts/mask/alchemic-blood.html"),
    read("module/blades-mask-sheet.js"),
  ]);
  assert.match(sheet, /data-tab="mask"[\s\S]*?\{\{localize "Mask\.Tab"\}\}/);
  assert.doesNotMatch(sheet, /data-tab="mask-notes"/);
  assert.doesNotMatch(sheet, /parts\/sheet-notes\.html|mask-sheet__notes/);
  assert.match(sheet, /\{\{\{maskDescriptionHtml\}\}\}/);
  assert.match(controller, /this\.tabGroups\.primary === "mask-notes"[\s\S]*?context\.tabs\.primary = "mask"/);
  assert.match(partial, /aria-labelledby="mask-\{\{_id\}\}-alchemic-blood-heading"/);
  assert.match(partial, /role="list"[\s\S]*?role="listitem"/);
  assert.match(partial, /type="checkbox"[^>]*class="mask-alchemic-blood__select trait-card__purchase bw-checkbox-x"[^>]*data-alchemic-blood-effect/);
  assert.match(partial, /data-alchemic-blood-selected="\{\{#if effect\.actionSelected\}\}true\{\{else\}\}false\{\{\/if\}\}"/);
  assert.doesNotMatch(partial, /mask-alchemic-blood__correct|trait-card__remove/);
  assert.match(controller, /const alchemicBloodTrait = context\.isRuinMask[\s\S]*?\? findAlchemicBloodTrait/);
  assert.match(controller, /context\.alchemicBlood = context\.isRuinMask \? prepareAlchemicBloodContext/);
});

test("a non-Ruin Mask never turns a linked special trait into an Alchemy manager", () => {
  const violence = {
    id: "mask-violence",
    type: "mask",
    _stats: { compendiumSource: "Compendium.brinkwood-reforged.mask.other" },
  };
  const linked = structuredClone(trait);
  linked.flags["brinkwood-reforged"].traitGrant.sourceItemId = violence.id;
  assert.equal(isRuinMask(violence), false);
  assert.equal(findAlchemicBloodTrait([linked], violence), linked,
    "the source lookup alone is intentionally insufficient to enable the manager");
});

test("Alchemic Blood partial is preloaded before Mask rendering", async () => {
  const preloads = await read("module/blades-templates.js");
  assert.match(preloads, /systems\/brinkwood-reforged\/templates\/parts\/mask\/alchemic-blood\.html/);
});

test("Mask Alchemy layout keeps one panel scroll owner and stacks responsively", async () => {
  const partial = await read("templates/parts/mask/alchemic-blood.html");
  const styles = await read("scss/import/mask-sheet.scss");
  assert.match(partial, /class="mask-alchemic-blood bw-section-frame"/);
  assert.match(partial, /class="mask-alchemic-blood__header bw-section-frame__header"/);
  assert.match(partial, /class="mask-alchemic-blood__body"/);
  assert.match(partial, /class="mask-alchemic-blood__effect trait-card bw-ruled-card/);
  assert.match(partial, /class="mask-alchemic-blood__effect-header trait-card__header bw-ruled-card__title-band"/);
  assert.match(partial, /class="mask-alchemic-blood__effect-title trait-card__title bw-ruled-card__title"/);
  assert.match(partial, /class="mask-alchemic-blood__effect-copy trait-card__description bw-ruled-card__body"/);
  assert.match(styles, /\.mask-alchemic-blood\s*\{[\s\S]*?display:\s*block;[\s\S]*?width:\s*100%;/);
  assert.match(styles, /\.mask-alchemic-blood__header\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto;[\s\S]*?padding:\s*10px 8px;[\s\S]*?font-family:\s*"Crimson Text", serif;[\s\S]*?font-size:\s*1\.05rem;[\s\S]*?font-weight:\s*700;[\s\S]*?line-height:\s*1\.2;[\s\S]*?letter-spacing:\s*0\.02em;[\s\S]*?text-align:\s*left;[\s\S]*?text-transform:\s*none;/);
  assert.match(styles, /\.mask-sheet__mask-overview[\s\S]*?\.bw-section-frame__header\s*\{[\s\S]*?padding:\s*10px 8px;[\s\S]*?text-align:\s*left;[\s\S]*?font-family:\s*"Crimson Text", serif;[\s\S]*?font-size:\s*1\.05rem;[\s\S]*?font-weight:\s*700;[\s\S]*?line-height:\s*1\.2;[\s\S]*?letter-spacing:\s*0\.02em;[\s\S]*?text-transform:\s*none;/);
  assert.match(styles, /\.mask-sheet__mask-description\s*\{[\s\S]*?padding-block-start:\s*12px;[\s\S]*?> :first-child\s*\{[\s\S]*?margin-block-start:\s*0;/);
  assert.match(styles, /mask-alchemic-blood__effects[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.doesNotMatch(styles, /mask-alchemic-blood__effect--selected/);
  const alchemyBlock = styles.match(/\.mask-alchemic-blood\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? "";
  assert.doesNotMatch(alchemyBlock, /overflow(?:-y)?:\s*(?:auto|scroll)/);
});

test("localization preserves rulebook spelling and automation boundary", async () => {
  const lang = JSON.parse(await read("lang/en.json"));
  const alchemy = lang.Mask.AlchemicBlood;
  assert.equal(alchemy.Effects.naptha.Name, "Naptha");
  assert.match(alchemy.AdvancementGuidance, /already approved by your group/);
  assert.match(alchemy.AdvancementGuidance, /does not spend XP or apply the effect/);
  assert.deepEqual(Object.keys(alchemy.Effects), ALCHEMIC_BLOOD_EFFECT_IDS);
  assert.equal(lang.Mask.Essence.AdditionalSlot,
    "Additional Essence slot. Use when granted by a Mask ability.");
});
