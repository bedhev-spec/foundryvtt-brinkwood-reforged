import { getItemsByType } from "../item-catalogue.js";
import { LOADOUT_CAPACITIES } from "../encumbrance.js";

// Work is scoped to an actor and catalogue source, rather than a sheet.  Two
// open sheets for the same actor therefore cannot create competing copies.
const sourceQueues = new WeakMap();
const loadLevelRevisions = new WeakMap();
const pendingLoadLevels = new WeakMap();
const LOAD_LEVEL_QUEUE = Symbol("load-level");

function actorItems(actor) {
  return Array.from(actor?.items?.values?.() ?? actor?.items ?? []);
}

function queueFor(actor, sourceId, work) {
  let queues = sourceQueues.get(actor);
  if (!queues) sourceQueues.set(actor, queues = new Map());
  const previous = queues.get(sourceId) ?? Promise.resolve();
  const queued = previous.catch(() => undefined).then(work);
  queues.set(sourceId, queued);
  return queued.finally(() => {
    if (queues.get(sourceId) === queued) queues.delete(sourceId);
  });
}

function notifyFailure(error) {
  console.error("Brinkwood loadout update failed", error);
  globalThis.ui?.notifications?.error?.("Could not update loadout. Please try again.");
}

function sourceIdFor(item) {
  return item?.flags?.["brinkwood-reforged"]?.loadoutSourceId ?? item?._id ?? item?.id;
}

async function findSource(sourceId) {
  const world = game.items?.get?.(sourceId)
    ?? actorItems({ items: game.items }).find(item => sourceIdFor(item) === sourceId);
  if (world?.type === "item") return world;
  const pack = game.packs?.find(candidate => candidate.metadata?.name === "item");
  const direct = await pack?.getDocument?.(sourceId);
  if (direct?.type === "item") return direct;
  const catalogue = await getItemsByType("item", game);
  return catalogue.find(item => sourceIdFor(item) === sourceId);
}

async function resolveOwnedItem(actor, sourceId, itemId, itemName) {
  const items = actorItems(actor);
  const exact = (itemId ? items.find(item => item.id === itemId || item._id === itemId) : undefined)
    ?? items.find(item => item.type === "item" && item.flags?.["brinkwood-reforged"]?.loadoutSourceId === sourceId);
  if (exact?.type === "item") return exact;

  // A name match is only safe when unique.  Persist provenance as soon as a
  // legacy item is adopted, so future renames cannot break reconciliation.
  const legacy = items.filter(item => item.type === "item"
    && !item.flags?.["brinkwood-reforged"]?.loadoutSourceId && item.name === itemName);
  if (legacy.length !== 1) return null;
  return legacy[0];
}

function updateOwnedItem(item, sourceId, changes) {
  const update = { ...changes };
  if (!item.flags?.["brinkwood-reforged"]?.loadoutSourceId) {
    // Adopt legacy provenance in the same write as the requested state. This
    // prevents Foundry hooks from rendering an intermediate unchecked row.
    update["flags.brinkwood-reforged.loadoutSourceId"] = sourceId;
  }
  return item.update(update, { render: false });
}

function controlsForSource(sheet, sourceId) {
  return Array.from(sheet.element?.querySelectorAll?.("[data-loadout-source-id]") ?? [])
    .filter(control => control.dataset.loadoutSourceId === sourceId);
}

function syncLoadoutRow(sheet, sourceId, item, checked = undefined) {
  const itemId = item?.id ?? item?._id ?? "";
  for (const control of controlsForSource(sheet, sourceId)) {
    control.dataset.itemId = itemId;
    if (control.classList?.contains("loadout-item-select")) {
      control.checked = checked ?? Boolean(item?.system?.equipped);
    } else if (control.classList?.contains("loadout-item-load") && item) {
      control.value = String(item.system?.load ?? 0);
    }
  }
  const loadout = calculateLoadoutWeight(actorItems(sheet.actor));
  const selectedLoadLevel = pendingLoadLevels.get(sheet)
    ?? sheet.actor?.system?.selected_load_level;
  updateLoadoutCapacityDisplay(sheet.element, loadout, selectedLoadLevel);
}

function copyForActor(source, sourceId, changes) {
  // Direct world/compendium lookup returns a Foundry Item document, while the
  // catalogue fallback returns plain source data. Embedded creation requires
  // the latter in both cases.
  const data = foundry.utils.deepClone(source?.toObject?.() ?? source);
  delete data._id;
  data.system ??= {};
  Object.assign(data.system, changes);
  data.flags ??= {};
  data.flags["brinkwood-reforged"] = { ...data.flags["brinkwood-reforged"], loadoutSourceId: sourceId };
  return data;
}

export function prepareLoadoutCapacity(loadout, selectedLoadLevel) {
  const selectedLoadLevelKey = Object.hasOwn(LOADOUT_CAPACITIES, selectedLoadLevel)
    ? selectedLoadLevel : "BITD.Light";
  const loadoutCapacity = LOADOUT_CAPACITIES[selectedLoadLevelKey];
  return { selectedLoadLevel: selectedLoadLevelKey, loadoutCapacity, isLoadoutOverloaded: loadout > loadoutCapacity };
}

