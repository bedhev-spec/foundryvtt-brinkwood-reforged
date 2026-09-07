import assert from "node:assert/strict";
import test from "node:test";

import { encumbranceLevelForLoadout, hasMuleAbility } from "../module/encumbrance.js";

test("encumbrance policy maps every bounded load with and without Mule", () => {
  const standard = [
    "BITD.Light", "BITD.Light", "BITD.Light", "BITD.Light",
    "BITD.Normal", "BITD.Normal", "BITD.Heavy", "BITD.Heavy",
    "BITD.Encumbered", "BITD.Encumbered", "BITD.Encumbered",
  ];
  const mule = [
    "BITD.Light", "BITD.Light", "BITD.Light", "BITD.Light",
    "BITD.Light", "BITD.Light", "BITD.Normal", "BITD.Normal",
    "BITD.Heavy", "BITD.Encumbered", "BITD.OverMax",
  ];

  for (let loadout = 0; loadout <= 10; loadout += 1) {
    assert.equal(encumbranceLevelForLoadout(loadout, false), standard[loadout]);
    assert.equal(encumbranceLevelForLoadout(loadout, true), mule[loadout]);
  }
});

test("encumbrance policy keeps Brinkwood's thresholds and exposes overload", () => {
  const boundaries = [
    [3, "BITD.Light"],
    [4, "BITD.Normal"],
    [5, "BITD.Normal"],
    [6, "BITD.Heavy"],
    [7, "BITD.Heavy"],
    [8, "BITD.Encumbered"],
    [10, "BITD.Encumbered"],
    [11, "BITD.OverMax"],
  ];

  for (const [loadout, expected] of boundaries) {
    assert.equal(encumbranceLevelForLoadout(loadout, false), expected);
  }
});

test("encumbrance policy preserves caller clamping and Mule detection", () => {
  assert.equal(encumbranceLevelForLoadout(-1, false), "BITD.Light");
  assert.equal(encumbranceLevelForLoadout(11, true), "BITD.OverMax");
  assert.equal(encumbranceLevelForLoadout(Number.NaN, false), undefined);
  assert.equal(hasMuleAbility([{ type: "ability", name: "(C) Mule" }]), true);
  assert.equal(hasMuleAbility([{ type: "ability", name: "Mule" }]), false);
});
