import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { formatPactTooltipDescription, renderItemTooltip } from "../module/item-tooltip.js";

const labels = JSON.parse(await readFile(new URL("../lang/en.json", import.meta.url), "utf8"));
const pacts = labels.Actor.Pacts;
const bulletText = html => Array.from(html.matchAll(/<li>([\s\S]*?)<\/li>/g), match => match[1]);

test("Freedom's four oath clauses each render as a separate tooltip bullet", () => {
  const tooltip = renderItemTooltip(
    { name: "Freedom", type: "pact", system: { description: pacts.Freedom } },
    key => key,
    description => formatPactTooltipDescription(`<p>${description}</p>`),
  );

  assert.deepEqual(bulletText(tooltip), [
    "to liberate,",
    "to destroy,",
    "to burn down every corrupt institution that comes before you,",
    "and to let free the raucous joy within your very soul.",
  ]);
  assert.match(tooltip, /<p>You take up the <strong>Pact of Freedom<\/strong><\/p>/);
});

test("every shipped Pact separates its coordinated declarations without losing oath text", () => {
  const counts = { Beauty: 8, Freedom: 4, Industry: 6, Justice: 4, Solidarity: 3, Vengeance: 3, Wisdom: 3 };
  for (const [name, expectedCount] of Object.entries(counts)) {
    const description = pacts[name];
    const clauses = bulletText(formatPactTooltipDescription(description));
    assert.equal(clauses.length, expectedCount, name);
    assert.equal(clauses.join(" "), description.split("</strong>, ")[1], name);
  }
});

test("Pact clauses retain internal commas, infinitives, and inline emphasis", () => {
  const description = "<p>You swear a <strong>Pact</strong>, to hone yourself into a blade ever to plunge into evil; to wait and then strike, decisively and entirely, and to <em>free the chained</em>.</p>";
  assert.deepEqual(bulletText(formatPactTooltipDescription(description)), [
    "to hone yourself into a blade ever to plunge into evil;",
    "to wait and then strike, decisively and entirely,",
    "and to <em>free the chained</em>.",
  ]);
});

test("Pact HTML entities remain inside their oath clause", () => {
  const description = "<p>You swear a <strong>Pact</strong>, to demand bread &amp; roses, to defend the child&rsquo;s hope.</p>";
  assert.deepEqual(bulletText(formatPactTooltipDescription(description)), [
    "to demand bread &amp; roses,",
    "to defend the child&rsquo;s hope.",
  ]);
});

test("generic item prose keeps its comma-separated declarations intact", () => {
  const description = "<p>A tool to create, to forge, and to build.</p>";
  const tooltip = renderItemTooltip(
    { name: "Tool", type: "item", system: { description } },
    key => key,
    value => value,
  );
  assert.match(tooltip, /<p>A tool to create, to forge, and to build\.<\/p>/);
  assert.doesNotMatch(tooltip, /<li>/);
});
