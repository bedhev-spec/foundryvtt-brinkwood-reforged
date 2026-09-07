import { compilePack, extractPack } from "@foundryvtt/foundryvtt-cli";
import assert from "node:assert/strict";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MOOT_DECISIONS,
  mootDecisionPackDocument,
} from "../module/rebellion/moot-decisions.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultDestination = path.join(root, "packs", "moot-decisions");

async function readExtractedDocuments(directory) {
  const files = (await readdir(directory)).filter(file => file.endsWith(".json"));
  const documents = await Promise.all(files.map(async file => JSON.parse(
    await readFile(path.join(directory, file), "utf8"),
  )));
  return documents.sort((left, right) => left.sort - right.sort);
}

export async function validateMootPack(packDirectory, workspaceDirectory) {
  const validationRoot = workspaceDirectory
    ?? await mkdtemp(path.join(path.dirname(packDirectory), ".moot-validation-"));
  const ownsValidationRoot = !workspaceDirectory;
  const packCopy = path.join(validationRoot, "pack");
  const extracted = path.join(validationRoot, "documents");

  try {
    await cp(packDirectory, packCopy, { recursive: true });
    await extractPack(packCopy, extracted);
    assert.deepEqual(
      await readExtractedDocuments(extracted),
      MOOT_DECISIONS.map((entry, index) => mootDecisionPackDocument(entry, index * 100000)),
      "compiled Moot pack differs from the canonical source dataset",
    );
  } finally {
    if (ownsValidationRoot) await rm(validationRoot, { recursive: true, force: true });
  }
}

async function promotePack(stagedPack, destination, backup) {
  let hasBackup = false;
  try {
    await rename(destination, backup);
    hasBackup = true;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  try {
    await rename(stagedPack, destination);
  } catch (error) {
    if (hasBackup) await rename(backup, destination);
    throw error;
  }

  if (hasBackup) await rm(backup, { recursive: true, force: true });
}

export async function buildMootPack({
  destination = defaultDestination,
  compile = compilePack,
} = {}) {
  const packsDirectory = path.dirname(destination);
  await mkdir(packsDirectory, { recursive: true });

  const stagingRoot = await mkdtemp(path.join(packsDirectory, ".moot-decisions-build-"));
  const source = path.join(stagingRoot, "source");
  const stagedPack = path.join(stagingRoot, "compiled");
  const validation = path.join(stagingRoot, "validation");
  const backup = path.join(stagingRoot, "previous");

  try {
    await mkdir(source);
    await mkdir(validation);
    await Promise.all(MOOT_DECISIONS.map((entry, index) => writeFile(
      path.join(source, `${entry.id}.json`),
      `${JSON.stringify(mootDecisionPackDocument(entry, index * 100000), null, 2)}\n`,
      "utf8",
    )));

    await compile(source, stagedPack, { log: true });
    await Promise.all(["LOG", "LOG.old"].map(file => (
      rm(path.join(stagedPack, file), { force: true })
    )));
    await validateMootPack(stagedPack, validation);
    await promotePack(stagedPack, destination, backup);
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) await buildMootPack();
