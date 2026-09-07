import assert from "node:assert/strict";
import test from "node:test";

// Loadout helpers deliberately import without Foundry data-model setup.
globalThis.foundry ??= {};

const {
  bindLoadoutControls,
  calculateLoadoutWeight,
  onLoadoutItemLoadChange,
  onLoadoutItemLoadKeydown,
  onLoadoutLevelChange,
  onLoadoutItemOpen,
  onLoadoutItemToggle,
  prepareLoadoutCatalogue,
} = await import("../module/character/loadout.js");
const { getItemsByType } = await import("../module/item-catalogue.js");

test("pure loadout and catalogue modules import without Foundry data fields", () => {
  assert.equal(typeof prepareLoadoutCatalogue, "function");
  assert.equal(typeof getItemsByType, "function");
  assert.equal(globalThis.foundry.abstract?.TypeDataModel, undefined);
  assert.equal(globalThis.foundry.data?.fields, undefined);
});

test("catalogue access combines available sources and surfaces a rejected pack for recovery", async () => {
  const world = { id: "world", type: "item", name: "Zulu", toObject: () => ({ _id: "world", type: "item", name: "Zulu" }) };
  const compendium = { id: "pack", type: "item", name: "Alpha", toObject: () => ({ _id: "pack", type: "item", name: "Alpha" }) };
  const game = {
    items: new Map([[world.id, world]]),
    packs: [{ metadata: { name: "item" }, async getDocuments() { return [compendium]; } }],
  };
  assert.deepEqual((await getItemsByType("item", game)).map(item => item.name), ["Alpha", "Zulu"]);
  game.packs[0].getDocuments = async () => { throw new Error("catalogue unavailable"); };
  await assert.rejects(() => getItemsByType("item", game), /catalogue unavailable/);
});

test("catalogue failure message is localized in every supported locale", async () => {
  const { readFile } = await import("node:fs/promises");
  const root = new URL("../", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("system.json", root), "utf8"));
  const template = await readFile(new URL("templates/actor-sheet.html", root), "utf8");

  assert.ok(template.includes('{{localize "BITD.LoadoutCatalogueUnavailable"}}'));
  assert.ok(!template.includes("Loadout catalogue unavailable."));
  for (const language of manifest.languages) {
    const locale = JSON.parse(await readFile(new URL(language.path, root), "utf8"));
    assert.equal(typeof locale["BITD.LoadoutCatalogueUnavailable"], "string", language.lang);
    assert.ok(locale["BITD.LoadoutCatalogueUnavailable"].trim(), language.lang);
  }
});

test("load tier immediately projects capacity and overload state through the loadout owner", async () => {
  const attributes = new Map();
  const display = {
    textContent: "6/7",
    classList: { values: new Set(), toggle(name, enabled) { enabled ? this.values.add(name) : this.values.delete(name); } },
    setAttribute(name, value) { attributes.set(name, value); },
    removeAttribute(name) { attributes.delete(name); },
  };
  const control = { value: "BITD.Normal" };
  const updates = [];
  const sheet = {
    isEditable: true,
    actor: { items: [{ type: "item", system: { equipped: true, load: 6 } }] },
    element: { querySelector: selector => selector === ".loadout__weight" ? display : null },
    document: { update: async (update, options) => updates.push({ update, options }) },
  };

  await onLoadoutLevelChange(sheet, { currentTarget: control });

  assert.equal(display.textContent, "6/5");
  assert.equal(display.classList.values.has("is-overloaded"), true);
  assert.equal(attributes.get("aria-label"), "6/5 — Overloaded");
  assert.equal(attributes.get("title"), "Overloaded");
  assert.deepEqual(updates, [{
    update: { "system.selected_load_level": "BITD.Normal" },
    options: { render: false },
  }]);
});

