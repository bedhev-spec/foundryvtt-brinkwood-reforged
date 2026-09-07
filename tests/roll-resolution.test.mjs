import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildRollResolution, readRollDialogValues } from "../module/roll-resolution.js";

test("roll resolution includes every modifier and action context", () => {
  const resolution = buildRollResolution({
    baseDice: 2,
    modifiers: [
      { label: "Push", value: 1 },
      { label: "Harm", value: -2 },
      { label: "Assist", value: 1 }
    ],
    position: "desperate",
    effect: "great"
  });

  assert.deepEqual(resolution, {
    baseDice: 2,
    modifiers: [
      { label: "Push", value: 1, sign: "+", absoluteValue: 1, order: 0 },
      { label: "Harm", value: -2, sign: "−", absoluteValue: 2, order: 1 },
      { label: "Assist", value: 1, sign: "+", absoluteValue: 1, order: 2 }
    ],
    modifierTotal: 0,
    unclampedDicePool: 2,
    dicePool: 2,
    wasClamped: false,
    zeroMode: false,
    rolledDice: 2,
    keep: "highest",
    position: "desperate",
    effect: "great"
  });
});

test("negative pools resolve as zero dice and retain the complete equation", () => {
  const resolution = buildRollResolution({
    baseDice: 1,
    modifiers: [{ label: "Penalty", value: -3 }],
    position: "RISKY",
    effect: "LIMITED"
  });

  assert.equal(resolution.unclampedDicePool, -2);
  assert.equal(resolution.dicePool, 0);
  assert.equal(resolution.wasClamped, true);
  assert.equal(resolution.rolledDice, 2);
  assert.equal(resolution.keep, "lowest");
  assert.equal(resolution.zeroMode, true);
  assert.equal(resolution.modifiers[0].value, -3);
  assert.equal(resolution.position, "risky");
  assert.equal(resolution.effect, "limited");
});

test("signed base ratings are combined with modifiers before the pool is clamped", () => {
  const resolution = buildRollResolution({
    baseDice: -1,
    modifiers: [{ label: "Assist", value: 1 }]
  });

  assert.equal(resolution.baseDice, -1);
  assert.equal(resolution.modifierTotal, 1);
  assert.equal(resolution.unclampedDicePool, 0);
  assert.equal(resolution.dicePool, 0);
  assert.equal(resolution.zeroMode, true);
});

test("DialogV2 roll values are read from its element", () => {
  const values = { mod: "-2", pos: "controlled", fx: "standard", note: "Carefully" };
  const queried = [];
  const dialog = {
    element: {
      querySelector(selector) {
        const name = selector.match(/name="([^"]+)"/)[1];
        queried.push(name);
        return { value: values[name] };
      }
    },
    querySelector() {
      assert.fail("DialogV2 application itself is not the form root");
    }
  };

  assert.deepEqual(readRollDialogValues(dialog), {
    modifier: -2,
    position: "controlled",
    effect: "standard",
    note: "Carefully"
  });
  assert.deepEqual(queried, ["mod", "pos", "fx", "note"]);
});

test("every roll chat card renders the shared calculation breakdown", async () => {
  for (const template of ["action-roll.html", "resistance-roll.html", "essence-roll.html"]) {
    const source = await readFile(new URL(`../templates/chat/${template}`, import.meta.url), "utf8");
    assert.match(source, /templates\/chat\/roll-calculation\.html/);
  }
});

test("bladesRoll uses the resolved pool and forwards the full calculation to chat", async () => {
  class TypeDataModel {}
  class Field {
    constructor(options = {}) {
      this.options = options;
    }
  }

  let formula;
  let renderedPath;
  let renderedData;
  let createdMessage;
  let storedStatistics;

  globalThis.foundry = {
    abstract: { TypeDataModel },
    data: {
      fields: {
        ArrayField: Field,
        HTMLField: Field,
        NumberField: Field,
        ObjectField: Field,
        SchemaField: Field,
        StringField: Field
      }
    },
    utils: { deepClone: value => structuredClone(value) },
    dice: {
      Roll: class {
        constructor(nextFormula) {
          formula = nextFormula;
          this.dice = [{ results: [{ result: 6 }] }];
        }

        async evaluate() {}
      }
    },
    documents: { ChatMessage: { getSpeaker: () => ({ alias: "Tester" }) } },
    applications: {
      handlebars: {
        async renderTemplate(path, data) {
          renderedPath = path;
          renderedData = data;
          return "rendered card";
        }
      }
    }
  };
  globalThis.CONST = { CHAT_MESSAGE_STYLES: { ROLL: 5 } };
  globalThis.game = {
    user: {
      id: "player-1",
      getFlag: () => storedStatistics,
      async setFlag(_scope, _key, value) {
        storedStatistics = value;
      }
    }
  };
  globalThis.CONFIG = {
    ChatMessage: {
      documentClass: {
        async create(data) {
          createdMessage = data;
        }
      }
    }
  };

  const { bladesRoll, getBladesRollStatus, getBladesRollStress } = await import(`../module/blades-roll.js?integration=${Date.now()}`);
  const doubleSix = [{ result: 6 }, { result: 6 }];
  assert.equal(getBladesRollStatus(doubleSix, true), "success", "zero-dice rolls cannot score a critical");
  assert.equal(getBladesRollStress(doubleSix, true), 1, "zero-dice resistance uses its lower six");
  assert.equal(getBladesRollStatus(doubleSix, false), "critical-success");
  assert.equal(getBladesRollStress(doubleSix, false), 0);
  assert.equal(getBladesRollStress([{ result: 6 }]), 1);
  assert.equal(getBladesRollStress([{ result: 5 }]), 2);
  assert.equal(getBladesRollStress([{ result: 4 }]), 2);
  assert.equal(getBladesRollStress([{ result: 3 }]), 3);
  assert.equal(getBladesRollStress([{ result: 2 }]), 3);
  assert.equal(getBladesRollStress([{ result: 1 }]), 3);

  await bladesRoll(2, "Actor.Actions.Hunt.Name", "desperate", "great", "In the dark", {
    modifiers: [
      { label: "Push", value: 1 },
      { label: "Darkness", value: -2 }
    ]
  });

  assert.equal(formula, "1d6");
  assert.match(renderedPath, /action-roll\.html$/);
  assert.equal(renderedData.position, "desperate");
  assert.equal(renderedData.effect, "great");
  assert.equal(renderedData.calculation.baseDice, 2);
  assert.equal(renderedData.calculation.dicePool, 1);
  assert.deepEqual(renderedData.calculation.modifiers.map(({ label, value }) => ({ label, value })), [
    { label: "Push", value: 1 },
    { label: "Darkness", value: -2 }
  ]);
  assert.equal(createdMessage.content, "rendered card");
  assert.equal(createdMessage.style, 5);
  assert.equal(createdMessage.rolls.length, 1);
  assert.equal(createdMessage.flags["brinkwood-reforged"].roll.userId, "player-1");
  assert.equal(createdMessage.flags["brinkwood-reforged"].roll.outcome, "success");
  assert.equal(createdMessage.flags["brinkwood-reforged"].roll.dicePool, 1);
  assert.equal(storedStatistics.total, 1);
  assert.equal(storedStatistics.outcomes.success, 1);

  await bladesRoll(2, "", "", "", "Utility roll");
  assert.equal(createdMessage.flags, undefined);
  assert.equal(storedStatistics.total, 1, "unlabelled simple rolls must not affect action statistics");
});
