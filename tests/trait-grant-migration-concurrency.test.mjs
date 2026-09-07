import assert from "node:assert/strict";
import test from "node:test";

function isNewerVersion(target, current) {
  const left = target.split(".").map(Number);
  const right = current.split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((left[index] ?? 0) !== (right[index] ?? 0)) return (left[index] ?? 0) > (right[index] ?? 0);
  }
  return false;
}

globalThis.foundry = {
  documents: { Actor: class {
    constructor(items = []) {
      this.items = items;
      this.databaseDeletes = [];
    }

    async _onCreateEmbeddedDocuments() {}
    async createEmbeddedDocuments(_type, documents) {
      const created = documents.map((document, index) =>
        document.id ?? document._id ? document : { ...document, id: `embedded-${this.items.length + index}` });
      this.items.push(...created);
      await this._onCreateEmbeddedDocuments?.(_type, created);
      return created;
    }
    async deleteEmbeddedDocuments(type, ids, operation = {}) {
      this.databaseDeletes.push([type, ids, operation]);
      this.items = this.items.filter(item => !ids.includes(item.id ?? item._id));
      return [];
    }
  } },
  abstract: { TypeDataModel: class {} },
  data: { fields: {} },
  utils: { isNewerVersion }
};
globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };
globalThis.game = { packs: new Map() };

const { BladesActor } = await import("../module/blades-actor.js");
const { migrateWorld } = await import("../module/migration.js");

function traitSource(id = "keen-eye", name = "Keen Eye", sourceName = "Apprentice") {
  return {
    id,
    name,
    type: "trait",
    system: { class: sourceName },
    toObject: () => ({
      _id: id,
      name,
      type: "trait",
      system: { class: sourceName }
    })
  };
}

function character(id, reconcile = BladesActor.prototype.reconcileTraitGrants) {
  return {
    id,
    type: "character",
    items: [{ id: `${id}-upbringing`, type: "upbringing", name: "Apprentice" }],
    reconcileTraitGrants: reconcile,
    _addTraits: BladesActor.prototype._addTraits,
    async createEmbeddedDocuments(type, documents) {
      assert.equal(type, "Item");
      this.items.push(...documents.map(document => ({ ...document, id: `embedded-${this.items.length}` })));
    }
  };
}

function installMigrationGame({ actors, version = "0.6.12", userId = "alpha", users = [] }) {
  let migrationVersion = version;
  const writes = [];
  game.version = "13.351";
  game.system = { version: "0.6.13" };
  game.user = { id: userId, isGM: true, active: true };
  game.users = users;
  game.actors = actors;
  game.packs = new Map([["brinkwood-reforged.trait", { getDocuments: async () => [traitSource()] }]]);
  game.settings = {
    get: () => migrationVersion,
    set: async (_scope, _key, nextVersion) => {
      writes.push(nextVersion);
      migrationVersion = nextVersion;
    }
  };
  return { writes, migrationVersion: () => migrationVersion };
}

test("only the deterministically elected GM starts the character trait migration", async () => {
  const actor = character("pc");
  const nonCharacter = {
    type: "npc",
    reconcileTraitGrants: () => assert.fail("only character actors may be reconciled by migration")
  };
  const nonAuthority = installMigrationGame({
    actors: [actor, nonCharacter],
    userId: "zeta",
    users: [
      { id: "zeta", active: true, isGM: true },
      { id: "alpha", active: true, isGM: true }
    ]
  });

  await migrateWorld();

  assert.equal(actor.items.filter(item => item.type === "trait").length, 0);
  assert.deepEqual(nonAuthority.writes, []);

  const gm = installMigrationGame({
    actors: [actor, nonCharacter],
    users: [
      { id: "zeta", active: true, isGM: true },
      { id: "alpha", active: true, isGM: true }
    ]
  });
  await migrateWorld();

  assert.equal(actor.items.filter(item => item.type === "trait").length, 1);
  assert.deepEqual(gm.writes, ["0.6.13"]);
});

