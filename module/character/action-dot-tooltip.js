import { escapeHTML } from "../html-utils.js";
import { formatTooltipDescription, renderItemTooltip } from "../item-tooltip.js";
import { actionDotGrantsFromAttributes } from "./action-dot-grants.js";

function actionLabelKey(path) {
  const action = String(path).split(".").at(-2) ?? "";
  return `Actor.Actions.${action.charAt(0).toUpperCase()}${action.slice(1)}.Name`;
}

/** Render narrative identity text and canonical structured Action Dot grants. */
export function renderActionDotSourceTooltip(
  item,
  enrichedDescription,
  localize = key => key,
) {
  const grants = actionDotGrantsFromAttributes(item);
  const grantList = grants.map(({ path, value }) =>
    `<li><strong>${value}</strong> ${escapeHTML(localize(actionLabelKey(path)))}</li>`
  ).join("");
  const grantsHtml = grantList
    ? `<section class="brinkwood-item-tooltip__grants"><h4>${escapeHTML(localize("BITD.ActionDots"))}</h4><ul>${grantList}</ul></section>`
    : "";

  return renderItemTooltip(
    item,
    localize,
    () => `${formatTooltipDescription(enrichedDescription)}${grantsHtml}`,
    { includeStats: false },
  );
}
