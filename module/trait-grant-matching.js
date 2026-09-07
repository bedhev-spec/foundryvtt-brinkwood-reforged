/**
 * Canonicalize published source names before comparing Mask and Trait classes.
 * Existing worlds may still store the former US spelling, so both spellings
 * resolve to the rulebook/UI spelling without rewriting user documents.
 */
export function canonicalTraitSourceName(value) {
  const normalized = String(value ?? "").trim().toLocaleLowerCase();
  return normalized === "judgment" ? "judgement" : normalized;
}

/** Read the supported Foundry compendium provenance locations from a document. */
export function compendiumSourceMetadata(item) {
  return [
    item?.uuid,
    item?.flags?.core?.sourceId,
    item?._stats?.compendiumSource,
    item?.getFlag?.("core", "sourceId"),
  ].filter(value => typeof value === "string" && value.length);
}

/** Determine whether an embedded Trait came from this exact compendium Trait. */
export function traitHasCompendiumProvenance(embeddedTrait, compendiumTrait) {
  const compendiumId = compendiumTrait?.id ?? compendiumTrait?._id;
  const expectedSources = new Set(compendiumSourceMetadata(compendiumTrait));
  if (compendiumId) expectedSources.add(compendiumId);
  return compendiumSourceMetadata(embeddedTrait).some(source =>
    expectedSources.has(source) || (compendiumId && source.endsWith(`.${compendiumId}`))
  );
}
