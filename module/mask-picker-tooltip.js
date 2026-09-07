import { escapeHTML } from "./html-utils.js";
import { renderItemTooltip } from "./item-tooltip.js";

const MASK_DESCRIPTION_KEYS = {
  judgement: "Mask.Descriptions.Judgement",
  judgment: "Mask.Descriptions.Judgement",
  lies: "Mask.Descriptions.Lies",
  riot: "Mask.Descriptions.Riot",
  ruin: "Mask.Descriptions.Ruin",
  terror: "Mask.Descriptions.Terror",
  torment: "Mask.Descriptions.Torment",
  violence: "Mask.Descriptions.Violence",
};

export function maskDescriptionKey(maskName) {
  return MASK_DESCRIPTION_KEYS[String(maskName ?? "").trim().toLowerCase()] ?? "";
}

/**
 * Mask selection is configuration, not an inventory comparison. Its picker
 * tooltip therefore presents only the localized Mask name and rich-text rule
 * description instead of serializing generic item system fields.
 */
export function renderMaskPickerTooltip(item, enrichedDescription) {
  const descriptionKey = maskDescriptionKey(item?.name);
  const fallbackDescription = descriptionKey
    ? `<p>${escapeHTML(game.i18n.localize(descriptionKey))}</p>`
    : "";
  const description = String(enrichedDescription ?? "").trim() || fallbackDescription;
  return renderItemTooltip(
    item,
    key => game.i18n.localize(key),
    () => description,
    { includeStats: false },
  );
}
