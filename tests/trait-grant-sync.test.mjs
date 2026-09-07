import assert from "node:assert/strict";
import test from "node:test";

globalThis.foundry = {
  documents: { Actor: class {
    constructor(items = []) {
      this.items = items;
      this.databaseDeletes = [];
    }

    async deleteEmbeddedDocuments(embeddedName, ids, operation = {}) {
      const removed = this.items.filter(item => ids.includes(item.id ?? item._id));
      this.databaseDeletes.push([embeddedName, ids, operation]);
      this.items = this.items.filter(item => !ids.includes(item.id ?? item._id));
      // Foundry invokes lifecycle callbacks during the database operation, but
      // their asynchronous follow-up work is not the sheet's deletion promise.
      this._onDeleteEmbeddedDocuments(embeddedName, removed, ids, operation, "gm-user");
      return removed;
    }

    async _onCreateEmbeddedDocuments() {}
    async _onDeleteEmbeddedDocuments() {}
  } },
  abstract: { TypeDataModel: class {} },
  data: { fields: {} }
};
globalThis.game = { packs: new Map() };

const { BladesActor } = await import("../module/blades-actor.js");
const { canonicalTraitSourceName } = await import("../module/trait-grant-matching.js");

test("trait source canonicalization accepts canonical and legacy US spellings", () => {
  assert.equal(canonicalTraitSourceName("Judgement"), "judgement");
  assert.equal(canonicalTraitSourceName("Judgment"), "judgement");
  assert.equal(canonicalTraitSourceName(" Terror "), "terror");
});

function compendiumTrait(id, name, sourceName) {
  return {
    id,
    name,
    type: "trait",
    system: { class: sourceName },
    toObject: () => ({ _id: id, name, type: "trait", system: { class: sourceName } })
  };
}

test("upbringing/profession traits are found without an indexed compendium query and tagged to their source", async () => {
  const apprenticeTrait = compendiumTrait("trait-apprentice", "Keen Eye", "Apprentice");
  const otherTrait = compendiumTrait("trait-other", "Other", "Other");
  game.packs.set("brinkwood-reforged.trait", { getDocuments: async () => [apprenticeTrait, otherTrait] });
  const creates = [];
  const actor = {
    items: [],
    createEmbeddedDocuments: async (type, data) => creates.push({ type, data })
  };

  await BladesActor.prototype._addTraits.call(actor, { id: "upbringing-1", type: "upbringing", name: "Apprentice" });

  assert.equal(creates.length, 1);
  assert.equal(creates[0].type, "Item");
  assert.deepEqual(creates[0].data[0].flags["brinkwood-reforged"].traitGrant, {
    sourceItemId: "upbringing-1",
    sourceItemType: "upbringing",
    traitSourceId: "trait-apprentice"
  });
  assert.equal(creates[0].data[0]._id, undefined);
});

test("new grants are idempotent and do not adopt an existing manual trait", async () => {
  const trait = compendiumTrait("trait-apprentice", "Keen Eye", "Apprentice");
  game.packs.set("brinkwood-reforged.trait", { getDocuments: async () => [trait] });
  const creates = [];
  const actor = {
    items: [
      { id: "granted", type: "trait", flags: { "brinkwood-reforged": { traitGrant: { sourceItemId: "upbringing-1", sourceItemType: "upbringing", traitSourceId: "trait-apprentice" } } } },
      { id: "manual", type: "trait", system: { class: "Apprentice" }, flags: {} },
      { id: "profession-grant", type: "trait", flags: { "brinkwood-reforged": { traitGrant: { sourceItemId: "profession-1", sourceItemType: "profession", traitSourceId: "trait-apprentice" } } } }
    ],
    createEmbeddedDocuments: async (...args) => creates.push(args)
  };
  const source = { id: "upbringing-1", type: "upbringing", name: "Apprentice" };

  await BladesActor.prototype._addTraits.call(actor, source);

  assert.equal(creates.length, 0);
});

