import assert from "node:assert/strict";
import test from "node:test";

import {
  adjustAspectProgress,
  applyGoingUnderground,
  correctAspectRank,
  gainHeat,
  gainSedition,
  normalizeAspects,
  normalizeResupply,
  rebellionReadiness,
  resupplyMaximum,
  undoAspectRank,
} from "../module/rebellion/rules.js";

const aspects = () => ["Organization", "Force", "Influence"].map(name => ({
  name,
  rank: 0,
  progress: [0, 0, 0],
  max_progress: [4, 6, 8],
  decisions: [],
}));

test("Aspect progress uses 4/6/8 sequential clocks without rollover and caps at rank 3", () => {
  let current = aspects();
  let result = adjustAspectProgress(current, "Organization", 4);
  assert.equal(result.rankedUp, true);
  assert.equal(result.rank, 1);
  assert.deepEqual(result.aspects[0].progress, [4, 0, 0]);

  result = adjustAspectProgress(result.aspects, "Organization", 9);
  assert.equal(result.rank, 2);
  assert.deepEqual(result.aspects[0].progress, [4, 6, 0]);

  result = adjustAspectProgress(result.aspects, "Organization", 20);
  assert.equal(result.rank, 3);
  assert.deepEqual(result.aspects[0].progress, [4, 6, 8]);
  assert.equal(adjustAspectProgress(result.aspects, "Organization", 1).changed, false);

  const correctedFull = aspects();
  correctedFull[0].progress[0] = 4;
  const advanced = adjustAspectProgress(correctedFull, "Organization", 1);
  assert.equal(advanced.rank, 1);
  assert.deepEqual(advanced.aspects[0].progress, [4, 0, 0]);
});

test("Legacy noncontiguous Aspect progress is retained and explicitly surfaced", () => {
  const [organization] = normalizeAspects([{ name: "Organization", progress: [4, 2, 3], decisions: [] }]);
  assert.equal(organization.rank, 1);
  assert.deepEqual(organization.progress, [4, 2, 3]);
  assert.equal(organization.noncontiguous, true);
});

test("Undo Last Rank reopens the previous clock one segment short and preserves decisions", () => {
  const current = aspects();
  current[0].rank = 2;
  current[0].progress = [4, 6, 3];
  current[0].decisions = [{ id: "moot-1", rank: 2, selectedChoice: "Hold fast" }];

  const result = undoAspectRank(current, "Organization");

  assert.equal(result.changed, true);
  assert.equal(result.rank, 1);
  assert.equal(result.aspects[0].rank, 1);
  assert.deepEqual(result.aspects[0].progress, [4, 5, 0]);
  assert.deepEqual(result.aspects[0].decisions, current[0].decisions);
  assert.equal(undoAspectRank(aspects(), "Organization").changed, false);
});

test("rank corrections preserve Moot snapshots for historical display", () => {
  const current = aspects();
  current[0].rank = 2;
  current[0].progress = [4, 6, 0];
  current[0].decisions = [{ id: "decision", title: "Tall or Wide", rank: 1, selectedChoice: "Wide" }];
  const corrected = correctAspectRank(current, "Organization", 0);
  assert.equal(corrected[0].rank, 0);
  assert.deepEqual(corrected[0].decisions, current[0].decisions);
});

test("Resupply maximum derives from Organization rank and clamps its value", () => {
  const current = aspects();
  for (const [rank, maximum] of [[0, 4], [1, 6], [2, 8], [3, 10]]) {
    current[0].rank = rank;
    assert.equal(resupplyMaximum(current), maximum);
    assert.deepEqual(normalizeResupply({ value: 99, max: 4 }, current), { value: maximum, max: maximum });
  }
});

test("Heat escalates Tyranny only when Heat was already full", () => {
  const base = { heat: { value: 9, max: 10 }, tyranny: { value: 2, max: 4 } };
  const fills = gainHeat(base, 2);
  assert.deepEqual(fills.heat, { value: 10, max: 10 });
  assert.equal(fills.tyranny.value, 2);
  assert.equal(fills.escalated, false);

  const escalates = gainHeat({ heat: fills.heat, tyranny: fills.tyranny }, 1);
  assert.equal(escalates.heat.value, 0);
  assert.equal(escalates.tyranny.value, 3);
  assert.equal(escalates.escalated, true);
});

test("Sedition gain fills, advances once, clears, and discards excess", () => {
  const location = { name: "Village", sedition: { clock: { value: 5, max: 6 }, level: 1 } };
  const result = gainSedition(location, 4, 6);
  assert.equal(result.advanced, true);
  assert.equal(result.location.sedition.level, 2);
  assert.equal(result.location.sedition.clock.value, 0);

  const capped = gainSedition({ ...location, sedition: { clock: { value: 5, max: 6 }, level: 3 } }, 4, 6);
  assert.equal(capped.advanced, false);
  assert.equal(capped.location.sedition.level, 3);
  assert.equal(capped.location.sedition.clock.value, 6);
});

test("Going Underground applies only deterministic Rebellion changes", () => {
  const system = {
    tyranny: { value: 2, max: 4 },
    heat: { value: 8, max: 10 },
    resupply: { value: 1, max: 4 },
    aspects: aspects(),
  };
  const critical = applyGoingUnderground(system, { result: "critical", aspectName: "Force" });
  assert.equal(critical.system.tyranny.value, 1);
  assert.equal(critical.system.heat.value, 0);
  assert.equal(critical.system.aspects[1].progress[0], 2);

  const shortage = applyGoingUnderground(system, { result: "4-5" });
  assert.equal(shortage.system.resupply.value, 3);

  const tied = applyGoingUnderground(system, { result: "1-3", aspectName: "Not an Aspect" });
  assert.deepEqual(tied.requiresChoice, ["Organization", "Force", "Influence"]);
});

test("Endgame readiness and liberated settlements are derived only", () => {
  const ranked = aspects().map(aspect => ({ ...aspect, rank: 2, progress: [4, 6, 0] }));
  const system = {
    aspects: ranked,
    towns: [{ name: "Town", sedition: { clock: { value: 0, max: 8 }, level: 3 } }],
    villages: [{ name: "Village", sedition: { clock: { value: 0, max: 6 }, level: 2 } }],
  };
  const readiness = rebellionReadiness(system);
  assert.equal(readiness.totalRanks, 6);
  assert.equal(readiness.ready, true);
  assert.deepEqual(readiness.liberated.map(location => location.name), ["Town"]);
  assert.equal(system.phase, undefined);
});
