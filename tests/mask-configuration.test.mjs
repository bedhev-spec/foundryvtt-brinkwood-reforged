import assert from "node:assert/strict";
import test from "node:test";

globalThis.foundry = {
  documents: {
    Actor: class {
      constructor(items = []) {
        this.items = items;
        this.id = "actor-mask-test";
        this._nextEmbeddedId = 0;
      }

      async createEmbeddedDocuments(name, data, operation = {}) {
        const created = data.map(entry => ({
          ...structuredClone(entry),
          id: `mask-new-${++this._nextEmbeddedId}`,
        }));
        this.items.push(...created);
        await this._onCreateEmbeddedDocuments(name, created, operation);
        return created;
      }

      async deleteEmbeddedDocuments(_embeddedName, ids) {
        const sourceKeys = new Set(this.items
          .filter(item => ids.includes(item.id ?? item._id) && item.type === "mask")
          .map(item => `mask:${item.id ?? item._id}`));
        this.items = this.items.filter(item => {
          if (ids.includes(item.id ?? item._id)) return false;
          const grant = item.flags?.["brinkwood-reforged"]?.traitGrant;
          return !sourceKeys.has(`${grant?.sourceItemType}:${grant?.sourceItemId}`);
        });
      }

      async _onCreateEmbeddedDocuments() {}
      async _onDeleteEmbeddedDocuments() {}
      async update(changes) {
        for (const [path, value] of Object.entries(changes)) {
          foundry.utils.setProperty(this, path, value);
        }
      }
    },
  },
  abstract: { TypeDataModel: class {} },
  data: { fields: {} },
  utils: {
    deepClone: value => structuredClone(value),
    getProperty: (object, path) => path.split(".").reduce((value, key) => value?.[key], object),
    setProperty(object, path, value) {
      const keys = path.split(".");
      const last = keys.pop();
      let target = object;
      for (const key of keys) target = target[key] ??= {};
      target[last] = value;
    },
  },
};
globalThis.game = { packs: new Map() };

const { BladesActor } = await import("../module/blades-actor.js");

const grantFor = (id, sourceId, name) => ({
  id,
  type: "trait",
  name,
  flags: { "brinkwood-reforged": { traitGrant: {
    sourceItemId: sourceId,
    sourceItemType: "mask",
    traitSourceId: `source-${id}`,
  } } },
});

function configuredActor({ failRepair = false } = {}) {
  const oldMask = { id: "mask-old", type: "mask", name: "Judgement", system: { logic: "" } };
  const oldGrant = grantFor("trait-old", oldMask.id, "Old automatic trait");
  const manualTrait = { id: "trait-manual", type: "trait", name: "Custom", flags: {} };
  const actor = new BladesActor([oldMask, oldGrant, manualTrait]);
  actor.system = { experience: { value: 6 }, essence: { value: 3 } };
  actor._modActionPoints = async () => {};
  let syncCount = 0;
  actor.syncTraitGrantsForSources = async sources => {
    syncCount += 1;
    if (failRepair) throw new Error("grant repair failed");
    for (const source of sources) {
      if (actor.items.some(item => item.flags?.["brinkwood-reforged"]?.traitGrant?.sourceItemId === source.id)) continue;
      actor.items.push(grantFor(`trait-new-${source.id.split("-").at(-1)}`, source.id, "New automatic trait"));
    }
  };
  return { actor, oldMask, oldGrant, manualTrait, getSyncCount: () => syncCount };
}

test("Mask configuration replaces its source and tagged grant but preserves persistent state and manual traits", async () => {
  const { actor, manualTrait, getSyncCount } = configuredActor();

  await BladesActor.prototype.configureMask.call(actor, {
    type: "mask",
    name: "Violence",
    system: { logic: "" },
  });

  assert.deepEqual(actor.items.filter(item => item.type === "mask").map(item => item.name), ["Violence"]);
  assert.deepEqual(actor.items.filter(item => item.flags?.["brinkwood-reforged"]?.traitGrant).map(item => item.id), ["trait-new-1"]);
  assert.equal(actor.items.includes(manualTrait), true);
  assert.deepEqual(actor.system, { experience: { value: 6 }, essence: { value: 3 } });
  assert.equal(getSyncCount(), 1);
});

