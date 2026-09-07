import { updateCharacterClockDisplay, updateCharacterTrackerDisplay } from "./blades-actor-sheet.js";
import { updateMaskDotDisplay } from "./blades-mask-sheet.js";

function flattenChanges(value, prefix = "", result = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (prefix) result[prefix] = value;
    return result;
  }

  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    flattenChanges(child, path, result);
  }
  return result;
}

function findDot(form, path) {
  return Array.from(form.querySelectorAll(".dot-value")).find(dot => dot.dataset.path === path);
}

export function syncOpenActorTrackers(actor, changes, root = globalThis.document) {
  if (!root?.querySelectorAll) return;
  const changed = flattenChanges(changes);
  const forms = Array.from(root.querySelectorAll("form[data-actor-uuid]"))
    .filter(form => form.dataset.actorUuid === actor.uuid);

  for (const [path, value] of Object.entries(changed)) {
    if (!path.startsWith("system.") || !Number.isFinite(Number(value))) continue;

    for (const form of forms) {
      if (form.classList.contains("character-sheet")) {
        updateCharacterClockDisplay(form, path, value);
        const dot = findDot(form, path);
        if (dot) updateCharacterTrackerDisplay(dot, Number(value));
      } else if (form.classList.contains("mask-sheet")) {
        const dot = findDot(form, path);
        if (dot) updateMaskDotDisplay(dot, Number(value), Number(dot.dataset.max_value));
      }
    }
  }
}
