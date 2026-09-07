import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  clearMootDecisionCatalogueCache,
  getMootDecisionCatalogue,
  normalizeMootDecision,
} from "../module/rebellion/moot-catalogue.js";
import { MOOT_DECISIONS, mootDecisionPackDocument } from "../module/rebellion/moot-decisions.js";

const EXPECTED_TITLES = [
  "Safehouses or Refuges", "Tall or Wide", "Lines or Smugglers", "Property and Compensation", "Law and Order",
  "Guerrillas or Partisans", "Powder or Ash", "Vanguards and Lieutenants", "Sickness and Disease", "Rustcoats and Deserters",
  "The Quill or the Silver", "Rumors or Facts", "Servants or Scampers", "Wisps and Treachery",
];

// SHA-256 over title, aspect, rank, choices, and the verbatim description,
// audited directly against PDF pages 100–102 (printed pages 90–92).
const SOURCE_PDF_SHA256 = {
  MootOrgSafeRef01: "b91b6403f6129ac429d29638ef05e304e5b8126c8f4decf4f7ab0c27a1fcbc16",
  MootOrgTallWide1: "9a2eaf0f70f6bd50294793bf2a0daf5803b92cd8095b4ebb8e0136d8e0455354",
  MootOrgLineSmg01: "293bf04795ca752bd93967352d044404902768feba7d8ac5b629fb68d7ff14ad",
  MootOrgPropComp1: "f72b34dcaff2ab76803b0d3e0b02bad600de983f930c3c6b321084b781b8fcae",
  MootOrgLawOrder1: "69d00d3c6fbc09bd3ad6ac9965043994ef5c28275323abaed35fa1cb24713b14",
  MootFrcGuerPart1: "f4c432c348a3ad51ce79783a3dbecb86018dc0cd9111f17f06612901d7246ffd",
  MootFrcPowdAsh01: "6045807c7ed1c8c4037779c00bf52cbdc908a3a5fa62bbc387ff73a8abf6ac08",
  MootFrcVangLieu1: "e73050674fd37a9e40a173866eb8c9a94b3c3b0d3cdc8fff4246cfae9defbf00",
  MootFrcSickDise1: "4dadd38ac4517c3c41ae7acb53919f10ffc411ad3f425e8bfb2cd5a70daee849",
  MootFrcRustDese1: "fac61faaa88cc9f339134df8a9d546a5b30d2e4463ad357d16c66bd98b02312d",
  MootInfQuilSilv1: "48783d8ce8ed9d322663bc8931cfe789f5dc98a2cb6abf7dc73432303d068b7f",
  MootInfRumoFact1: "65ece71ffd76bc00c21c5ab8b09ce57f9d360181373120b43f88591c427b09fa",
  MootInfServScam1: "96a6e1c6e79d5444651fae9c6feef0b4f328dd8b33d7b54d60817d5d93fa4901",
  MootInfWispTrea1: "9871c1924ce674c584a55bbb56ae8d0aa2d4d306bcd14632ecf24aadf03d4106",
};

test("canonical Moot data has exactly the audited counts, ranks, and titles", () => {
  assert.equal(MOOT_DECISIONS.length, 14);
  assert.deepEqual(MOOT_DECISIONS.map(entry => entry.title), EXPECTED_TITLES);
  assert.deepEqual(
    Object.fromEntries(["Organization", "Force", "Influence"].map(aspect => [
      aspect,
      MOOT_DECISIONS.filter(entry => entry.aspect === aspect).map(entry => entry.rank),
    ])),
    { Organization: [1, 1, 2, 2, 3], Force: [1, 1, 2, 2, 3], Influence: [1, 2, 2, 3] },
  );
  assert.equal(new Set(MOOT_DECISIONS.map(entry => entry.id)).size, 14);
  assert.ok(MOOT_DECISIONS.every(entry => /^[A-Za-z0-9]{16}$/.test(entry.id)));
});

test("canonical Moot text matches the source-PDF byte audit", () => {
  for (const entry of MOOT_DECISIONS) {
    const content = [entry.title, entry.aspect, entry.rank, entry.choices.join("|"), entry.description].join("\n");
    assert.equal(
      createHash("sha256").update(content, "utf8").digest("hex"),
      SOURCE_PDF_SHA256[entry.id],
      entry.title,
    );
  }
});

test("missing and failed packs use fresh canonical fallback records", async () => {
  clearMootDecisionCatalogueCache();
  const missing = await getMootDecisionCatalogue({ packs: new Map() });
  assert.equal(missing.status, "missing");
  assert.deepEqual(missing.entries.map(entry => entry.title), EXPECTED_TITLES);
  assert.ok(missing.entries.every(entry => entry.sourceUuid === `Compendium.brinkwood-reforged.moot-decisions.${entry.id}`));

  clearMootDecisionCatalogueCache();
  const originalError = console.error;
  console.error = () => {};
  try {
    const failed = await getMootDecisionCatalogue({
      packs: new Map([["brinkwood-reforged.moot-decisions", {
        collection: "brinkwood-reforged.moot-decisions",
        getIndex: async () => { throw new Error("offline"); },
      }]]),
    });
    assert.equal(failed.status, "error");
    assert.deepEqual(failed.entries, missing.entries);
  } finally {
    console.error = originalError;
  }
});

test("Moot adapter caches the canonical-only pack index", async () => {
  clearMootDecisionCatalogueCache();
  let indexCalls = 0;
  let requestedFields;
  const index = MOOT_DECISIONS.map((entry, position) => {
    const { _key, ...document } = mootDecisionPackDocument(entry, position * 100000);
    return document;
  });
  const pack = {
    collection: "brinkwood-reforged.moot-decisions",
    async getIndex({ fields }) {
      indexCalls += 1;
      requestedFields = fields;
      return [...index].reverse();
    },
    async getDocuments() { throw new Error("must not load all documents"); },
  };
  const game = { packs: new Map([["brinkwood-reforged.moot-decisions", pack]]) };

  const [first, second] = await Promise.all([getMootDecisionCatalogue(game), getMootDecisionCatalogue(game)]);
  assert.equal(indexCalls, 1);
  assert.deepEqual(requestedFields, ["system.aspect", "system.rank", "system.description", "system.choice"]);
  assert.equal(first.status, "ready");
  assert.deepEqual(first.entries.map(entry => entry.title), EXPECTED_TITLES);
  assert.strictEqual(first, second);
});

test("Moot normalization accepts only the canonical choice object", () => {
  const canonical = normalizeMootDecision({
    _id: "MootFrcPowdAsh01",
    name: "Powder or Ash",
    system: { aspect: "Force", rank: 1, choice: { 0: "Powder", 1: "Ash" } },
  });
  assert.deepEqual(canonical.choices, ["Powder", "Ash"]);

  const noncanonical = normalizeMootDecision({
    _id: "noncanonical-shape",
    name: "Noncanonical shape",
    system: { choice: ["First", "Second"] },
  });
  assert.deepEqual(noncanonical.choices, []);
});