test("Mask configuration hydrates its Trait catalogue once", async () => {
  let loads = 0;
  game.packs.clear();
  game.packs.set("brinkwood-reforged.trait", {
    async getDocuments() {
      loads += 1;
      return [];
    },
  });
  const actor = new BladesActor([
    { id: "mask-old", type: "mask", name: "Terror", system: { logic: "" } },
  ]);
  actor.system = {};
  actor._modActionPoints = async () => {};

  await actor.configureMask({ type: "mask", name: "Violence", system: { logic: "" } });

  assert.equal(loads, 1);
  assert.deepEqual(actor.items.filter(item => item.type === "mask").map(item => item.name), ["Violence"]);
});

test("committed obsolete Mask deletion preserves replacement when action-point follow-up fails", async () => {
  const { actor } = configuredActor();
  actor.system.attributes = { insight: { skills: { study: { value: 2 } } } };
  actor.items.find(item => item.id === "mask-old").system.logic =
    "system.attributes.insight.skills.study.value=1";
  actor._modActionPoints = async (_source, remove) => {
    if (remove) throw new Error("action point update failed after delete");
  };
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = () => {};
  console.warn = () => {};
  try {
    await actor.configureMask({
      type: "mask",
      name: "Violence",
      system: { logic: "system.attributes.insight.skills.study.value=1" },
    });
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }

  const masks = actor.items.filter(item => item.type === "mask");
  assert.deepEqual(masks.map(item => item.name), ["Violence"]);
  assert.equal(actor.items.some(item => item.id === "mask-old"), false);
  assert.equal(actor.items.some(item => item.flags?.["brinkwood-reforged"]?.traitGrant?.sourceItemId === masks[0].id), true);
  assert.equal(actor.system.attributes.insight.skills.study.value, 2);
});

test("Mask configuration does not mutate Character action dots", async () => {
  const { actor } = configuredActor();
  const path = "system.attributes.insight.skills.study.value";
  actor.system.attributes = { insight: { skills: { study: { value: 2 } } } };
  actor.items.find(item => item.id === "mask-old").system.logic = `${path}=1`;
  const classSource = { id: "class-concurrent", type: "class", system: { logic: `${path}=1` } };
  let concurrentUpdate = Promise.resolve();

  actor._modActionPoints = async (source, remove = false) => {
    if (remove && source.id === "mask-old") {
      actor.items.push(classSource);
      concurrentUpdate = BladesActor.prototype._modActionPoints.call(actor, classSource);
      throw new Error("action point update failed after delete");
    }
    return BladesActor.prototype._modActionPoints.call(actor, source, remove);
  };

  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = () => {};
  console.warn = () => {};
  try {
    await actor.configureMask({
      type: "mask",
      name: "Violence",
      system: { logic: `${path}=1` },
    });
    await concurrentUpdate;
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }

  assert.deepEqual(actor.items.filter(item => item.type === "mask").map(item => item.name), ["Violence"]);
  assert.equal(foundry.utils.getProperty(actor, path), 2);
});

test("Mask configuration ignores legacy Mask action logic in every path", async () => {
  const { actor } = configuredActor();
  const path = "system.attributes.insight.skills.study.value";
  foundry.utils.setProperty(actor, path, 2);
  actor.items.find(item => item.type === "mask").system.logic = `${path}=1`;
  let actionPointCalls = 0;
  actor._modActionPoints = async () => { actionPointCalls += 1; };

  await BladesActor.prototype.configureMask.call(actor, {
    type: "mask",
    name: "Violence",
    system: { logic: `${path}=3` },
  });

  assert.equal(foundry.utils.getProperty(actor, path), 2);
  assert.equal(actionPointCalls, 0);
});

