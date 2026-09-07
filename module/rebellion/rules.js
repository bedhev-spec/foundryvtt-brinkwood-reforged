export const ASPECT_NAMES = Object.freeze(["Organization", "Force", "Influence"]);
export const ASPECT_THRESHOLDS = Object.freeze([4, 6, 8]);

export const DOWNTIME_ACTIONS = Object.freeze({
  Organization: Object.freeze(["Prepare", "Recover", "Reconnect"]),
  Force: Object.freeze(["Hone Equipment", "Command Cohort", "Requisition Asset"]),
  Influence: Object.freeze(["Long-Term Project", "Reconnaissance", "Reduce Heat"]),
});

const integer = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Math.trunc(Number(value))
  : fallback;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, integer(value)));
const clone = value => globalThis.structuredClone
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value));

function progressFor(raw = {}) {
  const source = Array.isArray(raw.progress) ? raw.progress : [];
  return ASPECT_THRESHOLDS.map((maximum, index) => clamp(source[index], 0, maximum));
}

function inferredLegacyRank(progress) {
  let rank = 0;
  while (rank < ASPECT_THRESHOLDS.length && progress[rank] >= ASPECT_THRESHOLDS[rank]) rank += 1;
  return rank;
}

export function normalizeAspect(raw = {}, fallbackName = "Organization") {
  const name = ASPECT_NAMES.includes(raw.name) ? raw.name : fallbackName;
  const progress = progressFor(raw);
  const hasExplicitRank = raw.rank !== null && raw.rank !== undefined && raw.rank !== "";
  const rank = hasExplicitRank
    ? clamp(raw.rank, 0, ASPECT_THRESHOLDS.length)
    : inferredLegacyRank(progress);
  const noncontiguous = progress.some((value, index) => index > rank && value > 0)
    || progress.some((value, index) => index < rank && value < ASPECT_THRESHOLDS[index]);

  return {
    ...raw,
    name,
    rank,
    progress,
    max_progress: [...ASPECT_THRESHOLDS],
    decisions: Array.isArray(raw.decisions) ? raw.decisions.map(decision => ({ ...decision })) : [],
    noncontiguous,
    currentProgress: rank < ASPECT_THRESHOLDS.length ? progress[rank] : ASPECT_THRESHOLDS.at(-1),
    currentMaximum: rank < ASPECT_THRESHOLDS.length ? ASPECT_THRESHOLDS[rank] : ASPECT_THRESHOLDS.at(-1),
  };
}

export function normalizeAspects(aspects = []) {
  const list = Array.isArray(aspects) ? aspects : [];
  const byName = new Map(list.map(aspect => [aspect?.name, aspect]));
  return ASPECT_NAMES.map(name => normalizeAspect(byName.get(name) ?? {}, name));
}

function serializeAspect(aspect) {
  const { noncontiguous, currentProgress, currentMaximum, ...serialized } = aspect;
  return serialized;
}

export function adjustAspectProgress(aspects, aspectName, amount) {
  const normalized = normalizeAspects(aspects);
  const index = normalized.findIndex(aspect => aspect.name === aspectName);
  if (index < 0 || integer(amount) === 0) return { aspects: normalized.map(serializeAspect), changed: false, rankedUp: false };

  const aspect = normalized[index];
  if (aspect.rank >= ASPECT_THRESHOLDS.length) {
    return { aspects: normalized.map(serializeAspect), changed: false, rankedUp: false };
  }

  const before = aspect.progress[aspect.rank];
  const after = clamp(before + integer(amount), 0, ASPECT_THRESHOLDS[aspect.rank]);
  aspect.progress[aspect.rank] = after;
  const rankedUp = integer(amount) > 0 && after === ASPECT_THRESHOLDS[aspect.rank];
  if (rankedUp) aspect.rank += 1;

  return {
    aspects: normalized.map(serializeAspect),
    changed: before !== after || rankedUp,
    rankedUp,
    rank: aspect.rank,
  };
}

