import {
  ASPECT_NAMES,
  downtimeEntitlements,
  normalizeAspects,
  normalizeLocation,
  normalizeResupply,
  normalizeTyranny,
  rebellionReadiness,
  tyrannySeverity,
  correctHeat,
} from "./rules.js";

const asArray = value => Array.isArray(value) ? value : [];
const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;

function legacyAllyId(ally, index) {
  const source = `${index}|${ally?.name ?? ""}|${ally?.sourceUuid ?? ally?.source_actor_uuid ?? ""}|${ally?.originAspect ?? ""}`;
  let hash = 2166136261;
  for (const character of source) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `legacy-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function normalizeAlly(ally = {}, index = 0) {
  return {
    ...ally,
    id: String(ally.id || ally._id || legacyAllyId(ally, index)),
    name: String(ally.name ?? ""),
    strengths: Array.isArray(ally.strengths)
      ? ally.strengths.map(value => String(value).trim()).filter(Boolean)
      : String(ally.strengths ?? "").split(",").map(value => value.trim()).filter(Boolean),
    sourceUuid: String(ally.sourceUuid ?? ally.source_actor_uuid ?? ""),
    originAspect: ASPECT_NAMES.includes(ally.originAspect) ? ally.originAspect : "",
    originRank: Math.min(3, Math.max(0, integer(ally.originRank))),
  };
}

function projectLocation(location, index, collection, defaultMaximum) {
  const normalized = normalizeLocation(location, defaultMaximum);
  return {
    ...normalized,
    index,
    collection,
    clockTracker: {
      name: `${normalized.name} Sedition`,
      value: normalized.sedition.clock.value,
      max: normalized.sedition.clock.max,
    },
    levelTracker: {
      name: `${normalized.name} Level`,
      value: normalized.sedition.level,
      max: 3,
    },
  };
}

export function projectRebellion(system = {}, catalogue = []) {
  const normalizedAspects = normalizeAspects(system.aspects);
  const entitlementByAspect = new Map(downtimeEntitlements(normalizedAspects)
    .map(entitlement => [entitlement.aspect, entitlement]));
  const aspects = normalizedAspects.map(aspect => {
    const decisions = aspect.decisions.map(decision => ({
      ...decision,
      active: aspect.rank >= integer(decision.rank),
    }));
    const projectedCatalogue = catalogue
      .filter(entry => entry.aspect === aspect.name)
      .map(entry => ({
        ...entry,
        unlocked: entry.rank <= aspect.rank,
        snapshot: decisions.find(decision => decision.sourceUuid === entry.sourceUuid
          || decision.catalogueId === entry.id
          || decision.title === entry.title),
      }));
    const unansweredMoots = projectedCatalogue.filter(entry => entry.unlocked && !entry.snapshot);
    const recordedMoots = projectedCatalogue.filter(entry => entry.snapshot?.active);
    const unmatchedDecisions = decisions.filter(decision => !decision.active
      || !projectedCatalogue.some(entry => entry.snapshot === decision));
    const lockedRanks = projectedCatalogue.filter(entry => !entry.unlocked).map(entry => entry.rank);
    return {
      ...aspect,
      value: aspect.currentProgress,
      max: aspect.currentMaximum,
      decisions,
      catalogue: projectedCatalogue,
      entitlement: entitlementByAspect.get(aspect.name),
      unansweredMoots,
      recordedMoots,
      unmatchedDecisions,
      hasMootContent: Boolean(unansweredMoots.length || recordedMoots.length || unmatchedDecisions.length),
      nextMootRank: lockedRanks.length ? Math.min(...lockedRanks) : null,
    };
  });
  const resupply = { ...normalizeResupply(system.resupply, aspects), name: "Resupply" };
  const towns = asArray(system.towns).map((location, index) => projectLocation(location, index, "towns", 8));
  const villages = asArray(system.villages).map((location, index) => projectLocation(location, index, "villages", 6));
  const lands = asArray(system.lands).map((location, index) => projectLocation(location, index, "lands", location?.sedition?.clock?.max ?? 6));
  const readiness = rebellionReadiness({ ...system, aspects, towns, villages });
  return {
    aspects,
    resupply,
    towns,
    villages,
    lands,
    allies: asArray(system.conclave).map(normalizeAlly),
    readiness,
    tyranny: { ...normalizeTyranny(system.tyranny), severity: tyrannySeverity(system.tyranny?.value), name: "BITD.Tyranny" },
    heat: { ...correctHeat(system.heat ?? { value: 0, max: 10 }, system.heat?.value ?? 0), name: "BITD.Heat" },
  };
}
