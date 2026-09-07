import assert from "node:assert/strict";
import test from "node:test";

globalThis.foundry = {
  applications: {
    api: { HandlebarsApplicationMixin: Base => Base },
    sheets: { ActorSheetV2: class { async _onRender() {} async _onClose() {} } },
  },
  utils: {
    deepClone: value => structuredClone(value),
    getProperty: (object, path) => path.split(".").reduce((value, key) => value?.[key], object),
  },
};
globalThis.game = { user: { isGM: true }, items: new Map(), packs: new Map() };
globalThis.ui = { notifications: { error() {}, info() {} } };

const { BladesRebelionSheet } = await import("../module/blades-rebelion-sheet.js");

const aspectData = () => ["Organization", "Force", "Influence"].map(name => ({
  name,
  rank: 0,
  progress: [0, 0, 0],
  max_progress: [4, 6, 8],
  decisions: [],
}));

function setPath(target, path, value) {
  const keys = path.split(".");
  let cursor = target;
  for (const key of keys.slice(0, -1)) cursor = cursor[key] ??= {};
  cursor[keys.at(-1)] = structuredClone(value);
}

function documentFixture({ fail = false } = {}) {
  const updates = [];
  const document = {
    system: {
      aspects: aspectData(),
      heat: { value: 0, max: 10 },
      tyranny: { value: 0, max: 4 },
      resupply: { value: 0, max: 4 },
      towns: [{ name: "Harrowgate", sedition: { clock: { value: 0, max: 8 }, level: 0 } }],
      villages: [{ name: "Ashwick", sedition: { clock: { value: 0, max: 6 }, level: 0 } }],
      lands: [{ name: "Old Fen", sedition: { clock: { value: 0, max: 6 }, level: 0 } }],
      conclave: [],
    },
    async update(update) {
      updates.push(structuredClone(update));
      if (fail) throw new Error("save failed");
      for (const [path, value] of Object.entries(update)) setPath(this, path, value);
    },
  };
  return { document, updates };
}

function sheetFixture(options) {
  const fixture = documentFixture(options);
  const sheet = Object.assign(Object.create(BladesRebelionSheet.prototype), {
    isEditable: true,
    document: fixture.document,
  });
  return { ...fixture, sheet };
}

function click(sheet, path, value) {
  return BladesRebelionSheet.prototype._onTrackerClick.call(sheet, {
    preventDefault() {},
    currentTarget: { dataset: { path, value: String(value) } },
  });
}

test("Heat teeth gain by delta and a repeated full tooth raises Tyranny then clears Heat", async () => {
  const { document, updates, sheet } = sheetFixture();
  document.system.heat.value = 8;
  document.system.tyranny.value = 2;

  assert.equal(await click(sheet, "system.heat.value", 10), true);
  assert.equal(document.system.heat.value, 10);
  assert.equal(document.system.tyranny.value, 2);
  assert.equal(updates.length, 1);

  assert.equal(await click(sheet, "system.heat.value", 10), true);
  assert.equal(document.system.heat.value, 0);
  assert.equal(document.system.tyranny.value, 3);
  assert.equal(updates.length, 2);
  assert.deepEqual(updates[1], {
    "system.heat": { value: 0, max: 10 },
    "system.tyranny": { value: 3, max: 4 },
  });
});

test("Aspect and Sedition completion advance once with no rollover", async () => {
  const { document, updates, sheet } = sheetFixture();
  document.system.aspects[0].progress[0] = 3;
  document.system.villages[0].sedition.clock.value = 5;
  document.system.villages[0].sedition.level = 1;

  assert.equal(await click(sheet, "rebellion.aspect.Organization", 4), true);
  assert.equal(document.system.aspects[0].rank, 1);
  assert.deepEqual(document.system.aspects[0].progress, [4, 0, 0]);

  assert.equal(await click(sheet, "rebellion.location.villages.0.clock", 6), true);
  assert.equal(document.system.villages[0].sedition.level, 2);
  assert.equal(document.system.villages[0].sedition.clock.value, 0);
  assert.equal(updates.length, 2);
  assert.ok(updates.every(update => Object.keys(update).length === 1));
});

