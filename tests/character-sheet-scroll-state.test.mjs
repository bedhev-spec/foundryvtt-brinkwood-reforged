import assert from "node:assert/strict";
import test from "node:test";

import {
  captureCharacterEffectViewport,
  captureSheetViewState,
  restoreCharacterEffectViewport,
  restoreSheetViewState,
} from "../module/sheet-view-state.js";

function characterRoot({ formScrollTop, formClientHeight, formScrollHeight }) {
  const panel = {
    dataset: { tab: "downtime" },
  };
  const form = {
    scrollTop: formScrollTop,
    scrollLeft: 0,
    clientHeight: formClientHeight,
    scrollHeight: formScrollHeight,
    matches: selector => selector === "form"
      || selector === "form.actor-sheet"
      || selector === "form.actor-sheet.character-sheet",
    querySelector(selector) {
      if (selector === ".sheet-tab-content > .tab.active") return panel;
      if (selector === '.tab[data-group="primary"].active') return panel;
      if (selector === ".sheet-tab-content") return {};
      return null;
    },
  };
  return { form, panel };
}

for (const viewport of [
  { name: "short", clientHeight: 720, scrollHeight: 1640 },
  { name: "tall", clientHeight: 1200, scrollHeight: 2100 },
]) {
  test(`Character view state delegates root scrolling at ${viewport.name} viewport height`, () => {
    const { form, panel } = characterRoot({
      formScrollTop: 318,
      formClientHeight: viewport.clientHeight,
      formScrollHeight: viewport.scrollHeight,
    });

    const state = captureSheetViewState(form);
    assert.deepEqual(state.scrollPositions, {});

    form.scrollTop = 0;
    panel.scrollTop = 91;
    restoreSheetViewState(form, state);
    assert.equal(form.scrollTop, 0);
    assert.equal(panel.scrollTop, 91);
  });
}

test("non-Character sheets retain their active panel scroll owner", () => {
  const form = { scrollTop: 212, scrollLeft: 8 };
  const windowContent = { scrollTop: 61, scrollLeft: 4 };
  const tabViewport = { scrollTop: 145, scrollLeft: 2, dataset: { tab: "downtime" } };
  const root = {
    matches: () => false,
    closest: selector => selector === ".window-content" ? windowContent : null,
    querySelector(selector) {
      if (selector === ".sheet-tab-content > .tab.active") return tabViewport;
      if (selector === ".sheet-tab-content") return {};
      if (selector === "form.actor-sheet") return form;
      if (selector === '.tab[data-group="primary"].active') return tabViewport;
      return null;
    },
  };

  const state = captureSheetViewState(root);
  assert.deepEqual(state.scrollPositions, { tab: { scrollTop: 145, scrollLeft: 2 } });
  form.scrollTop = 99;
  windowContent.scrollTop = 33;
  tabViewport.scrollTop = 0;
  restoreSheetViewState(root, state);
  assert.equal(tabViewport.scrollTop, 145);
  assert.equal(form.scrollTop, 0);
  assert.equal(windowContent.scrollTop, 0);
});

test("Character Effect viewport follows the natural range after content shrinks", () => {
  const oldAnchor = { getBoundingClientRect: () => ({ top: 100, height: 300 }) };
  const oldForm = {
    scrollTop: 500,
    clientHeight: 400,
    scrollHeight: 900,
    matches: selector => selector === "form.actor-sheet.character-sheet",
    querySelectorAll: selector => selector === ".actor-effects" ? [oldAnchor] : [],
  };
  const control = { closest: selector => selector === ".actor-effects" ? oldAnchor : null };
  const state = captureCharacterEffectViewport(oldForm, control);

  const formWithinRange = {
    scrollTop: 400,
    clientHeight: 400,
    scrollHeight: 1000,
    matches: selector => selector === "form.actor-sheet.character-sheet",
  };
  const anchorWithinRange = {
    getBoundingClientRect: () => ({ top: 200, height: 200 }),
  };
  formWithinRange.querySelectorAll = selector => selector === ".actor-effects" ? [anchorWithinRange] : [];
  assert.equal(restoreCharacterEffectViewport(formWithinRange, state), true);
  assert.equal(formWithinRange.scrollTop, 500, "anchor stays stable when the natural range permits it");

  const shrunkenForm = {
    scrollTop: 400,
    clientHeight: 400,
    scrollHeight: 800,
    matches: selector => selector === "form.actor-sheet.character-sheet",
    append() { throw new Error("deleted content must not be replaced by a spacer"); },
  };
  const shrunkenAnchor = {
    getBoundingClientRect: () => ({ top: 200, height: 40 }),
  };
  shrunkenForm.querySelectorAll = selector => selector === ".actor-effects" ? [shrunkenAnchor] : [];
  assert.equal(restoreCharacterEffectViewport(shrunkenForm, state), true);
  assert.equal(shrunkenForm.scrollTop, 400, "scroll clamps immediately to the new natural bottom");
});
