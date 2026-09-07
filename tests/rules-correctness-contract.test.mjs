import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("resistance and Character labels retain corrected rules wording", async () => {
  const [localizationSource, characterTemplate, attributesTemplate] = await Promise.all([
    read("lang/en.json"),
    read("templates/actor-sheet.html"),
    read("templates/parts/attributes.html"),
  ]);
  const localization = JSON.parse(localizationSource);

  assert.match(localization["BITD.RollResistanceCritical"], /0 stress/i);
  assert.doesNotMatch(localization["BITD.RollResistanceCritical"], /clear\s+1\s+stress/i);
  assert.doesNotMatch(localization["BITD.RollResistance"], /clear\s+1\s+stress/i);
  assert.equal(localization.Actor.XP.Tooltip.includes("Mask XP"), false);
  assert.match(characterTemplate, /tooltip="Actor\.XP\.Tooltip"/);
  assert.match(attributesTemplate, />\{\{localize attribute\.label\}\}<\/button>/);
});
