import assert from "node:assert/strict";
import test from "node:test";
import { renderActionDotSourceTooltip } from "../module/character/action-dot-tooltip.js";

const labels = {
  "BITD.ActionDots": "Action Dots",
  "Actor.Actions.Command.Name": "Command",
  "Actor.Actions.Skirmish.Name": "Skirmish",
  "Actor.Actions.Tinker.Name": "Tinker",
};
const localize = key => labels[key] ?? key;

function attributes(values = {}) {
  const skill = name => ({ value: values[name] ?? 0 });
  return {
    insight: { skills: { hunt: skill("hunt"), study: skill("study"), survey: skill("survey"), tinker: skill("tinker") } },
    prowess: { skills: { finesse: skill("finesse"), prowl: skill("prowl"), skirmish: skill("skirmish"), wreck: skill("wreck") } },
    resolve: { skills: { attune: skill("attune"), command: skill("command"), consort: skill("consort"), sway: skill("sway") } },
  };
}

test("Class tooltip combines narrative description with structured Action Dot grants", () => {
  const tooltip = renderActionDotSourceTooltip({
    name: "Commander",
    type: "class",
    system: { attributes: attributes({ command: 2, skirmish: 1 }) },
  }, "<p>First sentence. Second sentence. Third sentence.</p>", localize);

  assert.match(tooltip, /<header>Commander<\/header>/);
  assert.match(tooltip, /<p>First sentence\. Second sentence\.<\/p><p>Third sentence\.<\/p>/);
  assert.match(tooltip, /<h4>Action Dots<\/h4>/);
  assert.match(tooltip, /<li><strong>2<\/strong> Command<\/li>/);
  assert.match(tooltip, /<li><strong>1<\/strong> Skirmish<\/li>/);
  assert.doesNotMatch(tooltip, /brinkwood-item-tooltip__stats/);
});

test("Profession tooltip includes its single structured Action Dot grant", () => {
  const tooltip = renderActionDotSourceTooltip({
    name: "Alchemist",
    type: "profession",
    system: { attributes: attributes({ tinker: 1 }) },
  }, "<p>Profession narrative.</p>", localize);

  assert.match(tooltip, /<header>Alchemist<\/header>/);
  assert.match(tooltip, /<p>Profession narrative\.<\/p>/);
  assert.match(tooltip, /<li><strong>1<\/strong> Tinker<\/li>/);
});
