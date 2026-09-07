import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  GLOBAL_CLOCK_MAX_SIZE,
  GLOBAL_CLOCK_FACE_BACKGROUND,
  normalizeGlobalClockLocation,
  nextGlobalClockValue,
  normalizeGlobalClock,
  previousGlobalClockValue,
} from "../module/global-clock-utils.js";

class TestCollection extends Map {
  get contents() {
    return [...this.values()];
  }
}

globalThis.Collection = TestCollection;
globalThis.foundry = {
  applications: { api: {
    ApplicationV2: class {},
    HandlebarsApplicationMixin: Base => Base,
    DialogV2: { confirm: async () => false },
  } },
  utils: {
    deepClone: value => structuredClone(value),
    randomID: () => "new-clock",
    debounce: callback => callback,
  },
};
globalThis.Hooks = { on: () => {} };
globalThis.ui = { notifications: { warn: () => {} } };
globalThis.game = {
  user: { isGM: true },
  settings: { get: () => ({}), set: async () => {} },
  brinkwood: { clockOverlay: { refresh: () => {} } },
};

const {
 GlobalClockStore,
  confirmAndDeleteGlobalClock,
  globalClockBottomInset,
  globalClockHudContainer,
  globalClockRightInset,
  placeGlobalClockOverlay,
  registerGlobalClockSystem,
} = await import("../module/global-clocks.js");

test("clock placement is user-specific while clock data remains shared", t => {
  const originalSettings = game.settings;
  const originalBrinkwood = { ...game.brinkwood };
  t.after(() => { game.settings = originalSettings; game.brinkwood = originalBrinkwood; });
  const settings = new Map();
  game.settings = { register: (_namespace, key, definition) => settings.set(key, definition) };
  registerGlobalClockSystem();
  assert.equal(settings.get("globalClocks").scope, "world");
  assert.equal(settings.get("globalClockLocation").scope, "user");
  assert.equal(settings.get("globalClockOffset").scope, "user");
  assert.deepEqual(Object.keys(settings.get("globalClockLocation").choices), ["topRight", "bottomRight"]);
  let movedTo = null;
  game.brinkwood.clockOverlay = { setLocation: location => { movedTo = location; } };
  settings.get("globalClockLocation").onChange("bottomRight");
  assert.equal(movedTo, "bottomRight");
});

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");

test("global clocks normalize progress without tracker or point types", () => {
  assert.deepEqual(normalizeGlobalClock({ name: " Alarm ", value: 9, max: 6 }), {
    id: null,
    name: "Alarm",
    value: 6,
    max: 6,
    color: "#8f2f35",
    backgroundColor: GLOBAL_CLOCK_FACE_BACKGROUND,
    private: false,
  });
  assert.equal(normalizeGlobalClock({ max: 999 }).max, GLOBAL_CLOCK_MAX_SIZE);
});

test("clock face background migrates only the exact legacy default", () => {
  assert.equal(normalizeGlobalClock({}).backgroundColor, GLOBAL_CLOCK_FACE_BACKGROUND);
  assert.equal(
    normalizeGlobalClock({ backgroundColor: "rgba(20, 16, 18, 0.78)" }).backgroundColor,
    GLOBAL_CLOCK_FACE_BACKGROUND,
  );
  assert.equal(normalizeGlobalClock({ backgroundColor: "#735b91" }).backgroundColor, "#735b91");
  assert.equal(normalizeGlobalClock({ backgroundColor: "#979ba1" }).backgroundColor, "#979ba1");
});

test("global clock interaction wraps in both directions", () => {
  assert.equal(nextGlobalClockValue(3, 4), 4);
  assert.equal(nextGlobalClockValue(4, 4), 0);
  assert.equal(previousGlobalClockValue(1, 4), 0);
  assert.equal(previousGlobalClockValue(0, 4), 4);
});

