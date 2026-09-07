const MAX_ENCUMBERED_LOAD = 10;

const LOAD_LEVELS = Object.freeze([
  "BITD.Light", "BITD.Light", "BITD.Light", "BITD.Light",
  "BITD.Normal", "BITD.Normal", "BITD.Heavy", "BITD.Heavy",
  "BITD.Encumbered", "BITD.Encumbered", "BITD.Encumbered", "BITD.OverMax",
]);

const MULE_LOAD_LEVELS = Object.freeze([
  "BITD.Light", "BITD.Light", "BITD.Light", "BITD.Light",
  "BITD.Light", "BITD.Light", "BITD.Normal", "BITD.Normal",
  "BITD.Heavy", "BITD.Encumbered", "BITD.OverMax", "BITD.OverMax",
]);

export const LOADOUT_CAPACITIES = Object.freeze({
  "BITD.Light": 3,
  "BITD.Normal": 5,
  "BITD.Heavy": 7,
});

/** Return the localized encumbrance key for an already-calculated loadout. */
export function encumbranceLevelForLoadout(loadout, hasMule) {
  // Use one sentinel array entry for every overload, while preserving the
  // exact 8-10 Encumbered range.
  const normalizedLoadout = Math.max(0, Math.min(MAX_ENCUMBERED_LOAD + 1, loadout));
  return (hasMule ? MULE_LOAD_LEVELS : LOAD_LEVELS)[normalizedLoadout];
}

/** Mule is an ability rule shared by Character and Mask sheets. */
export function hasMuleAbility(items) {
  return items.some(item => item.type === "ability" && item.name === "(C) Mule");
}