test("rapid load-tier changes serialize persistence and stale failure cannot roll back the latest choice", async () => {
  let rejectFirst;
  const firstUpdate = new Promise((_resolve, reject) => { rejectFirst = reject; });
  const persisted = [];
  const display = {
    textContent: "0/3",
    classList: { toggle() {} },
    setAttribute() {},
    removeAttribute() {},
  };
  const sheet = {
    isEditable: true,
    actor: { items: [], system: { selected_load_level: "BITD.Light" } },
    element: { querySelector: selector => selector === ".loadout__weight" ? display : null },
    document: {
      update(update) {
        persisted.push(update["system.selected_load_level"]);
        return persisted.length === 1 ? firstUpdate : Promise.resolve();
      },
    },
  };
  const normal = { value: "BITD.Normal" };
  const heavy = { value: "BITD.Heavy" };

  const first = onLoadoutLevelChange(sheet, { currentTarget: normal });
  const second = onLoadoutLevelChange(sheet, { currentTarget: heavy });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(persisted, ["BITD.Normal"], "the second write waits for the first");
  assert.equal(display.textContent, "0/7", "the latest selection owns the optimistic display");

  rejectFirst(new Error("stale failure"));
  await Promise.all([first, second]);

  assert.deepEqual(persisted, ["BITD.Normal", "BITD.Heavy"]);
  assert.equal(display.textContent, "0/7", "a stale failure cannot roll back the newer selection");
  assert.equal(heavy.value, "BITD.Heavy");
});

test("load-tier completion projects saved state onto a replacement selector", async () => {
  let releaseSave;
  const savePending = new Promise(resolve => { releaseSave = resolve; });
  const display = {
    textContent: "0/3",
    classList: { toggle() {} },
    setAttribute() {},
    removeAttribute() {},
  };
  const originalControl = { value: "BITD.Heavy" };
  let liveControl = originalControl;
  const sheet = {
    isEditable: true,
    actor: { items: [], system: { selected_load_level: "BITD.Light" } },
    element: {
      querySelector(selector) {
        if (selector === ".loadout__weight") return display;
        if (selector === 'select[name="system.selected_load_level"]') return liveControl;
        return null;
      },
    },
    document: { update: () => savePending },
  };

  const saving = onLoadoutLevelChange(sheet, { currentTarget: originalControl });
  liveControl = { value: "BITD.Light" };
  releaseSave();
  await saving;

  assert.equal(liveControl.value, "BITD.Heavy");
  assert.equal(display.textContent, "0/7");
});

test("load-tier failure restores authoritative state onto a replacement selector", async () => {
  let rejectSave;
  const savePending = new Promise((_, reject) => { rejectSave = reject; });
  const display = {
    textContent: "0/3",
    classList: { toggle() {} },
    setAttribute() {},
    removeAttribute() {},
  };
  const originalControl = { value: "BITD.Heavy" };
  let liveControl = originalControl;
  const sheet = {
    isEditable: true,
    actor: { items: [], system: { selected_load_level: "BITD.Light" } },
    element: {
      querySelector(selector) {
        if (selector === ".loadout__weight") return display;
        if (selector === 'select[name="system.selected_load_level"]') return liveControl;
        return null;
      },
    },
    document: { update: () => savePending },
  };

  const saving = onLoadoutLevelChange(sheet, { currentTarget: originalControl });
  liveControl = { value: "BITD.Heavy" };
  rejectSave(new Error("save failed"));
  await saving;

  assert.equal(liveControl.value, "BITD.Light");
  assert.equal(display.textContent, "0/3");
});

