export const SHOW_UNFINISHED_ITEM_TYPES_SETTING = "showUnfinishedItemTypes";

export const registerSystemSettings = function() {

  /**
   * Track the system version upon which point a migration was last applied
   */
  game.settings.register("brinkwood-reforged", "systemMigrationVersion", {
    name: "System Migration Version",
    scope: "world",
    config: false,
    type: String,
    default: "0.5"
  });

  game.settings.register("brinkwood-reforged", SHOW_UNFINISHED_ITEM_TYPES_SETTING, {
    name: "BITD.SettingsShowUnfinishedItemTypes",
    hint: "BITD.SettingsShowUnfinishedItemTypesHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });
};
