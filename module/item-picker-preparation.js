/**
 * Prepare picker rows from source items. Dialog presentation and document
 * mutations stay with the sheet so actor-specific commands remain local.
 */
export async function prepareItemPickerRows(items, {
  document,
  localize,
  enrichHTML,
  renderTooltip,
} = {}) {
  const pickerRows = [];
  for (const item of items ?? []) {
    const system = item.system ?? {};
    let details = "";
    if (typeof system.load !== "undefined") details = `(${system.load})`;
    else if (typeof system.price !== "undefined") details = `(${system.price})`;

    const enrichedDescription = await enrichHTML(String(system.description ?? ""), {
      async: true,
      relativeTo: document,
      secrets: document?.isOwner,
    });
    pickerRows.push({
      id: item._id,
      name: localize(item.name),
      details,
      tooltipHtml: renderTooltip(item, enrichedDescription),
    });
  }
  return pickerRows;
}