export function prepareLoadoutCatalogue(catalogue, ownedItems) {
  const rows = new Map();
  const namedRows = new Map();
  for (const item of catalogue) {
    const sourceId = sourceIdFor(item);
    if (!sourceId || rows.has(sourceId)) continue;
    const row = { ...item, sourceId, actorItemId: null, selected: false, isCustom: false };
    rows.set(sourceId, row);
    namedRows.set(item.name, [...(namedRows.get(item.name) ?? []), row]);
  }
  for (const item of ownedItems.filter(item => item.type === "item")) {
    const sourceId = item.flags?.["brinkwood-reforged"]?.loadoutSourceId;
    const nameMatches = namedRows.get(item.name) ?? [];
    const row = (sourceId && rows.get(sourceId)) ?? (nameMatches.length === 1 ? nameMatches[0] : null);
    if (row) {
      row.actorItemId = item._id ?? item.id;
      row.selected = Boolean(item.system?.equipped);
      row.system = { ...(row.system ?? {}), ...(item.system ?? {}) };
      continue;
    }
    const customSourceId = sourceId ?? item._id ?? item.id;
    if (customSourceId && !rows.has(customSourceId)) rows.set(customSourceId, {
      ...item, sourceId: customSourceId, actorItemId: item._id ?? item.id,
      selected: Boolean(item.system?.equipped), isCustom: true,
    });
  }
  return Array.from(rows.values());
}

export function calculateLoadoutWeight(items) {
  const total = items.reduce((weight, item) => item.type === "item" && item.system?.equipped
    ? weight + (Number.parseInt(item.system.load, 10) || 0) : weight, 0);
  // Keep an actual overload visible so the shared encumbrance policy can
  // report OverMax instead of silently presenting it as 10/7.
  return Math.max(0, total);
}

export function updateLoadoutCapacityDisplay(html, loadout, selectedLoadLevel) {
  const capacity = prepareLoadoutCapacity(loadout, selectedLoadLevel);
  const display = html?.querySelector?.(".loadout__weight");
  if (!display) return capacity;

  display.textContent = `${loadout}/${capacity.loadoutCapacity}`;
  display.classList.toggle("is-overloaded", capacity.isLoadoutOverloaded);
  const overloadedLabel = globalThis.game?.i18n?.localize?.("BITD.Overloaded") ?? "Overloaded";
  const ariaLabel = `${loadout}/${capacity.loadoutCapacity}${capacity.isLoadoutOverloaded ? ` — ${overloadedLabel}` : ""}`;
  display.setAttribute("aria-label", ariaLabel);
  if (capacity.isLoadoutOverloaded) display.setAttribute("title", overloadedLabel);
  else display.removeAttribute("title");
  return capacity;
}

function syncLoadoutLevel(sheet, loadout, selectedLoadLevel) {
  const capacity = updateLoadoutCapacityDisplay(sheet.element, loadout, selectedLoadLevel);
  const control = sheet.element?.querySelector?.('select[name="system.selected_load_level"]');
  if (control) control.value = capacity.selectedLoadLevel;
  return capacity;
}

export async function onLoadoutLevelChange(sheet, event) {
  if (!sheet.isEditable) return;
  const loadout = calculateLoadoutWeight(actorItems(sheet.actor));
  const capacity = syncLoadoutLevel(sheet, loadout, event.currentTarget?.value);
  const revision = (loadLevelRevisions.get(sheet) ?? 0) + 1;
  loadLevelRevisions.set(sheet, revision);
  pendingLoadLevels.set(sheet, capacity.selectedLoadLevel);

  try {
    await queueFor(sheet.actor, LOAD_LEVEL_QUEUE, () => sheet.document.update(
      { "system.selected_load_level": capacity.selectedLoadLevel },
      { render: false },
    ));
    if (loadLevelRevisions.get(sheet) !== revision) return;
    pendingLoadLevels.delete(sheet);
    const currentLoadout = calculateLoadoutWeight(actorItems(sheet.actor));
    const selectedLoadLevel = capacity.selectedLoadLevel;
    syncLoadoutLevel(sheet, currentLoadout, selectedLoadLevel);
  } catch (error) {
    // A newer selection already owns the visible state and queued persistence.
    if (loadLevelRevisions.get(sheet) !== revision) return;
    pendingLoadLevels.delete(sheet);
    notifyFailure(error);
    const currentLoadout = calculateLoadoutWeight(actorItems(sheet.actor));
    const selectedLoadLevel = sheet.actor?.system?.selected_load_level;
    syncLoadoutLevel(sheet, currentLoadout, selectedLoadLevel);
  }
}

