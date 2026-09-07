export const ACTION_DOT_SOURCE_TYPES = new Set(["class", "profession"]);
export const ACTION_DOT_GRANT_FLAG = "actionDotGrants";
export const ACTION_DOT_MAX = 4;

const ATTRIBUTE_ACTIONS = Object.freeze({
  insight: Object.freeze(["hunt", "study", "survey", "tinker"]),
  prowess: Object.freeze(["finesse", "prowl", "skirmish", "wreck"]),
  resolve: Object.freeze(["attune", "command", "consort", "sway"]),
});

const VALID_PATHS = new Set(Object.entries(ATTRIBUTE_ACTIONS).flatMap(([attribute, actions]) =>
  actions.map(action => `system.attributes.${attribute}.skills.${action}.value`)
));

function clampInteger(value, minimum = 0, maximum = ACTION_DOT_MAX) {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.trunc(number)));
}

function cloneSourceData(source) {
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(source);
  if (globalThis.structuredClone) return structuredClone(source);
  return JSON.parse(JSON.stringify(source));
}

export function normalizeActionDotGrants(grants) {
  if (!Array.isArray(grants)) return [];
  const totals = new Map();
  for (const grant of grants) {
    const path = String(grant?.path ?? "");
    if (!VALID_PATHS.has(path)) continue;
    const value = clampInteger(grant?.value);
    if (!value) continue;
    totals.set(path, Math.min(ACTION_DOT_MAX, (totals.get(path) ?? 0) + value));
  }
  return Array.from(totals, ([path, value]) => ({ path, value }));
}

/** Build the canonical grant snapshot from a Class or Profession's structured data. */
export function actionDotGrantsFromAttributes(source) {
  if (!ACTION_DOT_SOURCE_TYPES.has(source?.type)) return [];
  const grants = [];
  for (const [attribute, actions] of Object.entries(ATTRIBUTE_ACTIONS)) {
    for (const action of actions) {
      const value = clampInteger(source.system?.attributes?.[attribute]?.skills?.[action]?.value);
      if (value) {
        grants.push({
          path: `system.attributes.${attribute}.skills.${action}.value`,
          value,
        });
      }
    }
  }
  return grants;
}

/** Copy picker data and freeze its rules grant as embedded-source provenance. */
export function withActionDotGrantSnapshot(source) {
  if (!ACTION_DOT_SOURCE_TYPES.has(source?.type)) return source;
  const copy = cloneSourceData(source);
  const existingSnapshot = copy.flags?.["brinkwood-reforged"]?.[ACTION_DOT_GRANT_FLAG];
  copy.flags = { ...(copy.flags ?? {}) };
  copy.flags["brinkwood-reforged"] = { ...(copy.flags["brinkwood-reforged"] ?? {}) };
  copy.flags["brinkwood-reforged"][ACTION_DOT_GRANT_FLAG] = Array.isArray(existingSnapshot)
    ? normalizeActionDotGrants(existingSnapshot)
    : actionDotGrantsFromAttributes(copy);
  return copy;
}

export function actionDotGrantsForSource(source) {
  if (!ACTION_DOT_SOURCE_TYPES.has(source?.type)) return [];
  return normalizeActionDotGrants(source.flags?.["brinkwood-reforged"]?.[ACTION_DOT_GRANT_FLAG]);
}

function sourceGrantUnits(sources) {
  const unitsByPath = new Map();
  for (const source of sources ?? []) {
    for (const { path, value } of actionDotGrantsForSource(source)) {
      const units = unitsByPath.get(path) ?? [];
      for (let count = 0; count < value && units.length < ACTION_DOT_MAX; count += 1) {
        units.push({
          id: source.id ?? source._id ?? "",
          name: source.name ?? source.type,
          type: source.type,
        });
      }
      unitsByPath.set(path, units);
    }
  }
  return unitsByPath;
}

/** Trim only overflowing manual ranks against the committed identity sources. */
export function actionDotReconciliationUpdate(actor, sources = actor.items) {
  const update = {};
  for (const [path, units] of sourceGrantUnits(sources)) {
    const current = path.split(".").reduce((value, key) => value?.[key], actor);
    const capacity = ACTION_DOT_MAX - units.length;
    if (Number(current) > capacity) update[path] = capacity;
  }
  return update;
}

/**
 * Mutate a plain Character-sheet attribute context with display-only totals.
 * Persisted skill.value remains the player-owned base value on the Actor.
 */
export function prepareActionDotProjection(attributes, sources, maximum = ACTION_DOT_MAX) {
  const grantUnits = sourceGrantUnits(sources);
  for (const [attributeName, attribute] of Object.entries(attributes ?? {})) {
    for (const [actionName, skill] of Object.entries(attribute.skills ?? {})) {
      const path = `system.attributes.${attributeName}.skills.${actionName}.value`;
      const units = (grantUnits.get(path) ?? []).slice(0, maximum);
      const grantedValue = units.length;
      const baseValue = clampInteger(skill.value, 0, maximum);
      const visibleBaseValue = Math.min(baseValue, maximum - grantedValue);
      const totalValue = Math.min(maximum, grantedValue + baseValue);

      skill.baseValue = baseValue;
      skill.grantedValue = grantedValue;
      skill.manualMaximum = maximum - grantedValue;
      skill.value = totalValue;
      skill.dots = Array.from({ length: maximum }, (_, index) => {
        const position = index + 1;
        const grant = units[index];
        if (grant) return { position, state: "granted", granted: true, source: grant };
        const basePosition = position - grantedValue;
        return {
          position,
          basePosition,
          state: basePosition <= visibleBaseValue ? "manual" : "empty",
          manual: basePosition <= visibleBaseValue,
        };
      });
    }
  }
  return attributes;
}
