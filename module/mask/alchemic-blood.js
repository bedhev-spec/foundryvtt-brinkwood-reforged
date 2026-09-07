export const ALCHEMIC_BLOOD_TRAIT_SOURCE_ID = "N2EkeiPK88YhzIEP";
export const RUIN_MASK_SOURCE_IDS = Object.freeze(["ST9JeQURSTd6qZM4", "z8fsObK2mkiJsEH2"]);

export const ALCHEMIC_BLOOD_EFFECT_IDS = Object.freeze([
  "soporific",
  "ashen",
  "caustic",
  "flechette",
  "naptha",
  "narcotic",
]);

const effectIdSet = new Set(ALCHEMIC_BLOOD_EFFECT_IDS);

export function isAlchemicBloodEffectId(effectId) {
  return effectIdSet.has(effectId);
}

export function isRuinMask(maskItem) {
  const sources = [
    maskItem?._stats?.compendiumSource,
    maskItem?.flags?.core?.sourceId,
  ].filter(source => typeof source === "string");
  return sources.some(source => RUIN_MASK_SOURCE_IDS.some(id => source.endsWith(id)));
}

export function findAlchemicBloodTrait(items, maskItem) {
  const maskItemId = maskItem?.id ?? maskItem?._id;
  if (!maskItemId) return null;
  return Array.from(items ?? []).find(item => (
    item.type === "trait"
    && item.flags?.["brinkwood-reforged"]?.traitGrant?.sourceItemType === "mask"
    && item.flags?.["brinkwood-reforged"]?.traitGrant?.sourceItemId === maskItemId
    && item.flags?.["brinkwood-reforged"]?.traitGrant?.traitSourceId === ALCHEMIC_BLOOD_TRAIT_SOURCE_ID
  )) ?? null;
}

export function selectedAlchemicBloodEffectIds(trait) {
  const effects = trait?.system?.alchemicBlood?.effects ?? {};
  return ALCHEMIC_BLOOD_EFFECT_IDS.filter(effectId => effects[effectId] === true);
}

export function prepareAlchemicBloodContext(trait, { editable = false } = {}) {
  if (!trait) return null;
  const selectedIds = selectedAlchemicBloodEffectIds(trait);
  const selected = new Set(selectedIds);
  const hasInitialEffect = selectedIds.length > 0;
  return {
    count: selectedIds.length,
    hasInitialEffect,
    traitId: trait.id ?? trait._id,
    effects: ALCHEMIC_BLOOD_EFFECT_IDS.map(effectId => ({
      id: effectId,
      nameKey: `Mask.AlchemicBlood.Effects.${effectId}.Name`,
      descriptionKey: `Mask.AlchemicBlood.Effects.${effectId}.Description`,
      selected: selected.has(effectId),
      canSelect: editable,
      actionSelected: !selected.has(effectId),
      actionLabelKey: hasInitialEffect
        ? (selected.has(effectId) ? "Mask.AlchemicBlood.Remove" : "Mask.AlchemicBlood.RecordAdvancement")
        : (selected.has(effectId) ? "Mask.AlchemicBlood.Remove" : "Mask.AlchemicBlood.ChooseInitial"),
    })),
  };
}

export function alchemicBloodEffectUpdate(trait, effectId, selected) {
  if (!trait || !isAlchemicBloodEffectId(effectId)) {
    throw new TypeError("Invalid Alchemic Blood effect.");
  }
  return {
    _id: trait.id ?? trait._id,
    [`system.alchemicBlood.effects.${effectId}`]: selected === true,
  };
}
