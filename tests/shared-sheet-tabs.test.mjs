import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function primaryTabMarkup(template, path) {
  const nav = template.match(/<nav\b[^>]*\bdata-group="primary"[^>]*>[\s\S]*?<\/nav>/);
  assert.ok(nav, `${path} must contain a primary tablist`);
  return nav[0];
}

function assertPrimaryTabContract(nav, path) {
  assert.match(nav, /\bclass="[^"]*\btabs\b[^"]*\bsheet-tabs\b[^"]*"/,
    `${path} primary tablist must use the shared sheet-tabs primitive`);
  assert.match(nav, /\brole="tablist"/,
    `${path} primary tablist must retain its tablist role`);
  assert.match(nav, /\bdata-group="primary"/,
    `${path} primary tablist must retain its primary group`);

  const buttons = [...nav.matchAll(/<button\b[^>]*>/g)].map(([button]) => button);
  assert.ok(buttons.length >= 2, `${path} primary tablist must contain tab buttons`);
  for (const button of buttons) {
    assert.match(button, /\btype="button"/);
    assert.match(button, /\bclass="[^"]*\bitem\b/);
    assert.match(button, /\bdata-action="tab"/);
    assert.match(button, /\bdata-group="primary"/);
    assert.match(button, /\bdata-tab="[^"]+"/);
    assert.match(button, /\brole="tab"/);
    assert.match(button, /\btabindex="/);
    assert.match(button, /\baria-controls="/);
    assert.match(button, /\baria-selected="/);
  }
}

test("shared tab component is the only primary tabbar visual and responsive owner", async () => {
  const [component, actorEffects, generalStyles, characterSheet, maskSheet, characterTemplate, maskTemplate,
    legacyEffects, legacyPolish] = await Promise.all([
    read("scss/import/sheet-tabs.scss"),
    read("scss/import/actor-effect-card.scss"),
    read("scss/import/general-styles.scss"),
    read("scss/import/character-sheet.scss"),
    read("scss/import/mask-sheet.scss"),
    read("templates/actor-sheet.html"),
    read("templates/mask-sheet.html"),
    read("scss/import/legacy-character-effects.scss"),
    read("scss/import/legacy-character-sheet-polish.scss"),
  ]);

  const characterNav = primaryTabMarkup(characterTemplate, "templates/actor-sheet.html");
  const maskNav = primaryTabMarkup(maskTemplate, "templates/mask-sheet.html");
  assertPrimaryTabContract(characterNav, "templates/actor-sheet.html");
  assertPrimaryTabContract(maskNav, "templates/mask-sheet.html");
  assert.doesNotMatch(characterNav, /\bflex-horizontal\b/,
    "the primary tabbar must not rely on a character-only flex utility");

  assert.match(generalStyles, /@import 'sheet-tabs\.scss';/);
  assert.match(component, /\.sheet-tabs\s*\{[\s\S]*?--bw-tab-frame:\s*#e0d7c5[\s\S]*?--bw-tab-surface:\s*#e9e2d5[\s\S]*?--bw-tab-active:\s*#f0ece3[\s\S]*?width:\s*100%[\s\S]*?background:\s*var\(--bw-tab-frame\)/);
  assert.match(component, /\.sheet-tabs \.item\s*\{[\s\S]*?flex:\s*1 1 0[\s\S]*?min-height:\s*40px[\s\S]*?padding:\s*10px 12px[\s\S]*?text-align:\s*center/);
  assert.match(component, /\.sheet-tabs \.item[\s\S]*?&\.active\s*\{[\s\S]*?border-bottom-color:\s*var\(--bw-accent\)/);
  assert.match(component, /@container \(max-width: 480px\)\s*\{[\s\S]*?\.sheet-tabs\s*\{[\s\S]*?overflow-x:\s*auto[\s\S]*?\.sheet-tabs \.item\s*\{[\s\S]*?flex:\s*0 0 auto/);

  // These selectors caught the previous late Character override and the former
  // Mask-only narrow rule. Sheet files may own panels, but not primary tabbar
  // visuals, state, sizing, or their responsive behavior.
  assert.doesNotMatch(characterSheet, /(?:^|[\s,{])(?:\.character-sheet__workspace\s*>\s*)?nav\.tabs\b/);
  assert.doesNotMatch(maskSheet, /\.mask-sheet__tabs\b/);
  assert.doesNotMatch(component, /\.sheet-panel,\s*[\s\S]*?&\.actor\.mask \.mask-sheet__panel/);

  // Mask has an active-panel-dependent intrinsic width. Its sheet geometry,
  // not the shared tab component, fixes the primary workspace to one flexible
  // column so Traits, Notes, and Effects give the tabbar the same full width.
  assert.match(maskSheet, /\.mask-sheet__main\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)[\s\S]*?justify-self:\s*stretch[\s\S]*?width:\s*100%/);
  assert.match(maskSheet, /\.mask-sheet__main\s*>\s*\.sheet-tabs\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1[\s\S]*?justify-self:\s*stretch[\s\S]*?inline-size:\s*100%[\s\S]*?max-inline-size:\s*100%/);
  assert.match(maskSheet, /\.mask-sheet__main\s*>\s*\.sheet-tab-content\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1[\s\S]*?min-width:\s*0[\s\S]*?inline-size:\s*100%/);

  assert.match(component, /\.sheet-tab-workspace\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\)/);
  assert.match(component, /\.sheet-tab-content[\s\S]*?> \.tab\.active[\s\S]*?overflow-y:\s*auto/);
  assert.doesNotMatch(component, /\.effects-tabs|\.effects-tab/);
  assert.match(actorEffects, /button\.actor-effects__tab\s*\{[\s\S]*?transition:/);
  assert.match(actorEffects, /button\.actor-effects__tab[\s\S]*?&\.active\s*\{[\s\S]*?background:/);
  assert.match(actorEffects, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(component, /\.effects-category\[data-effect-panel\]/);
  assert.doesNotMatch(component, /grid-template-columns/);
  assert.doesNotMatch(legacyEffects, /\.effects-tabs|\.effects-tab/);
  assert.doesNotMatch(legacyPolish, /character-sheet__workspace nav\.tabs \.item\.active/);
});