export function correctAspectRank(aspects, aspectName, rank) {
  const normalized = normalizeAspects(aspects);
  const aspect = normalized.find(candidate => candidate.name === aspectName);
  if (!aspect) return normalized.map(serializeAspect);
  aspect.rank = clamp(rank, 0, ASPECT_THRESHOLDS.length);
  return normalized.map(serializeAspect);
}

/** Undo the last completed rank while leaving its final clock one tick short. */
export function undoAspectRank(aspects, aspectName) {
  const normalized = normalizeAspects(aspects);
  const aspect = normalized.find(candidate => candidate.name === aspectName);
  if (!aspect || aspect.rank <= 0) {
    return { aspects: normalized.map(serializeAspect), changed: false, rank: aspect?.rank ?? 0 };
  }

  const rank = aspect.rank - 1;
  aspect.rank = rank;
  aspect.progress[rank] = Math.max(0, ASPECT_THRESHOLDS[rank] - 1);
  for (let index = rank + 1; index < aspect.progress.length; index += 1) aspect.progress[index] = 0;
  return { aspects: normalized.map(serializeAspect), changed: true, rank };
}

export function resupplyMaximum(aspects) {
  const organization = normalizeAspects(aspects).find(aspect => aspect.name === "Organization");
  return 4 + (2 * (organization?.rank ?? 0));
}

export function normalizeResupply(resupply, aspects) {
  const max = resupplyMaximum(aspects);
  const value = clamp(resupply?.value ?? resupply, 0, max);
  return { ...(resupply && typeof resupply === "object" ? resupply : {}), value, max };
}

export function adjustResupply(resupply, aspects, amount) {
  const normalized = normalizeResupply(resupply, aspects);
  return { ...normalized, value: clamp(normalized.value + integer(amount), 0, normalized.max) };
}

export function gainHeat({ heat, tyranny }, amount) {
  const normalizedHeat = {
    ...(heat ?? {}),
    value: clamp(heat?.value, 0, heat?.max ?? 10),
    max: clamp(heat?.max ?? 10, 1, 100),
  };
  const normalizedTyranny = normalizeTyranny(tyranny);
  const gain = Math.max(0, integer(amount));
  if (!gain) return { heat: normalizedHeat, tyranny: normalizedTyranny, escalated: false };
  if (normalizedHeat.value >= normalizedHeat.max) {
    return {
      heat: { ...normalizedHeat, value: 0 },
      tyranny: { ...normalizedTyranny, value: normalizedTyranny.value + 1 },
      escalated: true,
    };
  }
  return {
    heat: { ...normalizedHeat, value: clamp(normalizedHeat.value + gain, 0, normalizedHeat.max) },
    tyranny: normalizedTyranny,
    escalated: false,
  };
}

/** Tyranny is a campaign level, not a four-segment clock.  Retain a legacy
 * max for old documents but never use it as a cap. */
export function normalizeTyranny(tyranny) {
  return {
    ...(tyranny ?? {}),
    value: Math.max(0, integer(tyranny?.value)),
    max: Math.max(4, integer(tyranny?.max, 4)),
  };
}

export function tyrannySeverity(value) {
  const level = Math.max(0, integer(value));
  // Printed Low/Moderate ranges overlap at 1–2; project deterministically.
  if (level <= 1) return "low";
  if (level === 2) return "moderate";
  return "high";
}

export function correctHeat(heat, value) {
  const max = clamp(heat?.max ?? 10, 1, 100);
  return { ...(heat ?? {}), value: clamp(value, 0, max), max };
}

export function normalizeLocation(location = {}, defaultMaximum = 6) {
  const max = clamp(location?.sedition?.clock?.max ?? defaultMaximum, 1, 100);
  return {
    ...location,
    name: String(location.name ?? ""),
    sedition: {
      ...(location.sedition ?? {}),
      clock: {
        ...(location.sedition?.clock ?? {}),
        value: clamp(location.sedition?.clock?.value, 0, max),
        max,
      },
      level: clamp(location.sedition?.level, 0, 3),
    },
  };
}

