const rect = element => element.getBoundingClientRect();
const midpoint = box => box.top + box.height / 2;
const close = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;

await document.fonts.ready;

const aspectCases = [...document.querySelectorAll("[data-aspect-case]")];
const rowCases = [...document.querySelectorAll("[data-row-case]")];
const aspectColumns = aspectCases.map(stage => getComputedStyle(stage.querySelector(".rebelion-aspects-grid")).gridTemplateColumns.split(" ").length);
const footerAlignment = aspectCases.map(stage => {
  const footers = [...stage.querySelectorAll(".rebelion-aspect-summary__footer")].slice(0, 2);
  return footers.length === 2 && close(rect(footers[0]).top, rect(footers[1]).top);
});

const rows = rowCases.flatMap(stage => [...stage.querySelectorAll(".rebelion-underground__actor")]);
const baseline = element => {
  const probe = document.createElement("i");
  probe.style.cssText = "display:inline-block;width:0;height:0;padding:0;margin:0;border:0;vertical-align:baseline";
  element.append(probe);
  const y = rect(probe).top;
  probe.remove();
  return y;
};
const rowCentersAlign = rows.every(row => {
  const checkbox = rect(row.querySelector(".bw-checkbox-x"));
  const name = rect(row.querySelector(".rebelion-underground__actor-name"));
  const label = rect(row.querySelector(".rebelion-underground__actor-resource-label"));
  const value = rect(row.querySelector(".rebelion-underground__actor-resource-value"));
  const text = rect(row.querySelector(".rebelion-underground__actor-text"));
  return close(midpoint(checkbox), midpoint(text));
});
const textBaselinesAlign = rows.every(row => {
  const cells = [...row.querySelectorAll('.rebelion-underground__actor-name, .rebelion-underground__actor-resource-label, .rebelion-underground__actor-resource-value')];
  const positions = cells.map(baseline);
  return positions.every(y => close(y, positions[0], 0.5));
});
const resourceTextAligns = rows.every(row => {
  const label = rect(row.querySelector(".rebelion-underground__actor-resource-label"));
  const value = rect(row.querySelector(".rebelion-underground__actor-resource-value"));
  return close(midpoint(label), midpoint(value));
});
const resourceEndGaps = rowCases.map(stage => [...stage.querySelectorAll(".rebelion-underground__actor")].map(row => Math.round(rect(row).right - rect(row.querySelector(".rebelion-underground__actor-resource-value")).right)));
const longName = document.querySelector('[data-row-case][data-width="900"] .rebelion-underground__actor:nth-of-type(2) .rebelion-underground__actor-name');
const rowGroupColumns = rowCases.map(stage => getComputedStyle(stage.querySelector(".rebelion-underground__actor-groups")).gridTemplateColumns.split(" ").length);

const assertions = {
  aspectGridUsesThreeThenTwoColumns: aspectColumns[0] === 3 && aspectColumns[1] === 2,
  nextMootFootersShareRowBaseline: footerAlignment.every(Boolean),
  aspectCardsUseExplicitThreeRowGrid: [...document.querySelectorAll(".rebelion-aspect-summary")].every(card => getComputedStyle(card).display === "grid" && getComputedStyle(card).gridTemplateRows.split(" ").length === 3),
  characterAndMaskRowsHaveFixedHeight: rows.every(row => close(rect(row).height, 30, 0.1)),
  actorNamesAndResourcesShareVerticalCenter: rowCentersAlign,
  actorTextSharesActualBaseline: textBaselinesAlign,
  resourceLabelsAndValuesShareVerticalCenter: resourceTextAligns,
  resourceColumnsStayAnchoredAtRowEnd: resourceEndGaps.every(gaps => gaps.every(gap => gap === gaps[0])),
  longNamesEllipsizeWithoutMovingResource: longName.scrollWidth > longName.clientWidth,
  actorGroupsUseTwoThenOneColumn: rowGroupColumns[0] === 2 && rowGroupColumns[1] === 1,
};

const output = document.querySelector("#rebellion-alignment-results");
output.dataset.status = Object.values(assertions).every(Boolean) ? "passed" : "failed";
output.textContent = JSON.stringify({ assertions, aspectColumns, resourceEndGaps, rowGroupColumns }, null, 2);