test("reconciliation adopts provenance-tagged legacy grants and public deletion removes them in one batch", async () => {
  const upbringing = { id: "upbringing-1", type: "upbringing", name: "Apprentice", system: { logic: "" } };
  const compendiumTrait = {
    id: "trait-apprentice",
    type: "trait",
    name: "Keen Eye",
    system: { class: "Apprentice" }
  };
  game.packs.set("brinkwood-reforged.trait", { getDocuments: async () => [compendiumTrait] });
  const actor = new BladesActor([
    upbringing,
    { id: "legacy", name: "Keen Eye", type: "trait", flags: { core: {
      sourceId: "Compendium.brinkwood-reforged.trait.trait-apprentice"
    } } },
    { id: "manual", name: "Keen Eye", type: "trait", system: { class: "Apprentice" }, flags: {} },
    { id: "other-grant", type: "trait", flags: { "brinkwood-reforged": { traitGrant: {
      sourceItemId: "profession-1",
      sourceItemType: "profession",
      traitSourceId: "trait-apprentice"
    } } } }
  ]);
  actor._modActionPoints = async () => {};
  actor.updateEmbeddedDocuments = async (embeddedName, updates) => {
    assert.equal(embeddedName, "Item");
    for (const update of updates) {
      const item = actor.items.find(entry => entry.id === update._id);
      item.flags["brinkwood-reforged"] ??= {};
      item.flags["brinkwood-reforged"].traitGrant = update["flags.brinkwood-reforged.traitGrant"];
    }
  };
  actor.createEmbeddedDocuments = assert.fail;

  await actor.reconcileTraitGrants();
  assert.deepEqual(actor.items.find(item => item.id === "legacy").flags["brinkwood-reforged"].traitGrant, {
    sourceItemId: upbringing.id,
    sourceItemType: upbringing.type,
    traitSourceId: "trait-apprentice"
  });

  // This is the exact API and identifier payload used by the sheet click.
  await actor.deleteEmbeddedDocuments("Item", [upbringing.id]);

  assert.deepEqual(actor.databaseDeletes.map(([, ids]) => ids), [
    [upbringing.id, "legacy"]
  ]);
  assert.deepEqual(actor.items.map(item => item.id), ["manual", "other-grant"]);
});

test("reconciliation uses only a unique exact name/class fallback and never creates a duplicate", async () => {
  const trait = compendiumTrait("trait-apprentice", "Keen Eye", "Apprentice");
  game.packs.set("brinkwood-reforged.trait", { getDocuments: async () => [trait] });
  const legacy = { id: "legacy", name: "Keen Eye", type: "trait", system: { class: "Apprentice" }, flags: {} };
  const updates = [];
  const actor = {
    items: [{ id: "upbringing-1", type: "upbringing", name: "Apprentice" }, legacy],
    _addTraits: BladesActor.prototype._addTraits,
    updateEmbeddedDocuments: async (...args) => updates.push(args),
    createEmbeddedDocuments: assert.fail
  };

  await BladesActor.prototype.reconcileTraitGrants.call(actor);
  assert.deepEqual(updates[0][1][0]["flags.brinkwood-reforged.traitGrant"], {
    sourceItemId: "upbringing-1", sourceItemType: "upbringing", traitSourceId: "trait-apprentice"
  });
});

test("ambiguous legacy matches are neither adopted nor duplicated", async () => {
  const trait = compendiumTrait("trait-apprentice", "Keen Eye", "Apprentice");
  game.packs.set("brinkwood-reforged.trait", { getDocuments: async () => [trait] });
  const updates = [];
  const creates = [];
  const actor = {
    items: [
      { id: "upbringing-1", type: "upbringing", name: "Apprentice" },
      { id: "legacy-a", name: "Keen Eye", type: "trait", system: { class: "Apprentice" }, flags: {} },
      { id: "legacy-b", name: "Keen Eye", type: "trait", system: { class: "Apprentice" }, flags: {} }
    ],
    _addTraits: BladesActor.prototype._addTraits,
    updateEmbeddedDocuments: async (...args) => updates.push(args),
    createEmbeddedDocuments: async (...args) => creates.push(args)
  };

  await BladesActor.prototype.reconcileTraitGrants.call(actor);
  assert.deepEqual(updates, []);
  assert.deepEqual(creates, []);
});

test("reconciliation backfills existing upbringing, profession, and mask choices", async () => {
  const sources = [
    { type: "upbringing", name: "Apprentice" },
    { type: "profession", name: "Ascetic" },
    { type: "mask", name: "The Fox" },
    { type: "class", name: "Rebel" }
  ];
  const added = [];
  const actor = {
    items: sources,
    _addTraits: async item => added.push(item.name)
  };

  await BladesActor.prototype.reconcileTraitGrants.call(actor);

  assert.deepEqual(added, ["Apprentice", "Ascetic", "The Fox"]);
});

