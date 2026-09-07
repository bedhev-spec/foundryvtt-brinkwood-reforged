const stylesheet = document.querySelector("#brinkwood-stylesheet");
const status = document.querySelector("#stylesheet-status");
const results = document.querySelector("#identity-geometry-results");
const stage = document.querySelector("#comparison-stage");
const captures = {};

function activeMode() {
  return document.querySelector('input[name="stylesheet"]:checked').value;
}

function geometryFor(row) {
  const label = row.querySelector(".item-class-label .identity-choice__content");
  const value = row.querySelector(".identity-choice__value");
  const text = row.querySelector(".item-name");
  const remove = row.querySelector(".identity-choice__remove");
  const rowRect = row.getBoundingClientRect();
  const centerOffset = element => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return Number((rect.top + rect.height / 2 - (rowRect.top + rowRect.height / 2)).toFixed(2));
  };
  const rowStyle = getComputedStyle(row);
  const valueStyle = value ? getComputedStyle(value) : null;
  const textStyle = text ? getComputedStyle(text) : null;
  return {
    row: { height: rowRect.height, display: rowStyle.display, gridTemplateColumns: rowStyle.gridTemplateColumns, overflow: rowStyle.overflow },
    centers: { label: centerOffset(label), value: centerOffset(text), remove: centerOffset(remove) },
    value: value && { width: value.getBoundingClientRect().width, display: valueStyle.display, gridTemplateColumns: valueStyle.gridTemplateColumns, overflow: valueStyle.overflow },
    text: text && { width: text.getBoundingClientRect().width, whiteSpace: textStyle.whiteSpace, overflow: textStyle.overflow, textOverflow: textStyle.textOverflow, overflowWrap: textStyle.overflowWrap },
    remove: remove && { width: remove.getBoundingClientRect().width, height: remove.getBoundingClientRect().height },
  };
}

function readGeometry() {
  return Object.fromEntries(Array.from(document.querySelectorAll("[data-case]"), row => [row.dataset.case, geometryFor(row)]));
}

function deepDiff(baseline, current, path = "") {
  if (typeof baseline !== "object" || baseline === null || typeof current !== "object" || current === null) {
    return Object.is(baseline, current) ? [] : [{ path, baseline, current }];
  }
  const keys = new Set([...Object.keys(baseline), ...Object.keys(current)]);
  return Array.from(keys).flatMap(key => deepDiff(baseline[key], current[key], path ? `${path}.${key}` : key));
}

function show(value) {
  results.textContent = JSON.stringify(value, null, 2);
}

function setStylesheet(mode) {
  status.dataset.status = "loading";
  status.textContent = `Loading ${mode} stylesheet…`;
  stylesheet.href = mode === "baseline" ? "../../styles/baseline.css" : "../../styles/blades.css";
}

stylesheet.addEventListener("load", () => {
  status.dataset.status = "ready";
  status.textContent = `${activeMode()} stylesheet ready.`;
});
stylesheet.addEventListener("error", () => {
  status.dataset.status = "failed";
  status.textContent = `${activeMode()} stylesheet failed to load.`;
});
document.querySelectorAll('input[name="stylesheet"]').forEach(input => input.addEventListener("change", () => setStylesheet(activeMode())));
document.querySelectorAll("[data-width]").forEach(button => button.addEventListener("click", () => {
  stage.style.inlineSize = `${button.dataset.width}px`;
  stage.dataset.width = button.dataset.width;
  show({ mode: activeMode(), width: Number(button.dataset.width), geometry: readGeometry() });
}));
document.querySelector("#capture-identity-geometry").addEventListener("click", async () => {
  await document.fonts.ready;
  captures[activeMode()] = { width: Number(stage.dataset.width), geometry: readGeometry() };
  show({ captured: activeMode(), ...captures[activeMode()] });
});
document.querySelector("#compare-identity-geometry").addEventListener("click", () => {
  if (!captures.baseline || !captures.current || captures.baseline.width !== captures.current.width) {
    show({ error: "Capture baseline and current at the same width before comparing." });
    return;
  }
  show({ width: captures.current.width, differences: deepDiff(captures.baseline.geometry, captures.current.geometry) });
});
