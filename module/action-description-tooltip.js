import { renderItemTooltip } from "./item-tooltip.js";

/** Attach the shared titled tooltip component to every action description. */
export function prepareActionDescriptionTooltips(attributes, localize = key => key) {
  for (const attribute of Object.values(attributes ?? {})) {
    for (const skill of Object.values(attribute?.skills ?? {})) {
      skill.tooltipHtml = renderItemTooltip(
        { name: skill.label, system: { description: localize(skill.desc) } },
        localize,
        // Action descriptions are trusted system localization, and may contain
        // authored emphasis and lists that the shared tooltip must preserve.
        value => value,
        { includeStats: false },
      );
    }
  }
  return attributes;
}
