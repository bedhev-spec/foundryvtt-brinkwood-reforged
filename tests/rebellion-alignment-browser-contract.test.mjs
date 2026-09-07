import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Rebellion browser fixture owns footer and actor-row geometry regressions", async () => {
  const [manifestSource, html, source] = await Promise.all([
    read("tests/browser/manifest.json"),
    read("tests/browser/rebellion-alignment-fixture.html"),
    read("tests/browser/rebellion-alignment-fixture.mjs"),
  ]);
  const manifest = JSON.parse(manifestSource);
  const fixture = manifest.geometryFixtures.find(entry => entry.path === "tests/browser/rebellion-alignment-fixture.html");

  assert.equal(fixture?.resultElement, "#rebellion-alignment-results");
  assert.match(html, /href="\.\.\/\.\.\/styles\/blades\.css"/);
  assert.match(html, /data-width="900" data-aspect-case/);
  assert.match(html, /data-width="700" data-aspect-case/);
  assert.match(html, /data-width="460" data-row-case/);
  assert.match(html, /rebelion-aspect-summary__footer/);
  assert.match(html, /rebelion-underground__actor-resource-label/);
  assert.match(source, /aspectGridUsesThreeThenTwoColumns/);
  assert.match(source, /nextMootFootersShareRowBaseline/);
  assert.match(source, /actorNamesAndResourcesShareVerticalCenter/);
  assert.match(source, /resourceColumnsStayAnchoredAtRowEnd/);
  assert.match(source, /longNamesEllipsizeWithoutMovingResource/);
  assert.match(source, /actorGroupsUseTwoThenOneColumn/);
  assert.match(source, /output\.dataset\.status/);
});