test("an overlapping item save keeps the pending load-tier capacity visible", async () => {
  let releaseLevel;
  const levelGate = new Promise(resolve => { releaseLevel = resolve; });
  const display = {
    textContent: "0/3",
    classList: { toggle() {} },
    setAttribute() {},
    removeAttribute() {},
  };
  const owned = {
    id: "owned-rope",
    type: "item",
    name: "Rope",
    flags: { "brinkwood-reforged": { loadoutSourceId: "rope" } },
    system: { equipped: false, load: 1 },
    async update(changes) {
      this.system.equipped = changes["system.equipped"];
    },
  };
  const checkbox = {
    checked: true,
    dataset: { itemId: owned.id, loadoutSourceId: "rope", loadoutItemName: owned.name },
    classList: { contains: name => name === "loadout-item-select" },
  };
  const actor = { items: [owned], system: { selected_load_level: "BITD.Light" } };
  const sheet = {
    isEditable: true,
    actor,
    element: {
      querySelector: selector => selector === ".loadout__weight" ? display : null,
      querySelectorAll: selector => selector === "[data-loadout-source-id]" ? [checkbox] : [],
    },
    document: {
      async update(changes) {
        await levelGate;
        actor.system.selected_load_level = changes["system.selected_load_level"];
      },
    },
  };

  const levelSave = onLoadoutLevelChange(sheet, { currentTarget: { value: "BITD.Heavy" } });
  await onLoadoutItemToggle(sheet, { currentTarget: checkbox });

  assert.equal(display.textContent, "1/7", "item reconciliation retains the pending Heavy capacity");
  releaseLevel();
  await levelSave;
  assert.equal(display.textContent, "1/7");
});

const standardItem = (id, name, load = 1) => ({
  _id: id, name, type: "item", system: { load }, flags: {},
});

test("loadout projection lists every standard entry without embedding unchecked items", () => {
  const catalogue = Array.from({ length: 27 }, (_, index) => standardItem(`standard-${index}`, `Item ${index}`));
  const rows = prepareLoadoutCatalogue(catalogue, []);

  assert.equal(rows.length, 27);
  assert.ok(rows.every(row => !row.selected && row.actorItemId === null));
});

test("loadout projection adopts legacy items, uses provenance, and keeps custom actor items", () => {
  const catalogue = [standardItem("rope", "Rope"), standardItem("lamp", "Lamp")];
  const owned = [
    { _id: "actor-rope", name: "Rope", type: "item", system: { load: 1, equipped: true }, flags: {} },
    { _id: "actor-lamp", name: "Renamed lamp", type: "item", system: { load: 4, equipped: false }, flags: { "brinkwood-reforged": { loadoutSourceId: "lamp" } } },
    { _id: "custom", name: "Family keepsake", type: "item", system: { load: 1, equipped: true }, flags: {} },
  ];
  const rows = prepareLoadoutCatalogue(catalogue, owned);

  assert.equal(rows.length, 3);
  assert.deepEqual(rows.find(row => row.sourceId === "rope").actorItemId, "actor-rope");
  assert.equal(rows.find(row => row.sourceId === "rope").selected, true);
  assert.equal(rows.find(row => row.sourceId === "rope").system.load, 1);
  assert.deepEqual(rows.find(row => row.sourceId === "lamp").actorItemId, "actor-lamp");
  assert.equal(rows.find(row => row.sourceId === "lamp").system.load, 4);
  assert.equal(rows.find(row => row.sourceId === "custom").isCustom, true);
});

test("loadout weight includes only equipped items and preserves overload", () => {
  assert.equal(calculateLoadoutWeight([
    { type: "item", system: { equipped: true, load: "3" } },
    { type: "item", system: { equipped: false, load: 9 } },
    { type: "trait", system: { equipped: true, load: 9 } },
  ]), 3);
  assert.equal(calculateLoadoutWeight([{ type: "item", system: { equipped: true, load: 14 } }]), 14);
});