export function gainSedition(location, amount, defaultMaximum = 6) {
  const normalized = normalizeLocation(location, defaultMaximum);
  const gain = Math.max(0, integer(amount));
  if (!gain) return { location: normalized, advanced: false };
  const filled = normalized.sedition.clock.value + gain >= normalized.sedition.clock.max;
  if (filled && normalized.sedition.level < 3) {
    return {
      location: {
        ...normalized,
        sedition: {
          ...normalized.sedition,
          clock: { ...normalized.sedition.clock, value: 0 },
          level: normalized.sedition.level + 1,
        },
      },
      advanced: true,
    };
  }
  return {
    location: {
      ...normalized,
      sedition: {
        ...normalized.sedition,
        clock: {
          ...normalized.sedition.clock,
          value: clamp(normalized.sedition.clock.value + gain, 0, normalized.sedition.clock.max),
        },
      },
    },
    advanced: false,
  };
}

export function correctSedition(location, field, value, defaultMaximum = 6) {
  const normalized = normalizeLocation(location, defaultMaximum);
  if (field === "level") normalized.sedition.level = clamp(value, 0, 3);
  if (field === "clock") normalized.sedition.clock.value = clamp(value, 0, normalized.sedition.clock.max);
  return normalized;
}

export function eligibleLeastProgressAspects(aspects) {
  const normalized = normalizeAspects(aspects);
  const values = normalized.map(aspect => aspect.rank < 3 ? aspect.progress[aspect.rank] : ASPECT_THRESHOLDS.at(-1));
  const least = Math.min(...values);
  return normalized.filter((aspect, index) => values[index] === least).map(aspect => aspect.name);
}

export function applyGoingUnderground(system, { result, aspectName } = {}) {
  const next = clone(system ?? {});
  next.aspects = normalizeAspects(next.aspects).map(serializeAspect);
  next.resupply = normalizeResupply(next.resupply, next.aspects);
  next.heat = correctHeat(next.heat, 0);
  next.tyranny = { ...normalizeTyranny(next.tyranny), value: Math.max(0, integer(next.tyranny?.value) - 1) };

  if (result === "critical") {
    if (!ASPECT_NAMES.includes(aspectName)) return { system: next, changed: false, requiresChoice: ASPECT_NAMES };
    next.aspects = adjustAspectProgress(next.aspects, aspectName, 2).aspects;
  } else if (result === "4-5") {
    next.resupply = adjustResupply(next.resupply, next.aspects, 2);
  } else if (result === "1-3") {
    const eligible = eligibleLeastProgressAspects(next.aspects);
    if (!eligible.includes(aspectName)) return { system: next, changed: false, requiresChoice: eligible };
    const aspect = normalizeAspects(next.aspects).find(candidate => candidate.name === aspectName);
    if (aspect.rank < 3) aspect.progress[aspect.rank] = 0;
    next.aspects = normalizeAspects(next.aspects).map(candidate => serializeAspect(
      candidate.name === aspectName ? aspect : candidate,
    ));
  } else if (result !== "6") {
    return { system: next, changed: false, invalid: true };
  }

  return { system: next, changed: true, requiresChoice: [] };
}

export function rebellionReadiness(system = {}) {
  const aspects = normalizeAspects(system.aspects);
  const totalRanks = aspects.reduce((total, aspect) => total + aspect.rank, 0);
  const liberated = [
    ...(Array.isArray(system.towns) ? system.towns : []).map(location => ({ ...normalizeLocation(location, 8), type: "town" })),
    ...(Array.isArray(system.villages) ? system.villages : []).map(location => ({ ...normalizeLocation(location, 6), type: "village" })),
  ].filter(location => location.sedition.level >= 3);
  return { totalRanks, ready: totalRanks >= 6, liberated };
}

export function downtimeEntitlements(aspects) {
  return normalizeAspects(aspects).map(aspect => ({
    aspect: aspect.name,
    rank: aspect.rank,
    count: aspect.rank,
    actions: [...DOWNTIME_ACTIONS[aspect.name]],
  }));
}