test("global clock locations stay on the right and migrate the former bottom-left value", () => {
  assert.equal(normalizeGlobalClockLocation("topRight"), "topRight");
  assert.equal(normalizeGlobalClockLocation("bottomRight"), "bottomRight");
  assert.equal(normalizeGlobalClockLocation("bottomLeft"), "bottomRight");
  assert.equal(normalizeGlobalClockLocation("unknown"), "bottomRight");
});

test("the clock overlay prefers Foundry's right HUD column over its parent container", () => {
  const queries = [];
  const child = { id: "ui-right-column-1" };
  const parent = { id: "ui-right" };
  const browserDocument = {
    querySelector(selector) {
      queries.push(selector);
      return selector === "#ui-right-column-1" ? child : parent;
    },
  };

  assert.equal(globalClockHudContainer(browserDocument), child);
  assert.deepEqual(queries, ["#ui-right-column-1"]);
});

test("clock insets follow only the visible right sidebar and floating chat form", () => {
  const style = { display: "block", visibility: "visible" };
  const ownerDocument = { defaultView: { getComputedStyle: () => style } };
  const hud = { ownerDocument, hidden: false, getBoundingClientRect: () => ({ width: 80, height: 700, left: 920, right: 1000, top: 0 }) };
  const sidebar = { ownerDocument, hidden: false, getBoundingClientRect: () => ({ width: 320, height: 700, left: 680, right: 1000, top: 0 }) };
  const chat = { ownerDocument, hidden: false, getBoundingClientRect: () => ({ width: 300, height: 70, left: 690, right: 990, top: 680 }) };
  const browserDocument = {
    documentElement: { clientWidth: 1000, clientHeight: 750 },
    querySelector(selector) {
      return { "#ui-right-column-1": hud, "#sidebar": sidebar, "#chat-form": chat }[selector] ?? null;
    },
  };

  assert.equal(globalClockRightInset(browserDocument), 320);
  assert.equal(globalClockBottomInset(browserDocument), 78);
  style.display = "none";
  assert.equal(globalClockRightInset(browserDocument), 0);
  assert.equal(globalClockBottomInset(browserDocument), 14);
});

test("clock placement stays anchored to the Foundry right HUD and avoids redundant DOM moves", () => {
  const classes = new Set();
  const display = { classList: { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) } };
  let contained = false;
  const moves = [];
  const column = {
    contains: () => contained,
    prepend: element => { contained = true; moves.push(["prepend", element]); },
    append: element => { contained = true; moves.push(["append", element]); },
  };
  const browserDocument = {
    querySelector: selector => selector === "#ui-right-column-1" ? column : null,
  };
  const element = { dataset: {}, querySelector: () => display };

  assert.equal(placeGlobalClockOverlay(element, "topRight", browserDocument), true);
  assert.equal(placeGlobalClockOverlay(element, "topRight", browserDocument), true);
  assert.equal(placeGlobalClockOverlay(element, "bottomRight", browserDocument), true);
  assert.equal(element.dataset.location, "bottomRight");
  assert.deepEqual([...classes], ["bottom"]);
  assert.deepEqual(moves, [["prepend", element], ["append", element]]);
});

test("bottom-right placement appends once to the same Foundry HUD column", () => {
  let contained = false;
  let appends = 0;
  const column = {
    contains: () => contained,
    prepend: () => assert.fail("bottom-right placement must not prepend"),
    append: () => { contained = true; appends += 1; },
  };
  const display = { classList: { toggle: () => {} } };
  const browserDocument = {
    querySelector: selector => selector === "#ui-right-column-1" ? column : null,
  };
  const element = { dataset: {}, querySelector: () => display };

  placeGlobalClockOverlay(element, "bottomRight", browserDocument);
  placeGlobalClockOverlay(element, "bottomRight", browserDocument);
  assert.equal(appends, 1);
});

