/**
 * Access to world and compendium item catalogues.
 *
 * This module deliberately has no document-model imports: sheets and pure
 * loadout code can use it before Foundry data fields have been installed.
 */
function asArray(collection) {
  return Array.from(collection?.values?.() ?? collection ?? []);
}

function toObject(item) {
  return item?.toObject?.() ?? item;
}

/** Return the available world and compendium items of one type, by name. */
export async function getItemsByType(itemType, game = globalThis.game) {
  const worldItems = asArray(game?.items)
    .filter(item => item?.type === itemType)
    .map(toObject);
  const pack = asArray(game?.packs).find(candidate => candidate?.metadata?.name === itemType);
  const compendiumItems = pack ? (await pack.getDocuments()).map(toObject) : [];
  return [...worldItems, ...compendiumItems].sort((left, right) =>
    String(left.name).localeCompare(String(right.name), undefined, { sensitivity: "base" }));
}
