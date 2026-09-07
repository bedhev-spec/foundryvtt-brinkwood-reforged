import assert from "node:assert/strict";
import test from "node:test";
import {
  activateEffectTab,
  captureSheetViewState,
  normalizeEffectTab,
  restoreSheetViewState,
} from "../module/sheet-view-state.js";

test("effect tab normalization selects the first visible category", () => {
  const effects = {
    passive: { type: "passive", visible: false },
    temporary: { type: "temporary", visible: true },
    inactive: { type: "inactive", visible: true },
  };
  assert.equal(normalizeEffectTab(effects, "passive"), "temporary");
  assert.equal(normalizeEffectTab(effects, "inactive"), "inactive");
  assert.equal(normalizeEffectTab({}, undefined), "temporary");
});

test("view state retains both form and window scroll independently", () => {
  const form = { scrollTop: 12, scrollLeft: 3 };
  const windowContent = { scrollTop: 34, scrollLeft: 5 };
  const root = {
    matches: () => false,
    closest: selector => selector === ".window-content" ? windowContent : null,
    querySelector: selector => selector === "form.actor-sheet" ? form
      : selector === '.tab[data-group="primary"].active' ? { dataset: { tab: "notes" } } : null,
  };
  const state = captureSheetViewState(root, { effectTab: "temporary" });
  form.scrollTop = windowContent.scrollTop = 0;
  restoreSheetViewState(root, state, {
    setPrimaryTab: tab => { root.primary = tab; },
    activateEffectTab: tab => { root.effect = tab; },
  });
  assert.equal(root.primary, "notes");
  assert.equal(root.effect, "temporary");
  assert.deepEqual(form, { scrollTop: 12, scrollLeft: 3 });
  assert.deepEqual(windowContent, { scrollTop: 34, scrollLeft: 5 });
});

test("bounded sheets preserve only the active tab panel scroll", () => {
  const tab = { scrollTop: 57, scrollLeft: 2, dataset: { tab: "traits" } };
  const form = { scrollTop: 12, scrollLeft: 3 };
  const windowContent = { scrollTop: 34, scrollLeft: 5 };
  const root = {
    matches: () => false,
    closest: selector => selector === ".window-content" ? windowContent : null,
    querySelector: selector => selector === ".sheet-tab-content > .tab.active" ? tab
      : selector === ".sheet-tab-content" ? {}
      : selector === '.tab[data-group="primary"].active' ? tab
      : selector === "form.actor-sheet" ? form
      : null,
  };

  const state = captureSheetViewState(root);
  tab.scrollTop = tab.scrollLeft = 0;
  restoreSheetViewState(root, state, { setPrimaryTab: value => { root.primary = value; } });

  assert.equal(root.primary, "traits");
  assert.deepEqual(tab, { scrollTop: 57, scrollLeft: 2, dataset: { tab: "traits" } });
  assert.deepEqual(form, { scrollTop: 0, scrollLeft: 0 });
  assert.deepEqual(windowContent, { scrollTop: 0, scrollLeft: 0 });
});

test("effect activation synchronizes roving tab state and panels", () => {
  const classes = () => ({ active: false, toggle(_name, value) { this.active = value; } });
  const passive = { classList: classes(), setAttribute(name, value) { this[name] = value; } };
  const temporary = { classList: classes(), setAttribute(name, value) { this[name] = value; } };
  const passivePanel = { dataset: { effectPanel: "passive" } };
  const temporaryPanel = { dataset: { effectPanel: "temporary" } };
  const root = {
    querySelector: selector => selector === '[data-effect-tab="temporary"]' ? temporary : null,
    querySelectorAll: selector => selector === "[data-effect-tab]" ? [passive, temporary] : [passivePanel, temporaryPanel],
  };
  assert.equal(activateEffectTab(root, "temporary"), true);
  assert.equal(passive.classList.active, false);
  assert.equal(temporary.classList.active, true);
  assert.equal(passive["aria-selected"], "false");
  assert.equal(temporary["aria-selected"], "true");
  assert.equal(passive.tabIndex, -1);
  assert.equal(temporary.tabIndex, 0);
  assert.equal(passivePanel.hidden, true);
  assert.equal(temporaryPanel.hidden, false);
});
