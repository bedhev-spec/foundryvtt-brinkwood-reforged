import { extractPack } from "@foundryvtt/foundryvtt-cli";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { MOOT_DECISIONS, mootDecisionPackDocument } from "../module/rebellion/moot-decisions.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("LevelDB Moot pack exactly matches the canonical source dataset", async () => {
  const unpacked = await mkdtemp(path.join(tmpdir(), "brinkwood-moot-test-"));
  try {
    const packCopy = path.join(unpacked, "pack");
    const documentsDirectory = path.join(unpacked, "documents");
    await cp(path.join(root, "packs", "moot-decisions"), packCopy, { recursive: true });
    await extractPack(packCopy, documentsDirectory);
    const files = (await readdir(documentsDirectory)).filter(file => file.endsWith(".json"));
    const documents = await Promise.all(files.map(async file => JSON.parse(
      await readFile(path.join(documentsDirectory, file), "utf8"),
    )));
    documents.sort((left, right) => left.sort - right.sort);

    assert.equal(documents.length, 14);
    assert.deepEqual(
      documents,
      MOOT_DECISIONS.map((entry, index) => mootDecisionPackDocument(entry, index * 100000)),
    );
  } finally {
    await rm(unpacked, { recursive: true, force: true });
  }
});
