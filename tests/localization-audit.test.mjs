import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("user-visible audit strings are localized in every supported locale", async () => {
  const [manifest, actorSheet, effects, actorEffects, traitCard, rebelionSheet, aspectSection, seditionSection, rollModule, systemModule] = await Promise.all([
    read("system.json"),
    read("templates/actor-sheet.html"),
    read("templates/parts/active-effects.html"),
    read("templates/parts/actor-active-effects.html"),
    read("templates/parts/actor/trait-card.html"),
    read("templates/rebelion-sheet.html"),
    read("templates/rebelion-sheet/aspect-section.html"),
    read("templates/rebelion-sheet/sedition-section.html"),
    read("module/blades-roll.js"),
    read("module/blades.js")
  ]);
  const keys = [
    "Attributes", "DiceRoll", "SimpleRoll", "EffectTypes",
    "EffectTemporary", "EffectPassive", "EffectInactive", "EffectSuppressed",
    "Purchased", "RemoveTrait", "RebellionStatus", "Progress", "Decision",
    "Sedition", "Level", "RebellionSections", "Overview", "Aspects", "Tyranny",
    "Towns", "Villages", "Lands"
  ];
  const system = JSON.parse(manifest);
  const locales = await Promise.all(system.languages.map(async language => [
    language.lang,
    JSON.parse(await read(language.path))
  ]));

  for (const [language, locale] of locales) {
    for (const key of keys) {
      assert.equal(typeof locale[`BITD.${key}`], "string", `${language}: BITD.${key}`);
      assert.ok(locale[`BITD.${key}`].trim(), `${language}: BITD.${key}`);
    }
  }

  assert.match(actorSheet, /aria-label="\{\{localize "BITD\.Attributes"\}\}"/);
  assert.match(effects, /localize "BITD\.EffectTypes"/);
  assert.match(actorEffects, /localize "BITD\.EffectTypes"/);
  assert.match(effects, /localize "BITD\.EffectCreate"/);
  assert.match(traitCard, /localize "BITD\.Purchased"/);
  assert.match(traitCard, /localize "BITD\.RemoveTrait"/);
  assert.match(rebelionSheet, /localize "BITD\.RebellionStatus"/);
  assert.match(rebelionSheet, /localize "BITD\.(RebellionStatus|Aspects|Tyranny|Heat)"/);
  assert.match(aspectSection, /localize "BITD\.(Progress|Decision)"/);
  assert.match(seditionSection, /localize "BITD\.(Sedition|Level)"/);
  assert.match(rollModule, /game\.i18n\.localize\("BITD\.SimpleRoll"\)/);
  assert.match(systemModule, /game\.i18n\.localize\("BITD\.DiceRoll"\)/);
});

test("user-visible audit typos and malformed Spoil markup remain fixed", async () => {
  const [locale, effects] = await Promise.all([read("lang/en.json"), read("module/blades-active-effect.js")]);
  const parsed = JSON.parse(locale);

  assert.match(parsed.Mask.Actions.Spoil.Description, /within\.<ul><li>/);
  assert.match(parsed.Mask.Actions.Spoil.Description, /<\/li><\/ul>$/);
  assert.doesNotMatch(parsed.Mask.Actions.Spoil.Description, /Ő/);
  assert.equal(parsed["BITD.RollFailurePositionRisky"].includes("</strong>, a <strong>complication</strong>"), true);
  assert.equal(parsed["BITD.Uses"], "Number of uses");
  assert.equal(parsed["BITD.Encumbered"], "Encumbered");
  assert.equal(parsed["BITD.OverMax"], "Over capacity");
  for (const typo of ["welltimed", "wouldbe", "a pull keyring", "No. of Uses", "over max"]) {
    assert.doesNotMatch(locale, new RegExp(typo));
  }
  for (const key of ["Temporary", "Passive", "Inactive", "Suppressed"]) {
    assert.match(effects, new RegExp(`game\\.i18n\\.localize\\("BITD\\.Effect${key}"\\)`));
  }
});
