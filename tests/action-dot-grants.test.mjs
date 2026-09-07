import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  actionDotGrantsForSource,
  actionDotReconciliationUpdate,
  prepareActionDotProjection,
  withActionDotGrantSnapshot,
} from "../module/character/action-dot-grants.js";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

function attributes(values = {}) {
  const skill = name => ({ value: values[name] ?? 0 });
  return {
    insight: { skills: { hunt: skill("hunt"), study: skill("study"), survey: skill("survey"), tinker: skill("tinker") } },
    prowess: { skills: { finesse: skill("finesse"), prowl: skill("prowl"), skirmish: skill("skirmish"), wreck: skill("wreck") } },
    resolve: { skills: { attune: skill("attune"), command: skill("command"), consort: skill("consort"), sway: skill("sway") } },
  };
}

function source(type, name, values) {
  return withActionDotGrantSnapshot({ type, name, system: { attributes: attributes(values) } });
}

test("Class and Profession snapshots use structured ratings instead of legacy logic", () => {
  const ranger = withActionDotGrantSnapshot({
    type: "class",
    name: "Ranger",
    system: {
      logic: "system.attributes.insight.skills.hunt.value = 4",
      attributes: attributes({ survey: 2, prowl: 1 }),
    },
  });

  assert.deepEqual(actionDotGrantsForSource(ranger), [
    { path: "system.attributes.insight.skills.survey.value", value: 2 },
    { path: "system.attributes.prowess.skills.prowl.value", value: 1 },
  ]);
  assert.equal(ranger.system.logic.includes("hunt"), true, "the snapshot does not rewrite source text");
});

test("projection keeps player dots separate and places immutable grants first", () => {
  const actorAttributes = attributes({ hunt: 1, study: 4 });
  const profession = source("profession", "Hunter", { hunt: 1 });
  const classItem = source("class", "Mage", { study: 2 });

  prepareActionDotProjection(actorAttributes, [profession, classItem]);

  assert.equal(actorAttributes.insight.skills.hunt.baseValue, 1);
  assert.equal(actorAttributes.insight.skills.hunt.grantedValue, 1);
  assert.equal(actorAttributes.insight.skills.hunt.value, 2);
  assert.deepEqual(actorAttributes.insight.skills.hunt.dots.map(dot => dot.state), [
    "granted", "manual", "empty", "empty",
  ]);
  assert.equal(actorAttributes.insight.skills.study.value, 4, "roll totals are capped at four");
  assert.deepEqual(actorAttributes.insight.skills.study.dots.map(dot => dot.state), [
    "granted", "granted", "manual", "manual",
  ]);
});

test("only embedded snapshots grant dots", () => {
  const unsnapshotted = { type: "class", name: "Mage", system: { attributes: attributes({ study: 2 }) } };
  const actorAttributes = attributes();
  prepareActionDotProjection(actorAttributes, [unsnapshotted]);
  assert.equal(actorAttributes.insight.skills.study.value, 0);
});

test("an existing embedded snapshot remains immutable when source fields change", () => {
  const embedded = source("class", "Ranger", { survey: 2, prowl: 1 });
  embedded.system.attributes.insight.skills.survey.value = 4;
  const copied = withActionDotGrantSnapshot(embedded);
  assert.deepEqual(actionDotGrantsForSource(copied), [
    { path: "system.attributes.insight.skills.survey.value", value: 2 },
    { path: "system.attributes.prowess.skills.prowl.value", value: 1 },
  ]);
});