test("concurrent reconciliation creates exactly one embedded trait", async () => {
  const actor = character("pc");
  game.packs = new Map([["brinkwood-reforged.trait", { getDocuments: async () => [traitSource()] }]]);

  let createCalls = 0;
  let releaseCreate;
  const creating = new Promise(resolve => { releaseCreate = resolve; });
  let startedCreate;
  const createStarted = new Promise(resolve => { startedCreate = resolve; });
  actor.createEmbeddedDocuments = async (type, documents) => {
    assert.equal(type, "Item");
    createCalls += 1;
    startedCreate();
    await creating;
    actor.items.push(...documents.map(document => ({ ...document, id: `embedded-${createCalls}` })));
  };

  let releaseStart;
  const start = new Promise(resolve => { releaseStart = resolve; });
  const reconcile = async () => {
    await start;
    return BladesActor.prototype.reconcileTraitGrants.call(actor);
  };
  const first = reconcile();
  const second = reconcile();
  releaseStart();

  await createStarted;
  // Let a competing reconciliation reach the same persistence decision while
  // the first embedded-document write is deliberately held open.
  await new Promise(resolve => setImmediate(resolve));
  try {
    assert.equal(createCalls, 1);
  } finally {
    releaseCreate();
  }
  await Promise.all([first, second]);
  assert.equal(actor.items.filter(item => item.type === "trait").length, 1);
});

