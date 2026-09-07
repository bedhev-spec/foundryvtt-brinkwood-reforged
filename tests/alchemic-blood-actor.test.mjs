import assert from "node:assert/strict";
import test from "node:test";

const setProperty = (object, path, value) => {
  const keys = path.split(".");
  const last = keys.pop();
  let target = object;
  for (const key of keys) target = target[key] ??= {};
  target[last] = value;
};

globalThis.foundry = {
  documents: {
    Actor: class {
      constructor(items = []) {
        this.items = items;
        this.id = "alchemy-actor";
        this.isOwner = true;
      }

      async updateEmbeddedDocuments(_name, updates) {
        await Promise.resolve();
        return updates.map(update => {
          const item = this.items.find(candidate => (candidate.id ?? candidate._id) === update._id);
          for (const [path, value] of Object.entries(update)) {
            if (path !== "_id") setProperty(item, path, value);
          }
          return item;
        });
      }
    },
  },
  abstract: { TypeDataModel: class {} },
  data: { fields: {} },
  utils: {
    deepClone: value => structuredClone(value),
    getProperty: (object, path) => path.split(".").reduce((value, key) => value?.[key], object),
    setProperty,
  },
};
globalThis.game = { packs: new Map(), user: { isGM: false } };

const { BladesActor } = await import(`../module/blades-actor.js?alchemic-blood=${Date.now()}`);

const ruinMask = {
  id: "mask-ruin",
  type: "mask",
  _stats: { compendiumSource: "Compendium.brinkwood-reforged.mask.ST9JeQURSTd6qZM4" },
};

const alchemicTrait = () => ({
  id: "trait-alchemic",
  type: "trait",
  system: { alchemicBlood: { effects: {
    soporific: false,
    ashen: false,
    caustic: false,
    flechette: false,
    naptha: false,
    narcotic: false,
  } } },
  flags: { "brinkwood-reforged": { traitGrant: {
    sourceItemId: ruinMask.id,
    sourceItemType: "mask",
    traitSourceId: "N2EkeiPK88YhzIEP",
  } } },
});

test("distinct simultaneous unlocks are serialized and retain both boolean leaves", async () => {
  const trait = alchemicTrait();
  const actor = new BladesActor([ruinMask, trait]);
  actor.system = { experience: { value: 4 }, essence: { value: 2 }, stress: { value: 3 } };
  const before = structuredClone(actor.system);

  await Promise.all([
    actor.setAlchemicBloodEffect("soporific"),
    actor.setAlchemicBloodEffect("ashen"),
  ]);

  assert.equal(trait.system.alchemicBlood.effects.soporific, true);
  assert.equal(trait.system.alchemicBlood.effects.ashen, true);
  assert.deepEqual(actor.system, before, "record keeping must not mutate XP, Essence, Stress, or other Actor state");
});

test("editable players can remove a recorded choice without changing resources", async () => {
  const trait = alchemicTrait();
  trait.system.alchemicBlood.effects.caustic = true;
  const actor = new BladesActor([ruinMask, trait]);
  actor.system = { experience: { value: 4 }, essence: { value: 2 }, stress: { value: 3 } };
  const before = structuredClone(actor.system);

  await actor.setAlchemicBloodEffect("caustic", false);
  assert.equal(trait.system.alchemicBlood.effects.caustic, false);
  assert.deepEqual(actor.system, before);
});

test("writes fail closed when the source-owned trait is missing", async () => {
  const actor = new BladesActor([ruinMask]);
  await assert.rejects(actor.setAlchemicBloodEffect("naptha"), /trait is missing/);
});
