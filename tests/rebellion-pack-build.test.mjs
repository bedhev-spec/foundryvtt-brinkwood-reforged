import { compilePack, extractPack } from "@foundryvtt/foundryvtt-cli";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { buildMootPack } from "../scripts/build-moot-pack.mjs";

async function extractDocumentsWithoutOpeningSource(packDirectory, workspace, label) {
  const packCopy = path.join(workspace, `${label}-pack`);
  const documentsDirectory = path.join(workspace, `${label}-documents`);
  await cp(packDirectory, packCopy, { recursive: true });
  await extractPack(packCopy, documentsDirectory);
  const files = (await readdir(documentsDirectory)).filter(file => file.endsWith(".json"));
  const documents = await Promise.all(files.map(async file => JSON.parse(
    await readFile(path.join(documentsDirectory, file), "utf8"),
  )));
  return documents.sort((left, right) => left.sort - right.sort);
}

test("failed staged Moot build preserves the existing valid destination", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "brinkwood-moot-build-failure-"));
  const destination = path.join(workspace, "packs", "moot-decisions");
  try {
    await buildMootPack({ destination });
    const before = await extractDocumentsWithoutOpeningSource(destination, workspace, "before");

    await assert.rejects(
      buildMootPack({
        destination,
        compile: async (source, stagedPack, options) => {
          await compilePack(source, stagedPack, options);
          throw new Error("injected compile failure");
        },
      }),
      /injected compile failure/,
    );

    const after = await extractDocumentsWithoutOpeningSource(destination, workspace, "after");
    assert.deepEqual(after, before);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("repeated staged Moot builds are semantically deterministic", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "brinkwood-moot-build-repeat-"));
  const destination = path.join(workspace, "packs", "moot-decisions");
  try {
    await buildMootPack({ destination });
    const first = await extractDocumentsWithoutOpeningSource(destination, workspace, "first");
    await buildMootPack({ destination });
    const second = await extractDocumentsWithoutOpeningSource(destination, workspace, "second");
    assert.deepEqual(second, first);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
