import { extractPack } from "@foundryvtt/foundryvtt-cli";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const TRAITS_PATH = new URL("../packs/traits.db", import.meta.url);

async function maskAbilities() {
  const source = await readFile(TRAITS_PATH, "utf8");
  return source
    .trim()
    .split(/\r?\n/)
    .map(line => JSON.parse(line))
    .filter(item => item.type === "trait" && item.system?.class);
}

function ability(abilities, name, mask) {
  const result = abilities.find(item => item.name === name && item.system.class === mask);
  assert.ok(result, `expected ${mask} ability ${name}`);
  return result;
}

test("Mask Ability catalogue keeps the four formerly merged abilities as separate records", async () => {
  const abilities = await maskAbilities();

  assert.equal(
    ability(abilities, "No Excuses for the Terror", "Terror").system.description,
    "Gain +1d when you Awe a friendly group. You may grant them potency on a success."
  );
  assert.equal(
    ability(abilities, "Wholesale Carnage", "Violence").system.description,
    "Gain +Effect when using Carnage to fight a group that is at a larger scale than your own."
  );
  assert.equal(
    ability(abilities, "Agony of Multitudes", "Torment").system.description,
    "Spend 2 essence to make ghostly apparitions appear around you, increasing your scale."
  );
  assert.equal(
    ability(abilities, "Cruel End", "Ruin").system.description,
    "When your poison kills someone, it does so horrifically, terrifying your foes and increasing your position."
  );

  assert.doesNotMatch(ability(abilities, "Sow Discord", "Terror").system.description, /No Excuses/i);
  assert.doesNotMatch(ability(abilities, "Transfusion", "Ruin").system.description, /Cruel End/i);
});

test("Mask Ability catalogue reflects confirmed core-rule corrections", async () => {
  const abilities = await maskAbilities();

  assert.equal(ability(abilities, "Language of the Unheard", "Riot").system.description,
    "Gain +Effect when you invoke a known cause or common struggle to stir others to action.");
  assert.equal(ability(abilities, "Torches and Pitchforks", "Riot").system.description,
    "Any crowds or cohorts you lead gain quality.");
  assert.equal(ability(abilities, "Shock and Awe", "Terror").system.description,
    "Whenever you perform a desperate action, pay only 1 essence to take +Effect, as all are shocked and awed by your sheer audacity.");
  assert.equal(ability(abilities, "Bloodtaker", "Violence").system.description,
    "Instantly gain 2 essence whenever you defeat a vampiric enemy.");
  assert.match(ability(abilities, "Cloak of Rumors", "Lies").system.description, /Spend 1 essence/);
  assert.match(ability(abilities, "Cloak of Rumors", "Lies").system.description, /additional essence for more dangerous rumors/);
});

test("Drink Deep and Multifaceted remain deferred without new catalogue metadata", async () => {
  const abilities = await maskAbilities();
  const deferred = abilities.filter(item => ["Drink Deep", "Multifaceted"].includes(item.name));

  assert.ok(deferred.length > 0, "expected the deferred Mask Abilities to remain in the catalogue");
  for (const item of deferred) {
    assert.equal(Object.hasOwn(item.system, "repeatable"), false);
    assert.equal(Object.hasOwn(item.system, "advancementCost"), false);
  }
});

test("the shipped LevelDB pack contains every corrected canonical record", async () => {
  const abilities = await maskAbilities();
  const corrected = [
    ["No Excuses for the Terror", "Terror"],
    ["Wholesale Carnage", "Violence"],
    ["Agony of Multitudes", "Torment"],
    ["Cruel End", "Ruin"],
    ["Sow Discord", "Terror"],
    ["Transfusion", "Ruin"],
    ["Language of the Unheard", "Riot"],
    ["Torches and Pitchforks", "Riot"],
    ["Shock and Awe", "Terror"],
    ["Bloodtaker", "Violence"],
    ["Cloak of Rumors", "Lies"],
  ].map(([name, mask]) => ability(abilities, name, mask));
  const workspace = await mkdtemp(path.join(tmpdir(), "brinkwood-mask-abilities-"));
  try {
    const extracted = path.join(workspace, "documents");
    await extractPack(fileURLToPath(new URL("../packs/traits/", import.meta.url)), extracted);
    const activeRecords = await Promise.all((await readdir(extracted)).map(async file => {
      const document = JSON.parse(await readFile(path.join(extracted, file), "utf8"));
      delete document._key;
      return document;
    }));
    for (const record of corrected) {
      const active = activeRecords.find(item => item._id === record._id);
      assert.deepEqual(active, record, `active LevelDB pack is missing ${record.system.class}: ${record.name}`);
    }
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
