import { SHOW_UNFINISHED_ITEM_TYPES_SETTING } from "./settings.js";

const STABLE_ITEM_TYPE = "item";

function isItemCreationDialog(element) {
  const name = element?.querySelector?.('form.dialog-form input[name="name"]');
  const type = element?.querySelector?.('form.dialog-form select[name="type"]');
  if (!name || !type?.querySelector?.(`option[value="${STABLE_ITEM_TYPE}"]`)) return false;
  const label = game.i18n.localize(CONFIG.Item.documentClass.metadata.label);
  return name.placeholder === label;
}

export function filterItemCreationTypes(element, { showAllTypes } = {}) {
  if (!isItemCreationDialog(element)) return false;
  const showAll = showAllTypes ?? (game.user?.isGM
    && game.settings.get("brinkwood-reforged", SHOW_UNFINISHED_ITEM_TYPES_SETTING));
  if (showAll) return false;

  const type = element.querySelector('form.dialog-form select[name="type"]');
  for (const option of Array.from(type.options ?? [])) {
    if (option.value !== STABLE_ITEM_TYPE) option.remove();
  }
  type.value = STABLE_ITEM_TYPE;
  return true;
}

export function registerItemCreationTypeFilter() {
  Hooks.on("renderDialogV2", (_application, element) => filterItemCreationTypes(element));
}
