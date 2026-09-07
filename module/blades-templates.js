/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function() {

  // Define template paths to load
  const templatePaths = [
    // Actor Sheet Partials
    "systems/brinkwood-reforged/templates/parts/attributes.html",
    "systems/brinkwood-reforged/templates/parts/mask-attributes.html",
    "systems/brinkwood-reforged/templates/parts/mask/alchemic-blood.html",
    "systems/brinkwood-reforged/templates/parts/sheet-identity-field.html",
    "systems/brinkwood-reforged/templates/parts/sheet-identity-name.html",
    "systems/brinkwood-reforged/templates/parts/sheet-identity-portrait.html",
    "systems/brinkwood-reforged/templates/parts/sheet-identity-row.html",
    "systems/brinkwood-reforged/templates/parts/sheet-identity-tracker.html",
    "systems/brinkwood-reforged/templates/parts/linked-journal-cta.html",
    "systems/brinkwood-reforged/templates/parts/sheet-notes.html",
    "systems/brinkwood-reforged/templates/overlay/global-clocks.html",
    "systems/brinkwood-reforged/templates/overlay/global-clock-dialog.html",
    "systems/brinkwood-reforged/templates/parts/active-effects.html",
    "systems/brinkwood-reforged/templates/parts/actor-active-effects.html",
		"systems/brinkwood-reforged/templates/chat/roll-calculation.html",
    "systems/brinkwood-reforged/templates/parts/actor/downtime.html",
    "systems/brinkwood-reforged/templates/parts/actor/trait-card.html",
		"systems/brinkwood-reforged/templates/parts/teeth-section.html",
		"systems/brinkwood-reforged/templates/rebelion-sheet/sedition-section.html",
		"systems/brinkwood-reforged/templates/rebelion-sheet/aspect-section.html",
		"systems/brinkwood-reforged/templates/rebelion-sheet/moot-section.html"
  ];

  // Load the template parts
  return foundry.applications.handlebars.loadTemplates(templatePaths);
};