test("Resupply gains cap at its derived maximum", async () => {
  const { document, updates, sheet } = sheetFixture();
  document.system.resupply.value = 2;

  assert.equal(await click(sheet, "system.resupply.value", 9), true);
  assert.deepEqual(document.system.resupply, { value: 4, max: 4 });
  assert.equal(updates.length, 1);
});

test("lower teeth and a repeated first tooth explicitly correct owned tracks", async () => {
  const { document, updates, sheet } = sheetFixture();
  document.system.heat.value = 6;
  document.system.resupply.value = 1;
  document.system.aspects[0].progress[0] = 3;
  document.system.towns[0].sedition.clock.value = 4;

  await click(sheet, "system.heat.value", 2);
  await click(sheet, "system.resupply.value", 1);
  await click(sheet, "rebellion.aspect.Organization", 1);
  await click(sheet, "rebellion.location.towns.0.clock", 2);

  assert.equal(document.system.heat.value, 2);
  assert.equal(document.system.resupply.value, 0);
  assert.equal(document.system.aspects[0].progress[0], 1);
  assert.equal(document.system.towns[0].sedition.clock.value, 2);
  assert.equal(updates.length, 4);

  assert.equal(await click(sheet, "rebellion.aspect.Organization", 1), true);
  assert.equal(document.system.aspects[0].progress[0], 0);
});

test("Tyranny correction and ordinary territory level progression remain available", async () => {
  const { document, updates, sheet } = sheetFixture();
  document.system.tyranny.value = 1;
  document.system.towns[0].sedition.level = 1;
  document.system.towns[0].sedition.clock.value = 7;

  await click(sheet, "system.tyranny.value", 3);
  await click(sheet, "rebellion.location.towns.0.level", 2);

  assert.equal(document.system.tyranny.value, 3);
  assert.equal(document.system.towns[0].sedition.level, 2);
  assert.equal(document.system.towns[0].sedition.clock.value, 7);
  assert.equal(updates.length, 2);
});

test("non-GMs cannot reduce Territory Level through the tracker", async () => {
  const { document, updates, sheet } = sheetFixture();
  document.system.towns[0].sedition.level = 2;
  const previousIsGM = game.user.isGM;
  game.user.isGM = false;

  try {
    assert.equal(await click(sheet, "rebellion.location.towns.0.level", 1), false);
    assert.equal(document.system.towns[0].sedition.level, 2);
    assert.equal(updates.length, 0);
  } finally {
    game.user.isGM = previousIsGM;
  }
});

test("rapid tracker clicks serialize and perform one Actor update per click", async () => {
  const { document, updates, sheet } = sheetFixture();

  await Promise.all([
    click(sheet, "system.heat.value", 3),
    click(sheet, "system.heat.value", 5),
  ]);

  assert.equal(document.system.heat.value, 5);
  assert.equal(updates.length, 2);
  assert.ok(updates.every(update => Object.keys(update).every(path => !path.startsWith("system.system."))));
});

test("tracker clicks reject locked sheets and report failed saves", async () => {
  const lockedFixture = sheetFixture();
  lockedFixture.sheet.isEditable = false;
  assert.equal(await click(lockedFixture.sheet, "system.heat.value", 2), false);
  assert.equal(lockedFixture.updates.length, 0);

  const failingFixture = sheetFixture({ fail: true });
  let errors = 0;
  globalThis.ui = { notifications: { error: () => { errors += 1; }, info() {} } };
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(await click(failingFixture.sheet, "system.heat.value", 2), false);
  } finally {
    console.error = originalError;
  }
  assert.equal(failingFixture.updates.length, 1);
  assert.ok(errors >= 1);
});
