import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("release manifests target version 1.0.0-rc.1", async () => {
  const [manifest, testManifest] = await Promise.all(
    ["system.json", "system-test.json"].map(async file =>
      JSON.parse(await readFile(new URL(file, root), "utf8"))
    )
  );

  assert.equal(manifest.version, "1.0.0-rc.1");
  assert.equal(testManifest.version, "0.6.16");
  assert.match(manifest.manifest, /foundryvtt-brinkwood-reforged\/main\/system\.json$/);
  assert.match(manifest.download, /refs\/tags\/v1\.0\.0-rc\.1\.zip$/);
  assert.match(testManifest.manifest, /integration\/v13-follow-up\/system-test\.json$/);
  assert.match(testManifest.download, /refs\/tags\/v0\.6\.16\.zip$/);
  assert.deepEqual(testManifest.packs, manifest.packs);
});