test("loadout checkbox updates an existing item once, preserves it when cleared, and respects permissions", async () => {
  const updates = [];
  const existing = {
    type: "item", id: "actor-rope", flags: { "brinkwood-reforged": { loadoutSourceId: "rope" } },
    update: async (update, options) => updates.push({ update, options }),
  };
  const sheet = {
    isEditable: true,
    actor: { items: [existing] },
    document: { createEmbeddedDocuments: async () => assert.fail("existing source must not be duplicated") },
  };
  await onLoadoutItemToggle(sheet, { currentTarget: { checked: false, dataset: { loadoutSourceId: "rope" } } });
  await onLoadoutItemToggle(sheet, { currentTarget: { checked: true, dataset: { loadoutSourceId: "rope" } } });
  assert.deepEqual(updates, [
    { update: { "system.equipped": false }, options: { render: false } },
    { update: { "system.equipped": true }, options: { render: false } },
  ]);

  sheet.isEditable = false;
  await onLoadoutItemToggle(sheet, { currentTarget: { checked: true, dataset: { loadoutSourceId: "rope" } } });
  assert.equal(updates.length, 2);
});

test("loadout checkbox targets its exact legacy Actor item when names are ambiguous", async () => {
  const updates = [];
  const replacementCheckbox = {
    checked: false,
    dataset: { itemId: "legacy-rope-2", loadoutSourceId: "rope", loadoutItemName: "Rope" },
    classList: { contains: name => name === "loadout-item-select" },
  };
  const replacementRoot = {
    querySelectorAll: selector => selector === "[data-loadout-source-id]" ? [replacementCheckbox] : [],
    querySelector: () => null,
  };
  let sheet;
  const legacy = id => ({
    id,
    type: "item",
    name: "Rope",
    flags: {},
    system: { equipped: false, load: 1 },
    async update(change, options) {
      updates.push({ id, change, options });
      sheet.element = replacementRoot;
      this.flags["brinkwood-reforged"] = { loadoutSourceId: "rope" };
      this.system.equipped = change["system.equipped"];
      return this;
    },
  });
  const first = legacy("legacy-rope-1");
  const second = legacy("legacy-rope-2");
  sheet = {
    isEditable: true,
    actor: { items: [first, second], system: { selected_load_level: "BITD.Light" } },
    element: { querySelectorAll: () => [], querySelector: () => null },
    document: { createEmbeddedDocuments: async () => assert.fail("exact legacy item must not be duplicated") },
  };

  await onLoadoutItemToggle(sheet, {
    currentTarget: {
      checked: true,
      dataset: { itemId: second.id, loadoutSourceId: "rope", loadoutItemName: "Rope" },
    },
  });

  assert.deepEqual(updates, [{
    id: second.id,
    change: { "system.equipped": true, "flags.brinkwood-reforged.loadoutSourceId": "rope" },
    options: { render: false },
  }]);
  assert.equal(first.system.equipped, false);
  assert.equal(second.system.equipped, true);
  assert.equal(replacementCheckbox.checked, true, "saved legacy click projects onto replacement root");
});

test("selecting an unchecked standard item creates one equipped embedded item with provenance", async () => {
  const created = [];
  const createOptions = [];
  const source = standardItem("spyglass", "Spyglass", 2);
  globalThis.game = {
    user: { isGM: true },
    user: { isGM: true },
    items: [],
    packs: [{ metadata: { name: "item" }, getDocuments: async () => [{ toObject: () => source }] }],
  };
  foundry.utils = { deepClone: value => structuredClone(value) };
  const sheet = {
    isEditable: true,
    actor: { items: [] },
    document: { createEmbeddedDocuments: async (_type, data, options) => {
      created.push(...data);
      createOptions.push(options);
    } },
  };

  await onLoadoutItemToggle(sheet, {
    currentTarget: { checked: true, dataset: { loadoutSourceId: "spyglass" } },
  });

  assert.equal(created.length, 1);
  assert.equal(created[0]._id, undefined);
  assert.equal(created[0].system.equipped, true);
  assert.equal(created[0].flags["brinkwood-reforged"].loadoutSourceId, "spyglass");
  assert.deepEqual(createOptions, [{ render: false }]);
});

