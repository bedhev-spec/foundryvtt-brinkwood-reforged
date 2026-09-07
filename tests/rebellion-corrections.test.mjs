import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

let confirmContent = "";
globalThis.foundry = {
  applications: {
    api: {
      DialogV2: {
        async confirm(options) {
          confirmContent = options.content;
          return true;
        },
      },
      HandlebarsApplicationMixin: Base => Base,
    },
    sheets: { ActorSheetV2: class { async _onRender() {} async _onClose() {} } },
  },
  utils: {
    deepClone: value => structuredClone(value),
    getProperty: (object, path) => path.split(".").reduce((value, key) => value?.[key], object),
  },
};

const notices = { info: [], warn: [], error: [] };
globalThis.ui = {
  notifications: {
    info: message => notices.info.push(message),
    warn: message => notices.warn.push(message),
    error: message => notices.error.push(message),
  },
};
globalThis.game = {
  user: { isGM: true },
  items: new Map(),
  packs: new Map(),
  i18n: {
    localize: key => key,
    format: (key, values) => `${key} ${Object.values(values).join(" ")}`,
  },
};

const { BladesRebelionSheet } = await import("../module/blades-rebelion-sheet.js");
const root = new URL("../", import.meta.url);

const baseAspects = () => [
  {
    name: "Organization",
    rank: 2,
    progress: [4, 6, 0],
    max_progress: [4, 6, 8],
    decisions: [{ id: "saved-moot", catalogueId: "catalogue-moot", title: "A Moot", aspect: "Organization", rank: 2, selectedChoice: "A" }],
  },
  { name: "Force", rank: 0, progress: [0, 0, 0], max_progress: [4, 6, 8], decisions: [] },
  { name: "Influence", rank: 0, progress: [0, 0, 0], max_progress: [4, 6, 8], decisions: [] },
];

function fixture() {
  const updates = [];
  const document = {
    system: {
      aspects: baseAspects(),
      towns: [{ name: "Harrowgate", sedition: { clock: { value: 2, max: 8 }, level: 3 } }],
      conclave: [{ id: "ally-1", name: "The Lanterns", strengths: ["Scouts"], sourceUuid: "", originAspect: "Organization", originRank: 1 }],
    },
    async update(update) {
      updates.push(structuredClone(update));
      if (update["system.aspects"]) this.system.aspects = structuredClone(update["system.aspects"]);
      if (update["system.towns"]) this.system.towns = structuredClone(update["system.towns"]);
      if (update["system.conclave"]) this.system.conclave = structuredClone(update["system.conclave"]);
    },
  };
  const sheet = Object.assign(Object.create(BladesRebelionSheet.prototype), { document, isEditable: true });
  return { document, sheet, updates };
}

test("Clear Answer removes only the selected decision snapshot after confirmation", async () => {
  const { document, sheet, updates } = fixture();
  const beforeProgress = structuredClone(document.system.aspects[0].progress);
  const result = await sheet._clearMootAnswer({
    dataset: { aspectName: "Organization", decisionId: "saved-moot", catalogueId: "catalogue-moot", decisionTitle: "<b>A Moot</b>" },
  });

  assert.equal(result, true);
  assert.equal(updates.length, 1);
  assert.equal(document.system.aspects[0].rank, 2);
  assert.deepEqual(document.system.aspects[0].progress, beforeProgress);
  assert.deepEqual(document.system.aspects[0].decisions, []);
  assert.doesNotMatch(confirmContent, /<b>A Moot<\/b>/);
  assert.match(confirmContent, /&lt;b&gt;A Moot&lt;\/b&gt;/);
});

test("Undo Last Rank reopens progress one segment short and retains Moot history", async () => {
  const { document, sheet, updates } = fixture();
  const result = await sheet._undoAspectRank({ dataset: { aspectName: "Organization" } });

  assert.equal(result, true);
  assert.equal(updates.length, 1);
  assert.equal(document.system.aspects[0].rank, 1);
  assert.deepEqual(document.system.aspects[0].progress, [4, 5, 0]);
  assert.equal(document.system.aspects[0].decisions[0].id, "saved-moot");
});

test("Undo Territory Level reverses liberation and preserves the Sedition clock", async () => {
  const { document, sheet, updates } = fixture();
  const result = await sheet._undoTerritoryLevel({
    dataset: { collection: "towns", index: "0", territoryName: "Harrowgate" },
  });

  assert.equal(result, true);
  assert.equal(updates.length, 1);
  assert.equal(document.system.towns[0].sedition.level, 2);
  assert.equal(document.system.towns[0].sedition.clock.value, 2);
});

test("GM Territory Level reductions from the tracker use confirmed Undo", async () => {
  const { document, sheet, updates } = fixture();
  const result = await sheet._onTrackerClick({
    preventDefault() {},
    currentTarget: { dataset: { path: "rebellion.location.towns.0.level", value: "1" } },
  });

  assert.equal(result, true);
  assert.equal(updates.length, 1);
  assert.equal(document.system.towns[0].sedition.level, 2);
  assert.equal(document.system.towns[0].sedition.clock.value, 2);
});

test("Conclave Actor selection stores only a validated Actor UUID", async () => {
  const { document, sheet, updates } = fixture();
  globalThis.fromUuid = async uuid => uuid === "Actor.source-1"
    ? { documentName: "Actor", uuid, name: "Lantern Captain", visible: true }
    : null;

  const result = await sheet._setAllyActorUuid("ally-1", "Actor.source-1");

  assert.equal(result, true);
  assert.equal(updates.length, 1);
  assert.equal(document.system.conclave[0].sourceUuid, "Actor.source-1");
  delete globalThis.fromUuid;
});

test("Moot correction routes remain GM-only", async () => {
  const { sheet, updates } = fixture();
  globalThis.game.user.isGM = false;
  try {
    assert.equal(await sheet._undoAspectRank({ dataset: { aspectName: "Organization" } }), false);
    assert.equal(updates.length, 0);
    assert.ok(notices.warn.length > 0);
  } finally {
    globalThis.game.user.isGM = true;
  }
});

test("Aspect and recorded Moot templates expose separate GM correction controls", async () => {
  const [sheet, aspect, moot] = await Promise.all([
    readFile(new URL("templates/rebelion-sheet.html", root), "utf8"),
    readFile(new URL("templates/rebelion-sheet/aspect-section.html", root), "utf8"),
    readFile(new URL("templates/rebelion-sheet/moot-section.html", root), "utf8"),
  ]);

  assert.match(sheet, /canCorrectRank=\.\.\/rebellion\.canCorrectRank/);
  assert.match(aspect, /type="button"[^>]*data-rebellion-action="undo-aspect-rank"/);
  assert.match(moot, /type="button"[^>]*data-rebellion-action="clear-moot-answer"/);
  assert.match(moot, /data-decision-id=/);
  assert.match(sheet, /canCorrectTerritory=rebellion\.canCorrectTerritory/);
});
