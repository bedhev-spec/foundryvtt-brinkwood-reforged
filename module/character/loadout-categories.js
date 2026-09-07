export const LOADOUT_CATEGORY_DEFINITIONS = Object.freeze([
  { value: "Weapons", label: "BITD.LoadoutCategoryWeapons" },
  { value: "Blades", label: "BITD.LoadoutCategoryBlades" },
  { value: "Firearms", label: "BITD.LoadoutCategoryFirearms" },
  { value: "Bows", label: "BITD.LoadoutCategoryBows" },
  { value: "Shields and Armor", label: "BITD.LoadoutCategoryShieldsArmor" },
  { value: "Tools", label: "BITD.LoadoutCategoryTools" },
  { value: "Contraband", label: "BITD.LoadoutCategoryContraband" },
  { value: "Undiscovered", label: "BITD.LoadoutCategoryUndiscovered" },
  { value: "Other", label: "BITD.LoadoutCategoryOther" },
]);

const MANUAL_CATEGORY_BY_ITEM_NAME = new Map([
  ["Blackjack", "Weapons"],
  ["A Blade or Two", "Blades"],
  ["Blade or Two", "Blades"],
  ["Longsword", "Blades"],
  ["Spear", "Blades"],
  ["Flintlock Pistol", "Firearms"],
  ["Pistol", "Firearms"],
  ["Second Pistol", "Firearms"],
  ["Flintlock Rifle", "Firearms"],
  ["Rifle", "Firearms"],
  ["Crossbow", "Bows"],
  ["Hunting Bow", "Bows"],
  ["Shortbow", "Bows"],
  ["Longbow", "Bows"],
  ["Buckler", "Shields and Armor"],
  ["Heavy Round Shield", "Shields and Armor"],
  ["Round Shield", "Shields and Armor"],
  ["Knightly Shield", "Shields and Armor"],
  ["Leather Armor", "Shields and Armor"],
  ["Chainmail", "Shields and Armor"],
  ["Plated Jacket", "Shields and Armor"],
  ["Lantern", "Tools"],
  ["Censer", "Tools"],
  ["Manna Wood", "Tools"],
  ["Burglary Kit", "Tools"],
  ["Tinkering Tools", "Tools"],
  ["Demolition Tools", "Tools"],
  ["Subterfuge Supplies", "Tools"],
  ["Climbing Gear", "Tools"],
  ["Ashwood", "Contraband"],
  ["Black Powder", "Contraband"],
  ["Alchemist's Fire", "Undiscovered"],
  ["Alchemist’s Fire", "Undiscovered"],
  ["Sleeping Powder", "Undiscovered"],
]);

const CATEGORY_BY_NORMALIZED_VALUE = new Map(
  LOADOUT_CATEGORY_DEFINITIONS.map(category => [category.value.toLocaleLowerCase(), category.value]),
);

export function loadoutCategoryForItem(item) {
  const stored = String(item?.system?.class ?? "").trim();
  const normalizedStored = CATEGORY_BY_NORMALIZED_VALUE.get(stored.toLocaleLowerCase());
  return normalizedStored ?? MANUAL_CATEGORY_BY_ITEM_NAME.get(item?.name) ?? "Other";
}

export function prepareLoadoutCategoryOptions(selectedValue) {
  const selected = CATEGORY_BY_NORMALIZED_VALUE.get(String(selectedValue ?? "").trim().toLocaleLowerCase())
    ?? selectedValue;
  return LOADOUT_CATEGORY_DEFINITIONS.map(category => ({
    ...category,
    selected: category.value === selected,
  }));
}

export function groupLoadoutItems(items) {
  const groups = new Map(LOADOUT_CATEGORY_DEFINITIONS.map(category => [category.value, {
    ...category,
    items: [],
  }]));

  for (const item of items) groups.get(loadoutCategoryForItem(item)).items.push(item);
  for (const group of groups.values()) {
    group.items.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
  }

  return Array.from(groups.values()).filter(group => group.items.length > 0);
}
