import assert from "node:assert/strict";
import test from "node:test";

import {
  clearMootDecisionCatalogueCache,
  getMootDecisionCatalogue,
} from "../module/rebellion/moot-catalogue.js";
import {
  MOOT_DECISIONS,
  mootDecisionPackDocument,
} from "../module/rebellion/moot-decisions.js";

const PACK_ID = "brinkwood-reforged.moot-decisions";

function canonicalIndex() {
  return MOOT_DECISIONS.map((entry, index) => {
    const { _key, ...document } = mootDecisionPackDocument(entry, index * 100000);
    return document;
  });
}

async function loadIndex(index) {
  clearMootDecisionCatalogueCache();
  return getMootDecisionCatalogue({
    packs: new Map([[PACK_ID, {
      collection: PACK_ID,
      async getIndex() {
        return index;
      },
    }]]),
  });
}

function assertCanonicalFallback(result) {
  assert.equal(result.status, "fallback");
  assert.ok(result.error instanceof Error);
  assert.deepEqual(
    result.entries,
    MOOT_DECISIONS.map(entry => ({
      ...entry,
      choices: [...entry.choices],
      description: `<p>${entry.description}</p>`,
      sourceUuid: `Compendium.${PACK_ID}.${entry.id}`,
    })),
  );
}

test("Moot catalogue rejects partial, unknown, duplicate, and malformed pack indexes", async () => {
  const canonical = canonicalIndex();
  const cases = {
    partial: canonical.slice(0, -1),
    unknown: canonical.map((entry, index) => (
      index === canonical.length - 1 ? { ...entry, _id: "MootUnknown00001" } : entry
    )),
    duplicate: canonical.map((entry, index) => (
      index === canonical.length - 1 ? { ...entry, _id: canonical[0]._id } : entry
    )),
    "wrong title": canonical.map((entry, index) => (
      index === 0 ? { ...entry, name: `${entry.name}!` } : entry
    )),
    "wrong aspect": canonical.map((entry, index) => (
      index === 0 ? { ...entry, system: { ...entry.system, aspect: "Force" } } : entry
    )),
    "wrong rank": canonical.map((entry, index) => (
      index === 0
        ? { ...entry, system: { ...entry.system, rank: String(entry.system.rank) } }
        : entry
    )),
    "wrong choices": canonical.map((entry, index) => (
      index === 0
        ? { ...entry, system: { ...entry.system, choice: { 0: "Wrong", 1: "Refuges" } } }
        : entry
    )),
    "wrong description": canonical.map((entry, index) => (
      index === 0
        ? { ...entry, system: { ...entry.system, description: "<p>Wrong</p>" } }
        : entry
    )),
    "malformed choices": canonical.map((entry, index) => (
      index === 0
        ? {
          ...entry,
          system: {
            ...entry.system,
            choice: { ...entry.system.choice, 2: "Legacy alias" },
          },
        }
        : entry
    )),
  };

  const originalError = console.error;
  console.error = () => {};
  try {
    for (const [label, index] of Object.entries(cases)) {
      const result = await loadIndex(index);
      assertCanonicalFallback(result);
      assert.match(result.error.message, /Moot|Expected|Duplicate|Unknown/, label);
    }
  } finally {
    console.error = originalError;
    clearMootDecisionCatalogueCache();
  }
});
