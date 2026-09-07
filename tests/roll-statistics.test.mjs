import assert from "node:assert/strict";
import test from "node:test";

import {
  addActionRollToStatistics,
  emptyRollStatistics,
  listStatisticsUsers,
  recordActionRoll,
  renderRollStatisticsContent,
  sendRollStatisticsToChat,
  summarizeRollStatistics
} from "../module/roll-statistics.js";

test("player statistics aggregate action outcomes, pools, and zero-dice rolls", () => {
  const rolls = [
    { outcome: "critical-success", dicePool: 4, zeroMode: false },
    { outcome: "success", dicePool: 3, zeroMode: false },
    { outcome: "partial-success", dicePool: 2, zeroMode: false },
    { outcome: "failure", dicePool: 0, zeroMode: true }
  ];
  const statistics = rolls.reduce(addActionRollToStatistics, emptyRollStatistics());
  const summary = summarizeRollStatistics(statistics);

  assert.equal(summary.total, 4);
  assert.equal(summary.averageDicePool, 2.25);
  assert.equal(summary.zeroDice, 1);
  assert.equal(summary.sixPlus, 50);
  assert.equal(summary.fourPlus, 75);
  assert.deepEqual(summary.rows.map(row => [row.outcome, row.count, row.percentage]), [
    ["critical-success", 1, 25],
    ["success", 1, 25],
    ["partial-success", 1, 25],
    ["failure", 1, 25]
  ]);
});

test("unknown roll types cannot corrupt player statistics", () => {
  const original = addActionRollToStatistics(undefined, { outcome: "resistance", dicePool: 6 });
  assert.deepEqual(original, emptyRollStatistics());
});

test("the statistics selector includes players and GMs", () => {
  const player = { id: "player", isGM: false };
  const gm = { id: "gm", isGM: true };
  assert.deepEqual(listStatisticsUsers([player, gm]), [player, gm]);
});

test("recording serializes user-flag updates", async () => {
  let stored;
  const user = {
    id: "player-1",
    getFlag: () => stored,
    async setFlag(scope, key, value) {
      assert.equal(scope, "brinkwood-reforged");
      assert.equal(key, "rollStatistics");
      await Promise.resolve();
      stored = value;
    }
  };

  await Promise.all([
    recordActionRoll({ outcome: "success", dicePool: 3 }, user),
    recordActionRoll({ outcome: "failure", dicePool: 1 }, user)
  ]);

  assert.equal(stored.total, 2);
  assert.equal(stored.totalDicePool, 4);
  assert.equal(stored.outcomes.success, 1);
  assert.equal(stored.outcomes.failure, 1);
});

test("statistics dialog is focused and escapes player names", () => {
  const content = renderRollStatisticsContent(
    addActionRollToStatistics(undefined, { outcome: "partial-success", dicePool: 2 }),
    '<script>alert("no")</script>',
    key => key
  );

  assert.doesNotMatch(content, /<script>/);
  assert.match(content, /BITD\.RollPartialSuccess/);
  assert.match(content, /BITD\.RollStatisticsAveragePool/);
  assert.match(content, /BITD\.RollStatisticsZeroDice/);
  assert.doesNotMatch(content, /Most rolled action/i);
});

test("statistics render percentages as whole numbers while retaining average-pool precision", () => {
  const content = renderRollStatisticsContent({
    total: 10,
    totalDicePool: 10,
    zeroDice: 0,
    outcomes: { "critical-success": 0, success: 1, "partial-success": 0, failure: 9 }
  }, "Player", key => key);
  const perfectContent = renderRollStatisticsContent(
    addActionRollToStatistics(undefined, { outcome: "success", dicePool: 1 }),
    "Player",
    key => key
  );

  assert.match(content, />10%<\/strong>/);
  assert.match(content, />90%<\/strong>/);
  assert.match(content, />0%<\/strong>/);
  assert.match(content, />1\.0d<\/dd>/);
  assert.doesNotMatch(content, />\d+\.\d+%</);
  assert.match(perfectContent, />100%<\/strong>/);
  assert.match(perfectContent, />100%<\/dd>/);
});

test("player statistics can be sent as a public chat card", async () => {
  let message;
  globalThis.game = { i18n: { localize: key => key } };
  globalThis.CONST = { CHAT_MESSAGE_STYLES: { OTHER: 0 } };
  globalThis.CONFIG = {
    ChatMessage: {
      documentClass: {
        async create(data) { message = data; }
      }
    }
  };

  await sendRollStatisticsToChat(
    addActionRollToStatistics(undefined, { outcome: "success", dicePool: 3 }),
    { id: "player-1", name: "Player One" }
  );

  assert.equal(message.style, CONST.CHAT_MESSAGE_STYLES.OTHER);
  assert.deepEqual(message.speaker, { alias: "Player One" });
  assert.deepEqual(message.whisper, []);
  assert.equal(message.blind, false);
  assert.equal(message.flags["brinkwood-reforged"].rollStatistics.userId, "player-1");
  assert.match(message.content, /brinkwood-roll-statistics--chat/);
  assert.match(message.content, /BITD\.RollSuccess/);
});