test("Mask configuration rolls back the new source when its trait grant cannot be established", async () => {
  const { actor, oldMask, oldGrant, manualTrait } = configuredActor({ failRepair: true });

  await assert.rejects(
    BladesActor.prototype.configureMask.call(actor, { type: "mask", name: "Violence", system: {} }),
    /grant repair failed/,
  );

  assert.deepEqual(actor.items, [oldMask, oldGrant, manualTrait]);
});

test("Mask configuration rejects non-Mask picker data", async () => {
  const { actor } = configuredActor();
  await assert.rejects(
    BladesActor.prototype.configureMask.call(actor, { type: "trait", name: "Nope" }),
    /requires an Item of type 'mask'/,
  );
});

test("concurrent Mask configuration requests serialize to one final source", async () => {
  const { actor, manualTrait } = configuredActor();

  await Promise.all([
    BladesActor.prototype.configureMask.call(actor, { type: "mask", name: "Terror", system: {} }),
    BladesActor.prototype.configureMask.call(actor, { type: "mask", name: "Violence", system: {} }),
  ]);

  assert.deepEqual(actor.items.filter(item => item.type === "mask").map(item => item.name), ["Violence"]);
  assert.deepEqual(actor.items.filter(item => item.flags?.["brinkwood-reforged"]?.traitGrant).map(item => item.id), ["trait-new-2"]);
  assert.equal(actor.items.includes(manualTrait), true);
});

test("Judgement configuration grants canonical traits and preserves a legacy-spelling world trait", async () => {
  const oldMask = { id: "mask-old", type: "mask", name: "Violence", system: {} };
  const oldGrant = grantFor("trait-old", oldMask.id, "Old automatic trait");
  const manualTrait = {
    id: "trait-manual",
    type: "trait",
    name: "Pronounce Sentence",
    system: { class: "Judgment" },
    flags: {},
  };
  const judgmentTrait = {
    id: "trait-judgment",
    type: "trait",
    name: "Pronounce Sentence",
    system: { class: "Judgement", description: "A Mask judgement trait." },
    toObject() {
      return {
        type: this.type,
        name: this.name,
        system: structuredClone(this.system),
        flags: {},
      };
    },
  };
  game.packs.clear();
  game.packs.set("brinkwood-reforged.trait", { getDocuments: async () => [judgmentTrait] });

  const actor = new BladesActor([oldMask, oldGrant, manualTrait]);
  actor.system = { experience: { value: 6 }, essence: { value: 3 } };
  actor._modActionPoints = async () => {};
  let nextId = 0;
  actor.createEmbeddedDocuments = async (_type, data) => {
    const created = data.map(entry => ({ ...structuredClone(entry), id: `created-${++nextId}` }));
    actor.items.push(...created);
    for (const source of created.filter(entry => entry.type === "mask")) {
      await BladesActor.prototype._addTraits.call(actor, source);
    }
    return created;
  };

  await BladesActor.prototype.configureMask.call(actor, {
    type: "mask",
    name: "Judgement",
    system: {},
  });

  assert.deepEqual(actor.items.filter(item => item.type === "mask").map(item => item.name), ["Judgement"]);
  assert.equal(actor.items.includes(oldGrant), false);
  assert.equal(actor.items.includes(manualTrait), true);
  assert.equal(manualTrait.flags["brinkwood-reforged"]?.traitGrant, undefined);
  const automaticTraits = actor.items.filter(item => item.flags?.["brinkwood-reforged"]?.traitGrant);
  assert.equal(automaticTraits.length, 1);
  assert.equal(automaticTraits[0].name, "Pronounce Sentence");
  assert.deepEqual(automaticTraits[0].flags["brinkwood-reforged"].traitGrant, {
    sourceItemId: "created-1",
    sourceItemType: "mask",
    traitSourceId: "trait-judgment",
  });
  assert.deepEqual(actor.system, { experience: { value: 6 }, essence: { value: 3 } });
});