test("removing Class or Pact never removes traits", async () => {
  for (const source of [
    { id: "class-1", type: "class" },
    { id: "pact-1", type: "pact" }
  ]) {
    const actor = new BladesActor([
      source,
      { id: "trait", type: "trait", flags: { "brinkwood-reforged": { traitGrant: {
        sourceItemId: source.id, sourceItemType: source.type, traitSourceId: "trait-source"
      } } } }
    ]);
    actor._modActionPoints = async () => {};

    await actor.deleteEmbeddedDocuments("Item", [source.id]);
    assert.deepEqual(actor.databaseDeletes[0][1], [source.id]);
    assert.equal(actor.items.some(item => item.id === "trait"), true);
  }
});

test("Judgement Mask accepts a legacy Judgment trait class from an existing world source", async () => {
  const legacyJudgmentTrait = compendiumTrait("trait-judgment", "Pronounce Sentence", "Judgment");
  game.packs.set("brinkwood-reforged.trait", { getDocuments: async () => [legacyJudgmentTrait] });
  const creates = [];
  const actor = {
    items: [],
    createEmbeddedDocuments: async (type, data) => creates.push({ type, data }),
  };

  await BladesActor.prototype._addTraits.call(actor, {
    id: "mask-judgement",
    type: "mask",
    name: "Judgement",
  });

  assert.equal(creates.length, 1);
  assert.equal(creates[0].data[0].name, "Pronounce Sentence");
  assert.deepEqual(creates[0].data[0].flags["brinkwood-reforged"].traitGrant, {
    sourceItemId: "mask-judgement",
    sourceItemType: "mask",
    traitSourceId: "trait-judgment",
  });
});

test("selected Mask Trait repairs retain actor-owned provenance and idempotency", async () => {
  const selected = compendiumTrait("trait-terror", "Fear Your Slaves", "Terror");
  const unselected = compendiumTrait("trait-terror-other", "Silenced Fears", "Terror");
  game.packs.set("brinkwood-reforged.trait", { getDocuments: async () => [selected, unselected] });
  const creates = [];
  const actor = {
    items: [],
    createEmbeddedDocuments: async (type, data) => {
      creates.push({ type, data });
      actor.items.push(...data.map(entry => ({
        ...entry,
        id: `actor-${entry.flags["brinkwood-reforged"].traitGrant.traitSourceId}`,
      })));
    },
  };
  const source = { id: "mask-terror", type: "mask", name: "Terror" };

  await BladesActor.prototype._addTraits.call(actor, source, null, false, [selected.id]);
  await BladesActor.prototype._addTraits.call(actor, source, null, false, [selected.id]);

  assert.equal(creates.length, 1);
  assert.deepEqual(creates[0].data.map(entry => entry.name), ["Fear Your Slaves"]);
  assert.deepEqual(creates[0].data[0].flags["brinkwood-reforged"].traitGrant, {
    sourceItemId: "mask-terror",
    sourceItemType: "mask",
    traitSourceId: "trait-terror",
  });
});

test("explicit cross-class Mask Trait is linked to the Mask and removed with it", async () => {
  const mask = { id: "mask-terror", type: "mask", name: "Terror", system: { logic: "" } };
  const selected = compendiumTrait("trait-judgment", "Pronounce Sentence", "Judgement");
  const manual = { id: "manual-trait", type: "trait", name: "Unlinked", flags: {} };
  game.packs.set("brinkwood-reforged.trait", { getDocuments: async () => [selected] });

  const actor = new BladesActor([mask, manual]);
  actor.createEmbeddedDocuments = async (_type, entries) => {
    const created = entries.map((entry, index) => ({ ...entry, id: `created-${index}` }));
    actor.items.push(...created);
    return created;
  };
  actor._modActionPoints = async () => {};

  await actor._addTraits(mask, null, false, [selected.id]);

  const grant = actor.items.find(item => item.id === "created-0");
  assert.deepEqual(grant.flags["brinkwood-reforged"].traitGrant, {
    sourceItemId: mask.id,
    sourceItemType: "mask",
    traitSourceId: selected.id,
  });

  await actor.clearMaskConfiguration();

  assert.deepEqual(actor.databaseDeletes.map(([, ids]) => ids), [
    [mask.id, grant.id],
  ]);
  assert.deepEqual(actor.items.map(item => item.id), [manual.id]);
});

test("selected Mask Trait repair forwards only requested trait sources through the actor command", async () => {
  const source = { id: "mask-terror", type: "mask", name: "Terror" };
  const calls = [];
  const actor = {
    items: [source],
    syncTraitGrantsForSources(...args) { calls.push(args); },
  };

  await BladesActor.prototype.repairTraitGrantsForSourceIds.call(
    actor,
    [source.id],
    false,
    ["trait-terror"],
  );

  assert.deepEqual(calls, [[[source], false, ["trait-terror"]]]);
});
