import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("release manifests target version 1.0.0-rc.2", async () => {
  const [manifest, testManifest] = await Promise.all(
    ["system.json", "system-test.json"].map(async file =>
      JSON.parse(await readFile(new URL(file, root), "utf8"))
    )
  );

  assert.equal(manifest.version, "1.0.0-rc.2");
  assert.equal(testManifest.version, "0.6.16");
  assert.match(manifest.manifest, /foundryvtt-brinkwood-reforged\/main\/system\.json$/);
  assert.match(manifest.download, /refs\/tags\/v1\.0\.0-rc\.2\.zip$/);
  assert.match(testManifest.manifest, /integration\/v13-follow-up\/system-test\.json$/);
  assert.match(testManifest.download, /refs\/tags\/v0\.6\.16\.zip$/);
  assert.deepEqual(testManifest.packs, manifest.packs);
});

test("release package publishes the required Brinkwood SRD attribution", async () => {
  const [manifest, readme] = await Promise.all([
    readFile(new URL("system.json", root), "utf8").then(JSON.parse),
    readFile(new URL("README.md", root), "utf8"),
  ]);
  const requiredCreditText = [
    "Erik Bernhardt and Far Horizons Co-Op",
    "Creative Commons Attribution 4.0 License",
    "One Seven Design, developed and authored by John Harper",
    "Creative Commons Attribution 3.0 Unported license",
  ];

  for (const text of requiredCreditText) {
    assert.ok(manifest.description.includes(text), `system.json description must include: ${text}`);
    assert.ok(readme.includes(text), `README.md must include: ${text}`);
  }
  assert.match(manifest.description, /creativecommons\.org\/licenses\/by\/4\.0\//);
  assert.match(manifest.description, /creativecommons\.org\/licenses\/by\/3\.0\//);
  assert.match(readme, /\[Brinkwood: The Blood of Tyrants\]\(https:\/\/www\.brinkwood\.net\)/);
  assert.match(readme, /\[Blades in the Dark\]\(http:\/\/www\.bladesinthedark\.com\/\)/);
});
