import { escapeHTML } from "./html-utils.js";

export function formatTooltipDescription(description) {
  const trimmed = String(description ?? "").trim();
  const match = trimmed.match(/^<p(?:\s[^>]*)?>([\s\S]*)<\/p>$/i);
  const isSingleParagraph = match
    && (trimmed.match(/<p(?:\s[^>]*)?>/gi) ?? []).length === 1;
  if (!isSingleParagraph && /<(?:div|p|ul|ol|section|table|h[1-6])\b/i.test(trimmed)) return trimmed;
  const content = isSingleParagraph ? match[1] : trimmed;

  const sentences = content
    .split(/(?<=[.!?])\s+(?=(?:<[^>]+>)*[A-ZÀ-ÖØ-Þ])/u)
    .map(sentence => sentence.trim())
    .filter(Boolean);
  if (sentences.length < 3) {
    const clauses = content
      .split(/(?<=;)\s+/)
      .map(clause => clause.trim())
      .filter(Boolean);
    if (clauses.length > 1) return clauses.map(clause => `<p>${clause}</p>`).join("");
    return isSingleParagraph ? trimmed : `<p>${content}</p>`;
  }

  const paragraphs = [];
  for (let index = 0; index < sentences.length; index += 2) {
    paragraphs.push(`<p>${sentences.slice(index, index + 2).join(" ")}</p>`);
  }
  return paragraphs.join("");
}

/** Keep the Pact declaration separate from its oath clauses. */
export function formatPactTooltipDescription(description) {
  const trimmed = String(description ?? "").trim();
  const paragraph = trimmed.match(/^<p(?:\s[^>]*)?>([\s\S]*)<\/p>$/i);
  const content = paragraph ? paragraph[1] : trimmed;
  const vow = content.match(/^([\s\S]*?<\/strong>),\s*([\s\S]+)$/i);
  if (!vow) return formatTooltipDescription(trimmed);

  // Split coordinated oath clauses, not every infinitive (e.g. "ever to plunge").
  // Keep the original separators and final "and" as part of the displayed vow.
  const clauses = vow[2]
    .split(/(?<=[,;])\s+(?=(?:and\s+)?to\b)/i)
    .map(clause => clause.trim())
    .filter(Boolean);
  if (!clauses.length) return formatTooltipDescription(trimmed);

  return `<p>${vow[1]}</p><ul>${clauses.map(clause => `<li>${clause}</li>`).join("")}</ul>`;
}

function renderTooltipDescriptionBlock(description, enrichDescription) {
  const enriched = String(enrichDescription(String(description ?? "")) ?? "").trim();
  if (!enriched) return "";
  return `<div class="brinkwood-item-tooltip__description">${formatTooltipDescription(enriched)}</div>`;
}

export function renderDescriptionTooltip(
  description,
  enrichDescription = value => `<p>${escapeHTML(value)}</p>`,
) {
  const descriptionBlock = renderTooltipDescriptionBlock(description, enrichDescription);
  if (!descriptionBlock) return "";
  return `<section class="brinkwood-item-tooltip brinkwood-item-tooltip--description-only">${descriptionBlock}</section>`;
}

/**
 * Render the information shown by an item-picker help control.
 *
 * `enrichDescription` is deliberately supplied by the Foundry caller: it
 * can use Foundry's rich-text enricher while keeping this formatter testable and
 * safe when used outside a rendered Foundry application.
 */
export function renderItemTooltip(
  item,
  localize = key => key,
  enrichDescription = escapeHTML,
  { includeStats = true } = {},
) {
  const system = item?.system ?? {};
  const fields = [
    ["BITD.Load", system.load],
    ["BITD.Uses", system.uses],
    ["BITD.NumberAvailable", system.num_available],
    ["BITD.Class", system.class]
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");

  const rows = includeStats ? fields.map(([label, value]) => `
    <div class="brinkwood-item-tooltip__stat">
      <span>${escapeHTML(localize(label))}</span>
      <strong>${escapeHTML(value)}</strong>
    </div>`).join("") : "";
  const additionalInfo = String(system.additional_info ?? "").trim();
  const description = renderTooltipDescriptionBlock(system.description, enrichDescription);

  return `
    <section class="brinkwood-item-tooltip">
      <header>${escapeHTML(localize(item?.name ?? ""))}</header>
      ${rows ? `<div class="brinkwood-item-tooltip__stats">${rows}</div>` : ""}
      ${description}
      ${additionalInfo ? `<p>${escapeHTML(additionalInfo)}</p>` : ""}
    </section>`;
}
