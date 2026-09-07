import assert from "node:assert/strict";
import test from "node:test";

globalThis.foundry = {
  documents: {
    Actor: class {
      constructor(items = []) {
        this.items = items;
        this.documentName = "Actor";
        this.databaseDeletes = [];
        this.nextId = 0;
      }

      async createEmbeddedDocuments(_embeddedName, data) {
        const created = data.map(entry => ({
          ...structuredClone(entry),
          id: `created-${++this.nextId}`,
        }));
        this.items.push(...created);
        return created;
      }

      async deleteEmbeddedDocuments(embeddedName, ids, operation = {}) {
        const removed = this.items.filter(item => ids.includes(item.id ?? item._id));
        this.databaseDeletes.push([embeddedName, ids, operation]);
        this.items = this.items.filter(item => !ids.includes(item.id ?? item._id));
        return removed;
      }

      async _onCreateEmbeddedDocuments() {}
      async _onDeleteEmbeddedDocuments() {}
    },
    Item: class {
      async _preCreate() {}
    },
  },
  abstract: { TypeDataModel: class {} },
  data: { fields: {} },
  utils: {},
};
globalThis.game = {
  packs: new Map(),
  user: { id: "user" },
};

const { BladesActor } = await import("../module/blades-actor.js");
const { BladesItem } = await import("../module/blades-item.js");

function compendiumTrait(id, name, sourceName) {
  return {
    id,
    type: "trait",
    name,
    system: { class: sourceName },
    toObject: () => ({ type: "trait", name, system: { class: sourceName } }),
  };
}

test("replacing an Upbringing removes only its tagged grants and deleting the replacement cannot restore it", async () => {
  const priorSource = { id: "upbringing-x", type: "upbringing", name: "X", system: { logic: "" } };
  const priorGrant = {
    id: "trait-x",
    type: "trait",
    flags: { "brinkwood-reforged": { traitGrant: {
      sourceItemId: priorSource.id,
      sourceItemType: priorSource.type,
      traitSourceId: "source-trait-x",
    } } },
  };
  const manualTrait = { id: "manual", type: "trait", flags: {} };
  game.packs.set("brinkwood-reforged.trait", { getDocuments: async () => [
    compendiumTrait("source-trait-y", "Y Trait", "Y"),
  ] });

  const actor = new BladesActor([priorSource, priorGrant, manualTrait]);
  actor._modActionPoints = async () => {};

  await BladesItem.prototype._preCreate.call(
    { parent: actor },
    { type: "upbringing", name: "Y", system: { logic: "" } },
    {},
    game.user,
  );

  assert.deepEqual(actor.databaseDeletes.map(([, ids]) => ids), [[priorSource.id, priorGrant.id]]);
  assert.deepEqual(actor.items, [manualTrait]);

  const [replacement] = await actor.createEmbeddedDocuments("Item", [
    { type: "upbringing", name: "Y", system: { logic: "" } },
  ]);
  const replacementGrant = actor.items.find(item =>
    item.flags?.["brinkwood-reforged"]?.traitGrant?.sourceItemId === replacement.id);
  assert.deepEqual(replacementGrant.flags["brinkwood-reforged"].traitGrant, {
    sourceItemId: replacement.id,
    sourceItemType: "upbringing",
    traitSourceId: "source-trait-y",
  });

  await actor.deleteEmbeddedDocuments("Item", [replacement.id]);

  assert.deepEqual(actor.databaseDeletes.map(([, ids]) => ids), [
    [priorSource.id, priorGrant.id],
    [replacement.id, replacementGrant.id],
  ]);
  assert.deepEqual(actor.items, [manualTrait]);
});