test("deleting a source waits for its in-flight trait sync and leaves no orphaned grant", async () => {
  const source = { id: "pc-upbringing", type: "upbringing", name: "Apprentice" };
  game.packs = new Map([["brinkwood-reforged.trait", { getDocuments: async () => [traitSource()] }]]);
  const actor = new BladesActor([source]);
  actor._modActionPoints = async () => {};

  const createEmbeddedDocuments = BladesActor.prototype.createEmbeddedDocuments;
  let releaseCreate;
  const creating = new Promise(resolve => { releaseCreate = resolve; });
  let signalCreate;
  const createStarted = new Promise(resolve => { signalCreate = resolve; });
  actor.createEmbeddedDocuments = async (type, documents, operation) => {
    if (documents.some(document => document.type === "trait")) {
      signalCreate();
      await creating;
    }
    return createEmbeddedDocuments.call(actor, type, documents, operation);
  };

  const repair = actor.repairTraitGrantsForSourceIds([source.id]);
  await createStarted;
  const removal = actor.deleteEmbeddedDocuments("Item", [source.id]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(actor.items.some(item => item.id === source.id), true);

  releaseCreate();
  await Promise.all([repair, removal]);
  assert.equal(actor.items.some(item => item.id === source.id), false);
  assert.equal(actor.items.some(item =>
    item.flags?.["brinkwood-reforged"]?.traitGrant?.sourceItemId === source.id), false);
});

test("a repair queued behind an in-flight source deletion does not create an orphaned grant", async () => {
  const source = { id: "pc-upbringing", type: "upbringing", name: "Apprentice" };
  game.packs = new Map([["brinkwood-reforged.trait", { getDocuments: async () => [traitSource()] }]]);
  const actor = new BladesActor([source]);
  actor._modActionPoints = async () => {};

  const deleteEmbeddedDocuments = foundry.documents.Actor.prototype.deleteEmbeddedDocuments;
  let releaseDelete;
  const deleting = new Promise(resolve => { releaseDelete = resolve; });
  let signalDelete;
  const deleteStarted = new Promise(resolve => { signalDelete = resolve; });
  foundry.documents.Actor.prototype.deleteEmbeddedDocuments = async function(...args) {
    signalDelete();
    await deleting;
    return deleteEmbeddedDocuments.call(this, ...args);
  };

  try {
    const removal = actor.deleteEmbeddedDocuments("Item", [source.id]);
    await deleteStarted;
    const repair = actor.repairTraitGrantsForSourceIds([source.id]);
    await new Promise(resolve => setImmediate(resolve));

    releaseDelete();
    await Promise.all([removal, repair]);
    assert.equal(actor.items.some(item => item.id === source.id), false);
    assert.equal(actor.items.some(item =>
      item.flags?.["brinkwood-reforged"]?.traitGrant?.sourceItemId === source.id), false);
  } finally {
    releaseDelete();
    foundry.documents.Actor.prototype.deleteEmbeddedDocuments = deleteEmbeddedDocuments;
  }
});

test("concurrent action-point hooks apply both source bonuses", async () => {
  const originalUtils = foundry.utils;
  foundry.utils = {
    ...originalUtils,
    getProperty(object, path) {
      return path.split(".").reduce((value, key) => value?.[key], object);
    },
    setProperty(object, path, value) {
      const keys = path.split(".");
      const lastKey = keys.pop();
      const target = keys.reduce((current, key) => current[key] ??= {}, object);
      target[lastKey] = value;
    },
  };

  const actor = {
    system: { attributes: { insight: { value: 0 } } },
    _modActionPoints: BladesActor.prototype._modActionPoints,
  };
  let updateCalls = 0;
  let releaseUpdate;
  const updating = new Promise(resolve => { releaseUpdate = resolve; });
  let signalUpdate;
  const updateStarted = new Promise(resolve => { signalUpdate = resolve; });
  actor.update = async update => {
    updateCalls += 1;
    signalUpdate();
    await updating;
    actor.system.attributes.insight.value = update.system.attributes.insight.value;
  };
  const source = { type: "class", system: { logic: "system.attributes.insight.value=1" } };

  try {
    const first = actor._modActionPoints(source);
    const second = actor._modActionPoints(source);
    await updateStarted;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(updateCalls, 1);

    releaseUpdate();
    await Promise.all([first, second]);
    assert.equal(actor.system.attributes.insight.value, 2);
  } finally {
    foundry.utils = originalUtils;
  }
});

test("creating an upbringing through the public actor command immediately grants its trait", async () => {
  const source = { id: "pc-upbringing", type: "upbringing", name: "Apprentice" };
  game.packs = new Map([["brinkwood-reforged.trait", { getDocuments: async () => [traitSource()] }]]);
  const actor = {
    items: [],
    createEmbeddedDocuments: BladesActor.prototype.createEmbeddedDocuments,
    syncTraitGrantsForSources: BladesActor.prototype.syncTraitGrantsForSources,
    _addTraits: BladesActor.prototype._addTraits,
  };

  await actor.createEmbeddedDocuments("Item", [source]);

  const granted = actor.items.find(item => item.type === "trait");
  assert.deepEqual(granted.flags["brinkwood-reforged"].traitGrant, {
    sourceItemId: "pc-upbringing",
    sourceItemType: "upbringing",
    traitSourceId: "keen-eye"
  });
});

test("creating and repeatedly syncing a mask grants its mapped trait exactly once", async () => {
  const mask = { id: "mask-fox", type: "mask", name: "The Fox" };
  game.packs = new Map([["brinkwood-reforged.trait", {
    getDocuments: async () => [traitSource("trait-fox", "Foxfire", "The Fox")]
  }]]);
  const actor = new BladesActor([]);
  actor._modActionPoints = async () => {};

  await actor.createEmbeddedDocuments("Item", [mask]);
  await Promise.all([
    actor.syncTraitGrantsForSources([mask]),
    actor.syncTraitGrantsForSources([mask])
  ]);

  const grants = actor.items.filter(item =>
    item.flags?.["brinkwood-reforged"]?.traitGrant?.sourceItemId === mask.id);
  assert.equal(grants.length, 1);
  assert.deepEqual(grants[0].flags["brinkwood-reforged"].traitGrant, {
    sourceItemId: "mask-fox",
    sourceItemType: "mask",
    traitSourceId: "trait-fox"
  });
});

test("deleting a mask removes only its tagged grant", async () => {
  const mask = { id: "mask-fox", type: "mask", name: "The Fox" };
  game.packs = new Map([["brinkwood-reforged.trait", {
    getDocuments: async () => [traitSource("trait-fox", "Foxfire", "The Fox")]
  }]]);
  const actor = new BladesActor([
    { id: "manual", type: "trait", name: "Foxfire", flags: {} },
    { id: "other-grant", type: "trait", flags: { "brinkwood-reforged": { traitGrant: {
      sourceItemId: "upbringing-other", sourceItemType: "upbringing", traitSourceId: "trait-fox"
    } } } }
  ]);
  actor._modActionPoints = async () => {};

  await actor.createEmbeddedDocuments("Item", [mask]);
  await actor.deleteEmbeddedDocuments("Item", [mask.id]);

  assert.deepEqual(actor.items.map(item => item.id), ["manual", "other-grant"]);
  assert.equal(actor.databaseDeletes.length, 1);
  assert.equal(actor.databaseDeletes[0][1].length, 2);
});

test("Class and Pact source creation never grants traits", async () => {
  game.packs = new Map([["brinkwood-reforged.trait", {
    getDocuments: async () => [
      traitSource("class-trait", "Class Trait", "Rebel"),
      traitSource("pact-trait", "Pact Trait", "Ancient Pact")
    ]
  }]]);
  const actor = new BladesActor([]);
  actor._modActionPoints = async () => {};

  await actor.createEmbeddedDocuments("Item", [
    { id: "class-rebel", type: "class", name: "Rebel" },
    { id: "pact-ancient", type: "pact", name: "Ancient Pact" }
  ]);

  assert.equal(actor.items.filter(item => item.type === "trait").length, 0);
});

test("a trait-sync failure preserves the created source for one idempotent repair", async () => {
  const source = { id: "upbringing-apprentice", type: "upbringing", name: "Apprentice" };
  let actionPointUpdates = 0;
  let failSync = true;
  game.packs = new Map([["brinkwood-reforged.trait", {
    getDocuments: async () => {
      if (failSync) throw new Error("trait compendium unavailable");
      return [traitSource()];
    }
  }]]);
  const actor = new BladesActor([]);
  actor._modActionPoints = async () => { actionPointUpdates += 1; };

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    await actor.createEmbeddedDocuments("Item", [source]);
  } finally {
    console.error = originalConsoleError;
  }
  assert.deepEqual(actor.items.map(item => item.id), [source.id]);
  assert.equal(actionPointUpdates, 0);

  failSync = false;
  await actor.syncTraitGrantsForSources([source]);

  assert.deepEqual(actor.items.filter(item => item.type === "upbringing").map(item => item.id), [source.id]);
  assert.equal(actionPointUpdates, 0);
  assert.equal(actor.items.filter(item => item.type === "trait").length, 1);
});