export function bindLoadoutControls(sheet, html, listenerOptions) {
  if (sheet.isEditable) html.querySelectorAll('select[name="system.selected_load_level"]').forEach(element =>
    element.addEventListener("change", event => onLoadoutLevelChange(sheet, event), listenerOptions));
  html.querySelectorAll(".loadout-item-open").forEach(element =>
    element.addEventListener("click", event => onLoadoutItemOpen(sheet, event), listenerOptions));
  if (sheet.isEditable) html.querySelectorAll(".loadout-item-select").forEach(element =>
    element.addEventListener("click", event => onLoadoutItemToggle(sheet, event), listenerOptions));
  if (!game.user?.isGM) return;
  html.querySelectorAll(".loadout-item-load").forEach(element => {
    element.addEventListener("change", event => {
      if (!sheet._loadoutLoadEnterControls?.has(event.currentTarget)) onLoadoutItemLoadChange(sheet, event);
    }, listenerOptions);
    element.addEventListener("keydown", event => onLoadoutItemLoadKeydown(sheet, event), listenerOptions);
  });
}

export async function onLoadoutItemToggle(sheet, event) {
  if (!sheet.isEditable) return;
  const target = event.currentTarget;
  const sourceId = target?.dataset?.loadoutSourceId;
  const itemId = target?.dataset?.itemId;
  const itemName = target?.dataset?.loadoutItemName;
  const checked = Boolean(target?.checked);
  if (!sourceId) return;
  let persistedItem = null;
  let saved = false;
  try {
    await queueFor(sheet.actor, sourceId, async () => {
      const owned = await resolveOwnedItem(sheet.actor, sourceId, itemId, itemName);
      if (owned) {
        persistedItem = await updateOwnedItem(owned, sourceId, { "system.equipped": checked }) ?? owned;
        return;
      }
      if (!checked) return;
      const source = await findSource(sourceId);
      if (!source) throw new Error(`Unknown loadout source ${sourceId}`);
      const created = await sheet.document.createEmbeddedDocuments(
        "Item",
        [copyForActor(source, sourceId, { equipped: true })],
        { render: false },
      );
      [persistedItem] = Array.from(created ?? []);
    });
    saved = true;
  } catch (error) {
    notifyFailure(error);
  }
  persistedItem ??= await resolveOwnedItem(sheet.actor, sourceId, itemId, itemName);
  // A Foundry render may replace the checkbox while the embedded write is in
  // flight. Project the saved click onto the current root so one native click
  // remains authoritative even when the returned document view is delayed.
  syncLoadoutRow(sheet, sourceId, persistedItem, saved ? checked : undefined);
}

export async function onLoadoutItemLoadChange(sheet, event) {
  if (!sheet.isEditable || !game.user.isGM) return false;
  const control = event.currentTarget;
  const load = Number(control?.value);
  const { loadoutSourceId: sourceId, itemId, loadoutItemName: itemName } = control?.dataset ?? {};
  if (!sourceId || !Number.isInteger(load) || load < 0 || load > 10) {
    if (control) control.value = control.defaultValue;
    return false;
  }
  let persistedItem = null;
  try {
    await queueFor(sheet.actor, sourceId, async () => {
      const owned = await resolveOwnedItem(sheet.actor, sourceId, itemId, itemName);
      if (owned) {
        await updateOwnedItem(owned, sourceId, { "system.load": load });
        persistedItem = owned;
        return;
      }
      const source = await findSource(sourceId);
      if (!source) throw new Error(`Unknown loadout source ${sourceId}`);
      const created = await sheet.document.createEmbeddedDocuments(
        "Item",
        [copyForActor(source, sourceId, { load, equipped: false })],
        { render: false },
      );
      [persistedItem] = Array.from(created ?? []);
    });
  } catch (error) {
    notifyFailure(error);
  }
  persistedItem ??= await resolveOwnedItem(sheet.actor, sourceId, itemId, itemName);
  syncLoadoutRow(sheet, sourceId, persistedItem);
}

export async function onLoadoutItemLoadKeydown(sheet, event) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  event.stopPropagation();
  const control = event.currentTarget;
  sheet._loadoutLoadEnterControls ??= new WeakSet();
  sheet._loadoutLoadEnterControls.add(control);
  try {
    await onLoadoutItemLoadChange(sheet, { currentTarget: control });
    control.blur?.();
  } finally {
    queueMicrotask(() => sheet._loadoutLoadEnterControls?.delete(control));
  }
}

export async function onLoadoutItemOpen(sheet, event) {
  event.preventDefault();
  const { itemId, loadoutSourceId: sourceId } = event.currentTarget.dataset;
  const item = (itemId && sheet.actor.items?.get?.(itemId))
    ?? actorItems(sheet.actor).find(candidate => candidate.type === "item" && sourceIdFor(candidate) === sourceId);
  if (item?.type === "item") return item.sheet?.render({ force: true, editable: game.user.isGM });
  const source = await findSource(sourceId);
  return source?.sheet?.render({ force: true, editable: game.user.isGM });
}