test("checkbox toggle snapshots currentTarget before catalogue resolution clears the browser event", async () => {
  const created = [];
  const source = standardItem("powder", "Black Powder", 1);
  const event = { currentTarget: { checked: true, dataset: { loadoutSourceId: "powder" } } };
  globalThis.game = {
    items: [],
    packs: [{
      metadata: { name: "item" },
      getDocuments: async () => {
        event.currentTarget = null;
        return [{ toObject: () => source }];
      },
    }],
  };
  foundry.utils = { deepClone: value => structuredClone(value) };
  const sheet = {
    isEditable: true,
    actor: { items: [] },
    document: { createEmbeddedDocuments: async (_type, data) => created.push(...data) },
  };

  await onLoadoutItemToggle(sheet, event);

  assert.equal(created.length, 1);
  assert.equal(created[0].system.equipped, true);
});

test("native checkbox click creates an absent source once before change without replacing the root", async () => {
  class FakeCheckbox {
    constructor() {
      this.checked = false;
      this.dataset = { loadoutSourceId: "spyglass" };
      this.listeners = new Map();
      this.classList = { contains: name => name === "loadout-item-select" };
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    async activate() {
      // Native checkbox pre-activation changes checked before click listeners;
      // change follows click and must not own a second persistence path.
      this.checked = !this.checked;
      const click = this.listeners.get("click")?.({ currentTarget: this });
      this.listeners.get("change")?.({ currentTarget: this });
      await click;
    }
  }

  const checkbox = new FakeCheckbox();
  const root = {
    querySelectorAll(selector) {
      return selector === ".loadout-item-select" || selector === "[data-loadout-source-id]" ? [checkbox] : [];
    },
    querySelector: () => null,
  };
  const items = new Map();
  const source = standardItem("spyglass", "Spyglass", 2);
  let sourceConversions = 0;
  globalThis.game = {
    items: [],
    packs: [{
      metadata: { name: "item" },
      getDocument: async () => ({
        type: "item",
        toObject() {
          sourceConversions++;
          return source;
        },
      }),
    }],
  };
  foundry.utils = { deepClone: value => structuredClone(value) };
  const renderedLoads = [];
  const createOptions = [];
  const sheet = {
    isEditable: true,
    element: root,
    actor: { items },
    document: {
      async createEmbeddedDocuments(_type, data, options) {
        createOptions.push(options);
        const created = { ...data[0], _id: "actor-spyglass" };
        items.set(created._id, created);
        return [created];
      },
    },
    render: async () => renderedLoads.push(calculateLoadoutWeight(Array.from(items.values()))),
  };

  bindLoadoutControls(sheet, root, {});
  assert.equal(checkbox.listeners.has("click"), true);
  assert.equal(checkbox.listeners.has("change"), false);
  await checkbox.activate();

  assert.equal(items.size, 1);
  assert.equal(items.get("actor-spyglass").system.equipped, true);
  assert.equal(calculateLoadoutWeight(Array.from(items.values())), 2);
  assert.deepEqual(renderedLoads, []);
  assert.equal(sheet.element, root);
  assert.equal(checkbox.checked, true);
  assert.equal(checkbox.dataset.itemId, "actor-spyglass");
  assert.equal(sourceConversions, 1, "direct Foundry Item source is converted to plain creation data");
  assert.deepEqual(createOptions, [{ render: false }]);
});

test("loadout open binding does not toggle or create, and respects GM edit permissions", async () => {
  class FakeOpenControl {
    constructor(dataset) {
      this.dataset = dataset;
      this.listeners = new Map();
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    async click() {
      const event = { prevented: false, preventDefault() { this.prevented = true; }, currentTarget: this };
      await this.listeners.get("click")?.(event);
      return event;
    }
  }

  const renders = [];
  const owned = {
    _id: "actor-spyglass",
    type: "item",
    flags: { "brinkwood-reforged": { loadoutSourceId: "spyglass" } },
    sheet: { render: options => renders.push({ item: "owned", options }) },
  };
  const openOwned = new FakeOpenControl({ itemId: "actor-spyglass", loadoutSourceId: "spyglass" });
  const root = {
    querySelectorAll(selector) {
      return selector === ".loadout-item-open" ? [openOwned] : [];
    },
  };
  globalThis.game = { user: { isGM: false }, items: new Map(), packs: [] };
  const sheet = {
    isEditable: false,
    element: root,
    actor: { items: new Map([[owned._id, owned]]) },
    document: { createEmbeddedDocuments: async () => assert.fail("opening must not create an item") },
  };

  bindLoadoutControls(sheet, root, {});
  const event = await openOwned.click();
  assert.equal(event.prevented, true);
  assert.deepEqual(renders, [{ item: "owned", options: { force: true, editable: false } }]);

  const source = {
    _id: "catalogue-lantern",
    type: "item",
    flags: {},
    sheet: { render: options => renders.push({ item: "source", options }) },
  };
  let requestedSourceId;
  game.user.isGM = true;
  game.packs = [{
    metadata: { name: "item" },
    getDocument: async id => {
      requestedSourceId = id;
      return source;
    },
  }];

  await onLoadoutItemOpen(sheet, {
    preventDefault() {},
    currentTarget: { dataset: { loadoutSourceId: "catalogue-lantern" } },
  });
  assert.equal(requestedSourceId, "catalogue-lantern");
  assert.deepEqual(renders.at(-1), { item: "source", options: { force: true, editable: true } });
});

test("loadout load edits update owned items or create an unequipped actor copy only", async () => {
  const updates = [];
  const owned = {
    _id: "actor-rope",
    type: "item",
    flags: { "brinkwood-reforged": { loadoutSourceId: "rope" } },
    update: async data => updates.push(data),
  };
  const created = [];
  const source = standardItem("lantern", "Lantern", 1);
  globalThis.game = {
    user: { isGM: true },
    items: [],
    packs: [{ metadata: { name: "item" }, getDocuments: async () => [{ toObject: () => source }] }],
  };
  foundry.utils = { deepClone: value => structuredClone(value) };
  const sheet = {
    isEditable: true,
    actor: { items: new Map([[owned._id, owned]]) },
    document: { createEmbeddedDocuments: async (_type, data) => created.push(...data) },
    render: async () => {},
  };

  await onLoadoutItemLoadChange(sheet, {
    currentTarget: { value: "4", dataset: { itemId: "actor-rope", loadoutSourceId: "rope" } },
  });
  await onLoadoutItemLoadChange(sheet, {
    currentTarget: { value: "2", dataset: { loadoutSourceId: "lantern" } },
  });

  assert.deepEqual(updates, [{ "system.load": 4 }]);
  assert.equal(created.length, 1);
  assert.equal(created[0].system.load, 2);
  assert.equal(created[0].system.equipped, false);
  assert.equal(created[0].flags["brinkwood-reforged"].loadoutSourceId, "lantern");

  game.user.isGM = false;
  let restored = 0;
  sheet.render = async () => { restored += 1; };
  await onLoadoutItemLoadChange(sheet, {
    currentTarget: { value: "5", dataset: { itemId: "actor-rope", loadoutSourceId: "rope" } },
  });
  assert.equal(updates.length, 1);
  assert.equal(restored, 0);
});

test("Enter commits a load edit through its sole handler and suppresses form submission", async () => {
  globalThis.game = { user: { isGM: true } };
  let commits = 0;
  let renders = 0;
  let blurred = false;
  const owned = {
    id: "actor-rope",
    type: "item",
    name: "Rope",
    flags: { "brinkwood-reforged": { loadoutSourceId: "rope" } },
    system: { load: 1, equipped: false },
    async update(change) {
      commits += 1;
      this.system.load = change["system.load"];
    },
  };
  const sheet = {
    isEditable: true,
    actor: { items: [owned], system: { selected_load_level: "BITD.Light" } },
    document: {},
    element: { querySelectorAll: () => [], querySelector: () => null },
    render: async () => { renders += 1; },
  };
  const event = {
    key: "Enter",
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true; },
    stopPropagation() { this.stopped = true; },
    currentTarget: {
      value: "4",
      dataset: { itemId: "actor-rope", loadoutSourceId: "rope", loadoutItemName: "Rope" },
      blur: () => { blurred = true; },
    },
  };

  await onLoadoutItemLoadKeydown(sheet, event);

  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.equal(commits, 1);
  assert.equal(renders, 0);
  assert.equal(owned.system.load, 4);
  assert.equal(blurred, true);
});

test("queued toggle and GM load edit reconcile one actor copy without duplicates", async () => {
  let releaseSource;
  const sourceReady = new Promise(resolve => { releaseSource = resolve; });
  const items = new Map();
  const source = standardItem("rope", "Rope", 1);
  const actor = { items };
  const created = [];
  const sheet = { isEditable: true, actor, document: {
    async createEmbeddedDocuments(_type, data) {
      const document = { ...data[0], _id: "owned-rope", async update(change) {
        this.system.load = change["system.load"] ?? this.system.load;
        this.system.equipped = change["system.equipped"] ?? this.system.equipped;
      } };
      created.push(document);
      items.set(document._id, document);
    },
  }, render: async () => {} };
  globalThis.game = { user: { isGM: true }, items: [], packs: [{ metadata: { name: "item" }, getDocument: async () => { await sourceReady; return source; } }] };
  foundry.utils = { deepClone: value => structuredClone(value) };

  const toggle = onLoadoutItemToggle(sheet, { currentTarget: { checked: true, dataset: { itemId: "", loadoutSourceId: "rope", loadoutItemName: "Rope" } } });
  const edit = onLoadoutItemLoadChange(sheet, { currentTarget: { value: "4", dataset: { itemId: "", loadoutSourceId: "rope", loadoutItemName: "Rope" } } });
  releaseSource();
  await Promise.all([toggle, edit]);

  assert.equal(created.length, 1);
  assert.equal(created[0].system.equipped, true);
  assert.equal(created[0].system.load, 4);
});

test("queued first-create then uncheck applies the latest state with an empty actor item id", async () => {
  let releaseSource;
  const sourceReady = new Promise(resolve => { releaseSource = resolve; });
  const items = new Map();
  const source = standardItem("rope", "Rope", 1);
  const actor = { items };
  const created = [];
  const sheet = { isEditable: true, actor, document: {
    async createEmbeddedDocuments(_type, data) {
      const document = { ...data[0], _id: "owned-rope", async update(change) {
        this.system.equipped = change["system.equipped"] ?? this.system.equipped;
      } };
      created.push(document);
      items.set(document._id, document);
    },
  }, render: async () => {} };
  globalThis.game = { user: { isGM: true }, items: [], packs: [{
    metadata: { name: "item" },
    getDocument: async () => { await sourceReady; return source; },
  }] };
  foundry.utils = { deepClone: value => structuredClone(value) };

  const select = onLoadoutItemToggle(sheet, { currentTarget: {
    checked: true,
    dataset: { itemId: "", loadoutSourceId: "rope", loadoutItemName: "Rope" },
  } });
  const unselect = onLoadoutItemToggle(sheet, { currentTarget: {
    checked: false,
    dataset: { itemId: "", loadoutSourceId: "rope", loadoutItemName: "Rope" },
  } });
  releaseSource();
  await Promise.all([select, unselect]);

  assert.equal(created.length, 1);
  assert.equal(created[0].system.equipped, false);
});

test("loadout pack entries have concise descriptions", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../packs/items.db", import.meta.url), "utf8");
  const entries = source.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  assert.equal(entries.length, 27);
  for (const entry of entries) {
    const description = entry.system?.description?.trim() ?? "";
    assert.ok(description, `${entry.name} must have a description`);
    assert.ok(description.split(/\s+/).length <= 10, `${entry.name} exceeds 10 words`);
  }
});