test("a failed character migration leaves its version unchanged and retries without duplicate traits", async () => {
  const migratedActor = character("first");
  let failOnce = true;
  const failingActor = character("second", async function() {
    if (failOnce) {
      failOnce = false;
      throw new Error("simulated reconciliation failure");
    }
    return BladesActor.prototype.reconcileTraitGrants.call(this);
  });
  const migration = installMigrationGame({ actors: [migratedActor, failingActor] });

  await assert.rejects(migrateWorld(), /simulated reconciliation failure/);
  assert.equal(migration.migrationVersion(), "0.6.12");
  assert.deepEqual(migration.writes, []);
  assert.equal(migratedActor.items.filter(item => item.type === "trait").length, 1);

  await migrateWorld();

  assert.equal(migration.migrationVersion(), "0.6.13");
  assert.deepEqual(migration.writes, ["0.6.13"]);
  assert.equal(migratedActor.items.filter(item => item.type === "trait").length, 1);
  assert.equal(failingActor.items.filter(item => item.type === "trait").length, 1);
});

test("a missing trait-reconciliation command blocks the version write and retries once restored", async () => {
  const actor = character("missing-command");
  delete actor.reconcileTraitGrants;
  const migration = installMigrationGame({ actors: [actor] });

  await assert.rejects(migrateWorld(), /missing-command.*reconcileTraitGrants/);
  assert.equal(migration.migrationVersion(), "0.6.12");
  assert.deepEqual(migration.writes, []);
  assert.equal(actor.items.filter(item => item.type === "trait").length, 0);

  actor.reconcileTraitGrants = BladesActor.prototype.reconcileTraitGrants;
  await migrateWorld();

  assert.equal(migration.migrationVersion(), "0.6.13");
  assert.deepEqual(migration.writes, ["0.6.13"]);
  assert.equal(actor.items.filter(item => item.type === "trait").length, 1);
});

test("0.7.1 migrates legacy Rebellion Tyranny once and retry is safe", async () => {
  const rebelion = { type: "rebelion", system: { tyranny: { value: -2, max: 1 } }, updates: [], async update(update) { this.updates.push(update); this.system.tyranny = update["system.tyranny"]; } };
  let version = "0.7.0";
  game.system = { version: "0.7.1" };
  game.user = { id: "gm", isGM: true, active: true };
  game.users = [];
  game.actors = [rebelion];
  game.settings = { get: () => version, set: async (_scope, _key, next) => { version = next; } };
  await migrateWorld();
  assert.deepEqual(rebelion.system.tyranny, { value: 0, max: 4 });
  assert.equal(version, "0.7.1");
  await migrateWorld();
  assert.equal(rebelion.updates.length, 1);
});