test("global clock deletion persists through a Map-backed Collection", async () => {
  let clocks = { alarm: { id: "alarm", name: "Alarm", value: 1, max: 4 } };
  let writes = 0;
  game.user = { isGM: true };
  game.settings = {
    get: () => clocks,
    set: async (_scope, _key, next) => {
      writes += 1;
      clocks = next;
    },
  };
  const store = new GlobalClockStore();
  store.refresh();

  assert.equal(await confirmAndDeleteGlobalClock(store.get("alarm"), async () => true, id => store.delete(id)), true);
  assert.equal(writes, 1);
  assert.equal(store.has("alarm"), false);
  assert.deepEqual(clocks, {});
});

test("cancelling a global clock deletion does not write", async () => {
  let writes = 0;
  const result = await confirmAndDeleteGlobalClock(
    { id: "alarm", name: "Alarm" },
    async () => false,
    async () => { writes += 1; },
  );
  assert.equal(result, false);
  assert.equal(writes, 0);
});

test("a rejected clock write preserves local state for a later retry", async () => {
  let clocks = { alarm: { id: "alarm", name: "Alarm", value: 1, max: 4 } };
  let rejectWrite = true;
  game.user = { isGM: true };
  game.settings = {
    get: () => clocks,
    set: async (_scope, _key, next) => {
      if (rejectWrite) throw new Error("write failed");
      clocks = next;
    },
  };
  const store = new GlobalClockStore();
  store.refresh();

  await assert.rejects(store.delete("alarm"), /write failed/);
  assert.equal(store.has("alarm"), true);
  assert.equal(clocks.alarm.name, "Alarm");

  rejectWrite = false;
  assert.equal(await store.delete("alarm"), true);
  assert.equal(store.has("alarm"), false);
  assert.deepEqual(clocks, {});
});

test("non-GMs cannot persist global clock changes", async () => {
  let writes = 0;
  game.user = { isGM: false };
  game.settings = {
    get: () => ({ alarm: { id: "alarm", name: "Alarm", value: 1, max: 4 } }),
    set: async () => { writes += 1; },
  };
  const store = new GlobalClockStore();
  store.refresh();

  assert.equal(store.delete("alarm"), false);
  assert.equal(store.create({ name: "New" }), false);
  assert.equal(writes, 0);
});