test("Character template and styles distinguish source-owned dots", async () => {
  const [template, controller, styles] = await Promise.all([
    read("templates/parts/attributes.html"),
    read("module/blades-actor-sheet.js"),
    read("scss/import/general-styles.scss"),
  ]);

  assert.match(template, /dot-value--granted/);
  assert.match(template, /data-granted="true"[\s\S]*?disabled/);
  assert.match(template, /data-base-value="\{\{dot\.basePosition\}\}"/);
  assert.match(controller, /prepareActionDotProjection\(context\.system\.attributes, context\.items\)/);
  assert.match(styles, /\.dot-value--granted::before\s*\{[\s\S]*?border-color:\s*#6b4528;[\s\S]*?background:\s*#b7864d;[\s\S]*?box-shadow:\s*inset/);
});

test("public Class configuration snapshots grants and serializes replacement", async () => {
  globalThis.foundry = {
    abstract: { TypeDataModel: class {} },
    data: { fields: {} },
    documents: {
      Actor: class {
        constructor(items = []) { this.items = items; }
        async update(update) {
          if (this.failNextUpdate) {
            this.failNextUpdate = false;
            throw new Error("update failed");
          }
          this.updates ??= [];
          this.updates.push(update);
          for (const [path, value] of Object.entries(update)) {
            const keys = path.split(".");
            const last = keys.pop();
            keys.reduce((target, key) => target[key], this)[last] = value;
          }
        }
        async createEmbeddedDocuments(_name, documents) {
          if (this.failNextCreate) throw new Error("create failed");
          const created = documents.map((document, index) => ({
            ...structuredClone(document),
            id: `source-${this.items.length + index + 1}`,
          }));
          this.items.push(...created);
          return created;
        }
        async deleteEmbeddedDocuments(_name, ids) {
          if (this.failNextDelete) {
            this.failNextDelete = false;
            throw new Error("delete failed");
          }
          const removed = this.items.filter(item => ids.includes(item.id ?? item._id));
          this.items = this.items.filter(item => !ids.includes(item.id ?? item._id));
          return removed;
        }
      },
    },
    utils: {
      deepClone: structuredClone,
      getProperty: () => undefined,
      setProperty: () => undefined,
    },
  };
  globalThis.ui = { notifications: { warn: () => {} } };
  globalThis.game = { packs: new Map() };

  const { BladesActor } = await import(`../module/blades-actor.js?action-dots=${Date.now()}`);
  const actor = new BladesActor();
  actor.system = { attributes: attributes({ hunt: 2 }) };

  await Promise.all([
    actor.configureActionDotSource({ type: "class", name: "Ranger", system: { attributes: attributes({ survey: 2 }) } }),
    actor.configureActionDotSource({ type: "class", name: "Mage", system: { attributes: attributes({ study: 2 }) } }),
  ]);

  assert.deepEqual(actor.items.map(item => item.name), ["Mage"]);
  assert.deepEqual(actionDotGrantsForSource(actor.items[0]), [
    { path: "system.attributes.insight.skills.study.value", value: 2 },
  ]);
  assert.equal(actor.system.attributes.insight.skills.hunt.value, 2, "source replacement never mutates player dots");

  const oldClass = { ...source("class", "Ranger", { survey: 2 }), id: "old-class" };
  const rollbackActor = new BladesActor([oldClass]);
  rollbackActor.failNextDelete = true;
  await assert.rejects(
    rollbackActor.configureActionDotSource({
      type: "class",
      name: "Mage",
      system: { attributes: attributes({ study: 2 }) },
    }),
    /delete failed/,
  );
  assert.deepEqual(rollbackActor.items.map(item => item.name), ["Ranger"]);

  const hunter = { ...source("profession", "Hunter", { hunt: 1 }), id: "hunter" };
  const overflow = new BladesActor([hunter]);
  overflow.system = { attributes: attributes({ hunt: 4, study: 3, prowl: 4 }) };
  const ranger = source("class", "Ranger", { hunt: 1 });
  await overflow.configureActionDotSource(ranger);
  assert.equal(overflow.system.attributes.insight.skills.hunt.value, 2, "combined grants trim trailing manual ranks");
  assert.deepEqual(overflow.updates, [{ "system.attributes.insight.skills.hunt.value": 2 }]);
  await overflow.deleteEmbeddedDocuments("Item", overflow.items.map(item => item.id));
  assert.equal(overflow.system.attributes.insight.skills.hunt.value, 2, "removal never restores displaced dots");

  const replacement = new BladesActor([{ ...source("class", "Old", { study: 2 }), id: "old" }]);
  replacement.system = { attributes: attributes({ study: 3, hunt: 4 }) };
  await replacement.configureActionDotSource(source("class", "New", { study: 1 }));
  assert.equal(replacement.system.attributes.insight.skills.study.value, 3, "temporary old+new grants never trim dots");
  assert.equal(replacement.updates, undefined, "final set needs no trim");

  for (const failure of ["failNextCreate", "failNextDelete"]) {
    const failing = new BladesActor([{ ...source("class", "Old", { study: 1 }), id: "old" }]);
    failing.system = { attributes: attributes({ study: 4 }) };
    failing[failure] = true;
    await assert.rejects(failing.configureActionDotSource(source("class", "New", { study: 2 })), /failed/);
    assert.equal(failing.system.attributes.insight.skills.study.value, 4, "failed source mutation cannot consume manual dots");
    assert.equal(failing.updates, undefined);
  }

  const retry = new BladesActor();
  retry.system = { attributes: attributes({ study: 4 }) };
  retry.failNextUpdate = true;
  const mage = source("class", "Mage", { study: 2 });
  await assert.rejects(retry.configureActionDotSource(mage), /update failed/);
  assert.equal(retry.items.length, 1, "identity remains committed when reconciliation fails");
  assert.equal(retry.system.attributes.insight.skills.study.value, 4);
  await retry.configureActionDotSource(mage);
  assert.equal(retry.items.length, 1, "retry retains the identity source");
  assert.equal(retry.system.attributes.insight.skills.study.value, 2);
});

test("reconciliation changes only overflowing granted rows and is idempotent", () => {
  const actor = { system: { attributes: attributes({ study: 4, hunt: 2, prowl: 4 }) } };
  const mage = source("class", "Mage", { study: 1, hunt: 1 });
  assert.deepEqual(actionDotReconciliationUpdate(actor, [mage]), {
    "system.attributes.insight.skills.study.value": 3,
  });
  actor.system.attributes.insight.skills.study.value = 3;
  assert.deepEqual(actionDotReconciliationUpdate(actor, [mage]), {});
  assert.deepEqual(actionDotReconciliationUpdate(actor, []), {});
});
