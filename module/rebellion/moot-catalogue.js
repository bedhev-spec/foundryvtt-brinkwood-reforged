import { MOOT_DECISIONS } from "./moot-decisions.js";

let cachedPack;
let cachedPromise;

class MootCatalogueIntegrityError extends Error {}

function canonicalFallback(packId = "brinkwood-reforged.moot-decisions") {
  return MOOT_DECISIONS.map(entry => ({
    ...entry,
    choices: [...entry.choices],
    description: `<p>${entry.description}</p>`,
    sourceUuid: `Compendium.${packId}.${entry.id}`,
  }));
}

export function normalizeMootDecision(source, packId = "brinkwood-reforged.moot-decisions") {
  const system = source?.system ?? {};
  const id = source?._id ?? source?.id;
  const choice = system.choice && !Array.isArray(system.choice) ? system.choice : {};
  return {
    id,
    title: source?.name ?? "Untitled decision",
    aspect: system.aspect ?? "",
    rank: Number(system.rank) || 0,
    choices: [choice[0], choice[1]].filter(Boolean),
    description: system.description ?? "",
    sourceUuid: source?.uuid ?? (id ? `Compendium.${packId}.${id}` : ""),
  };
}

function sortCatalogue(entries) {
  const order = new Map(MOOT_DECISIONS.map((entry, index) => [entry.id, index]));
  return entries.sort((left, right) => (order.get(left.id) ?? Number.MAX_SAFE_INTEGER)
    - (order.get(right.id) ?? Number.MAX_SAFE_INTEGER));
}

function assertCanonicalCatalogue(entries) {
  const canonicalById = new Map(MOOT_DECISIONS.map(entry => [entry.id, entry]));
  const seen = new Set();

  if (entries.length !== MOOT_DECISIONS.length) {
    throw new MootCatalogueIntegrityError(
      `Expected ${MOOT_DECISIONS.length} Moot decisions, received ${entries.length}`,
    );
  }

  for (const entry of entries) {
    if (!entry.id || seen.has(entry.id)) {
      throw new MootCatalogueIntegrityError(
        `Duplicate or missing Moot decision id: ${entry.id ?? "<missing>"}`,
      );
    }
    seen.add(entry.id);

    const canonical = canonicalById.get(entry.id);
    if (!canonical) throw new MootCatalogueIntegrityError(`Unknown Moot decision id: ${entry.id}`);

    const expected = {
      title: canonical.title,
      aspect: canonical.aspect,
      rank: canonical.rank,
      choices: [...canonical.choices],
      description: `<p>${canonical.description}</p>`,
    };
    const actual = {
      title: entry.title,
      aspect: entry.aspect,
      rank: entry.rank,
      choices: entry.choices,
      description: entry.description,
    };
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new MootCatalogueIntegrityError(
        `Moot decision does not match canonical source: ${entry.id}`,
      );
    }
  }

  if (seen.size !== canonicalById.size) {
    throw new MootCatalogueIntegrityError(
      "Moot decision pack does not contain the canonical id set",
    );
  }
}

async function readPack(pack) {
  const index = await pack.getIndex({
    fields: ["system.aspect", "system.rank", "system.description", "system.choice"],
  });
  const sources = Array.from(index ?? []);
  for (const source of sources) {
    const sourceId = source?._id ?? source?.id;
    const canonical = MOOT_DECISIONS.find(entry => entry.id === sourceId);
    const choice = source?.system?.choice;
    if (!choice || Array.isArray(choice)
      || JSON.stringify(Object.keys(choice).sort()) !== JSON.stringify(["0", "1"])) {
      throw new MootCatalogueIntegrityError(
        `Moot decision has a noncanonical choice shape: ${sourceId ?? "<missing>"}`,
      );
    }
    if (canonical && source?.system?.rank !== canonical.rank) {
      throw new MootCatalogueIntegrityError(
        `Moot decision has a noncanonical rank: ${sourceId}`,
      );
    }
  }
  const entries = sortCatalogue(sources.map(
    entry => normalizeMootDecision(entry, pack.collection ?? "brinkwood-reforged.moot-decisions"),
  ));
  assertCanonicalCatalogue(entries);
  return entries;
}

export async function getMootDecisionCatalogue(gameRef = globalThis.game) {
  const pack = gameRef?.packs?.get?.("brinkwood-reforged.moot-decisions")
    ?? Array.from(gameRef?.packs ?? []).find(candidate => candidate?.metadata?.name === "moot-decisions");
  if (!pack) return { entries: canonicalFallback(), status: "missing", error: null };
  if (pack === cachedPack && cachedPromise) return cachedPromise;

  cachedPack = pack;
  cachedPromise = readPack(pack)
    .then(entries => ({ entries, status: "ready", error: null }))
    .catch(error => {
      console.error("Brinkwood moot-decision catalogue failed", error);
      const fallback = {
        entries: canonicalFallback(pack.collection),
        status: error instanceof MootCatalogueIntegrityError ? "fallback" : "error",
        error,
      };
      if (cachedPack === pack) {
        cachedPack = undefined;
        cachedPromise = undefined;
      }
      return fallback;
    });
  return cachedPromise;
}

export function clearMootDecisionCatalogueCache() {
  cachedPack = undefined;
  cachedPromise = undefined;
}