test("the integrated overlay contains clocks only and retains attribution", async () => {
  const [controller, panel, dialog, styles, notices, bootstrap] = await Promise.all([
    read("module/global-clocks.js"),
    read("templates/overlay/global-clocks.html"),
    read("templates/overlay/global-clock-dialog.html"),
    read("scss/import/global-clocks.scss"),
    read("THIRD_PARTY_NOTICES.txt"),
    read("module/blades.js"),
  ]);

  const implementation = [controller, panel, dialog, styles].join("\n");
  assert.doesNotMatch(implementation, /addTracker|addPoints|points-element|tracker-element|Sortable|gsap/);
  assert.match(controller, /Carlos Fernandez \(Supe\)/);
  assert.match(controller, /escapeHTML\(clock\.name\)/);
  assert.match(controller, /#mutationQueue/);
  assert.match(controller, /super\.delete\(id\)/);
  assert.doesNotMatch(controller, /this\.remove\(id\)/);
  assert.match(controller, /this\.store\.step\(event\.currentTarget\.dataset\.clockId, 1\)/);
  assert.match(controller, /this\.store\.step\(event\.currentTarget\.dataset\.clockId, -1\)/);
  assert.match(controller, /placeGlobalClockOverlay\(html, context\.location\)/);
  assert.match(controller, /onChange: moveOverlay/);
  assert.match(controller, /toggleVisibility: GlobalClockOverlay\.#onToggleVisibility/);
  assert.match(controller, /togglePrivate\(id\)/);
  assert.match(controller, /this\.store\.togglePrivate\(clock\.id\)/);
  assert.match(controller, /ResizeObserver/);
  assert.match(controller, /_onClose\(options\)[\s\S]*?#positionObserver\?\.disconnect\(\)/);
  assert.doesNotMatch(controller, /\[data-application\], \.application, \.app|observe\(document\.body/);
  assert.match(controller, /MutationObserver[\s\S]*?attributeFilter: \["class", "style", "hidden"\]/);
  assert.match(controller, /closeOnSubmit: false/);
  assert.match(controller, /await this\.onSubmit\?\.\(data\) === true/);
  assert.match(controller, /signal: this\.#clockListenerController\.signal/);

  assert.match(styles, /--global-clock-size: 36px/);
  assert.match(styles, /--global-clock-controls-min-width:\s*calc/);
  assert.match(styles, /#brinkwood-global-clock-overlay\s*\{[\s\S]*?max-width:\s*305px/);
  assert.match(styles, /\.global-clock-display\s*\{[\s\S]*?min-width:\s*0/);
  assert.match(styles, /&\.has-clocks\s*\{[\s\S]*?min-width:\s*190px/);
  assert.match(styles, /\.global-clock-entry\s*\{[\s\S]*?max-width:\s*285px/);
  assert.match(styles, /min-width: max\(190px, calc\(var\(--global-clock-controls-min-width\) \+ var\(--global-clock-size\)\)\)/);
  assert.match(styles, /\.global-clock-entry\s*\{[\s\S]*?align-self: flex-end/);
  assert.match(styles, /\.global-clock-display\.has-clocks\.top \.global-clock__toolbar[\s\S]*?align-self: start/);
  assert.match(styles, /\.global-clock-display\.has-clocks\.bottom \.global-clock__toolbar[\s\S]*?align-self: end/);
  assert.match(styles, /\.global-clock-display\.has-clocks\.top \.global-clock-list[\s\S]*?padding-top: var\(--global-clock-toolbar-center-offset\)/);
  assert.match(styles, /\.global-clock-display\.has-clocks\.bottom \.global-clock-list[\s\S]*?padding-bottom: var\(--global-clock-toolbar-center-offset\)/);
  assert.doesNotMatch(styles, /\.global-clock-display\.has-clocks\.(?:top|bottom) \.global-clock__toolbar[\s\S]*?margin-(?:top|bottom):\s*-4px/);
  assert.doesNotMatch(styles, /global-clock-pill-height|global-clock-overlap|translateX/);
  assert.match(styles, /\.global-clock-entry\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) var\(--global-clock-size\)[\s\S]*?min-width: max\(190px,[\s\S]*?background: var\(--control-bg-color\)/);
  assert.match(styles, /\.global-clock__name\s*\{[\s\S]*?padding: 0 8px 0 12px/);
  assert.match(styles, /\.global-clock__progress\s*\{[\s\S]*?white-space: nowrap/);
  assert.match(styles, /\.global-clock__toolbar\s*\{[\s\S]*?background:\s*var\(--control-bg-color, #202b36\)[\s\S]*?color:\s*var\(--control-icon-color, #e6e7e8\)/);
  assert.match(styles, /\.global-clock__toolbar \.global-clock__add\s*\{[\s\S]*?width: var\(--global-clock-size\)[\s\S]*?height: var\(--global-clock-size\)/);
  assert.match(panel, /global-clock__name[\s\S]*?global-clock__progress[\s\S]*?global-clock__controls[\s\S]*?global-clock__face/);
  assert.match(panel, /data-action="addClock"[\s\S]*?fa-solid fa-clock/);
  assert.match(panel, /--clock-background: \{\{clock\.backgroundColor\}\}/);
  assert.match(panel, /data-action="toggleVisibility"/);
  assert.match(panel, /data-tooltip=/);
  assert.match(panel, /BITD\.GlobalClock\.(?:Hide|Show)/);
  assert.match(controller, /bottomRight: "BITD\.GlobalClock\.LocationBottomRight"/);
  assert.match(controller, /default: "topRight"/);
  assert.match(notices, /Carlos Fernandez/);
  assert.match(panel, /global-clock__face/);
  assert.match(bootstrap, /registerGlobalClockSystem\(\)/);
});
