import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("the evolved character sheet is the only registered character sheet", async () => {
  const [registration, controller] = await Promise.all([
    read("module/blades.js"),
    read("module/blades-actor-sheet.js"),
  ]);

  assert.match(registration, /registerSheet\(foundry\.documents\.Actor, "brinkwood-reforged", BladesActorSheet,/);
  assert.match(registration, /label: "Brinkwood Character Sheet"/);
  assert.doesNotMatch(registration, /BladesActorSheetV2|character-v2|actor-sheet-v2/);
  assert.doesNotMatch(controller, /_isLegacyCharacterSheet|character-v2/);

  for (const removed of [
    "module/blades-actor-sheet-v2.js",
    "templates/actor-sheet-v2.html",
    "scss/import/character-sheet-v2.scss",
  ]) {
    await assert.rejects(access(new URL(removed, root)));
  }
});

test("Character prepares every shared identity row consumed by its template", async () => {
  const [controller, template] = await Promise.all([
    read("module/blades-actor-sheet.js"),
    read("templates/actor-sheet.html"),
  ]);

  assert.match(template, /\{\{#each identityRows as \|row\|\}\}/);
  for (const [itemType, label] of [
    ["upbringing", "BITD.Upbringing"],
    ["profession", "BITD.Profession"],
    ["class", "BITD.Class"],
    ["pact", "BITD.Pact"],
  ]) {
    assert.match(controller, new RegExp(`itemType: "${itemType}", label: "${label}"`));
  }
  assert.match(controller, /context\.identityRows = identityDefinitions\.map/);
  assert.match(controller, /item: context\.items\.find\(item => item\.type === itemType\) \?\? null/);
});

test("Character sheet delegates encumbrance policy to the shared calculation", async () => {
  const controller = await read("module/blades-actor-sheet.js");

  assert.match(controller, /from "\.\/encumbrance\.js"/);
  assert.match(controller, /encumbranceLevelForLoadout\(loadout, hasMuleAbility\(context\.items\)\)/);
  assert.doesNotMatch(controller, /const load_level\s*=/);
  assert.doesNotMatch(controller, /\(C\) Mule/);
});

test("Character and Mask share trait-like Effect cards with markup-independent controls", async () => {
  const [template, manager, sourceStyles, compiledStyles] = await Promise.all([
    read("templates/parts/actor-active-effects.html"),
    read("module/blades-active-effect.js"),
    read("scss/import/actor-effect-card.scss"),
    read("styles/blades.css"),
  ]);

  assert.match(template, /<section class="actor-effects__category" data-effect-type=/);
  assert.match(template, /class="effect-control actor-effects__add" data-effect-action="create"/);
  assert.match(template, /<article class="actor-effect-card bw-ruled-card/);
  assert.match(template, /class="actor-effect-card__header bw-ruled-card__title-band"/);
  assert.match(template, /class="actor-effect-card__title bw-ruled-card__title"/);
  assert.match(template, /data-effect-action="toggle"[\s\S]*?data-effect-action="edit"[\s\S]*?data-effect-action="delete"/);
  assert.doesNotMatch(template, /type="checkbox"/);
  assert.doesNotMatch(template, /<table|<thead|<tr/);
  assert.match(manager, /closest\("\[data-effect-id\]"\)/);
  assert.match(manager, /closest\("\[data-effect-type\]"\)/);
  assert.match(manager, /suppressed:\s*\{[\s\S]*?canCreate: false/);
  assert.match(template, /\{\{#if section\.canCreate\}\}/);
  assert.match(template, /\{\{#if \.\.\/\.\.\/editable\}\}[\s\S]*?data-effect-action="toggle"[\s\S]*?\{\{\/if\}\}/);
  assert.match(sourceStyles, /button\.actor-effects__add\s*\{[\s\S]*?border-left:\s*5px solid var\(--bw-accent\)/);
  assert.match(sourceStyles, /\.actor-effect-card__header\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto/);
  assert.match(sourceStyles, /\.actor-effect-card__summary\s*\{[\s\S]*?border-bottom:\s*1px solid var\(--bw-rule\)/);
  assert.match(compiledStyles, /\.brinkwood \.actor-effect-card__metadata/);
});

test("character traits are static purchased cards", async () => {
  const [template, controller] = await Promise.all([
    read("templates/actor-sheet.html"),
    read("module/blades-sheet.js"),
  ]);

  const traitsStart = template.indexOf('<div id="character-{{_id}}-traits-list">');
  const loadoutStart = template.indexOf('id="character-{{_id}}-loadout"');
  const traitMarkup = template.slice(traitsStart, loadoutStart);
  assert.match(traitMarkup, /parts\/actor\/trait-card\.html/);
  assert.match(traitMarkup, /canDelete=trait\.canDelete/);
  assert.doesNotMatch(traitMarkup, /data-effect-|effect-control|<details|item-add-popup|<img/);
  assert.doesNotMatch(traitMarkup, /\{\{#if \.\.\/isGM\}\}|trait\.flags\.brinkwood\.traitGrant/);
  assert.doesNotMatch(traitMarkup, /parts\/attributes\.html/);
  assert.equal((template.match(/parts\/attributes\.html/g) ?? []).length, 1);
  assert.ok(template.indexOf('<section class="character-attributes" aria-label="Attributes">') < template.indexOf('id="character-{{_id}}-bans-armor"'));
assert.match(controller, /html\.querySelectorAll\("\.trait-card__purchase"\)[\s\S]*?_onTraitPurchaseChange/);
  assert.match(controller, /async _onTraitPurchaseChange\(event\)[\s\S]*?const purchased = Boolean\(control\.checked\)[\s\S]*?queueDocumentPathUpdate\(item, path,[\s\S]*?control\.checked = Boolean\(foundry\.utils\.getProperty\(item, path\)\)/);
});

test("every Brinkwood sheet uses the shared parchment texture", async () => {
  const styles = await read("scss/import/general-styles.scss");

  assert.match(styles, /\.window-content\s*\{[\s\S]*?url\("assets\/textures\/parchment-grain-sage-v4\.png"\)/);
  await access(new URL("styles/assets/textures/parchment-grain-sage-v4.png", root));
});

test("Bans level two has stable neutral emphasis without row focus coloring", async () => {
  const [template, styles] = await Promise.all([
    read("templates/actor-sheet.html"),
    read("scss/import/character-sheet.scss"),
  ]);

  assert.match(template, /<tr data-ban-level="3">/);
  assert.match(template, /<tr data-ban-level="2">/);
  assert.match(template, /<tr data-ban-level="1">/);
  assert.match(styles, /tbody tr \+ tr > td\s*\{[\s\S]*?border-top:\s*1px solid rgba\(141, 98, 93, 0\.5\)/);
  assert.doesNotMatch(styles, /tbody tr\[data-ban-level="2"\][\s\S]*?background:/);
  assert.doesNotMatch(styles, /character-bans[\s\S]*?tr:focus-within/);
});

test("Character owns visible keyboard focus and keeps the black input cue", async () => {
  const [source, polish, compiled] = await Promise.all([
    read("scss/import/character-sheet.scss"),
    read("scss/import/legacy-character-sheet-polish.scss"),
    read("styles/blades.css"),
  ]);

  assert.match(source, /form\.actor-sheet input\[type="text"\]:focus\s*\{[\s\S]*?border-color:\s*#191813;[\s\S]*?box-shadow:\s*0 0 0 1px rgba\(25, 24, 19, 0\.25\);/);
  assert.match(source, /form\.actor-sheet input\[type="text"\]:focus:not\(:focus-visible\)\s*\{\s*outline:\s*0;/);
  assert.match(source, /input\[type="text"\],[\s\S]*?select,[\s\S]*?textarea\s*\{[\s\S]*?&:focus-visible\s*\{[\s\S]*?border-color:\s*var\(--bw-ink\);[\s\S]*?outline:\s*0;[\s\S]*?box-shadow:\s*0 0 0 1px rgba\(25, 24, 19, 0\.25\);/);
  assert.doesNotMatch(polish, /:focus/);
  assert.doesNotMatch(polish, /name-alias \.portrait/);
  assert.match(compiled, /\.brinkwood\.actor\.pc\.character form\.actor-sheet input\[type=text\]:focus:not\(:focus-visible\)\s*\{\s*outline:\s*0;/);
  const controlFocus = compiled.match(/\.brinkwood\.actor\.pc\.character input\[type=text\]:focus-visible,[\s\S]*?\.brinkwood\.actor\.pc\.character textarea:focus-visible\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(controlFocus, /border-color:\s*var\(--bw-ink\)/);
  assert.match(controlFocus, /outline:\s*0/);
  assert.doesNotMatch(controlFocus, /--bw-focus/);
});

test("Character tabs retain a valid selection and contain Downtime within the fixed sheet width", async () => {
  const [controller, styles, tabStyles, compiled] = await Promise.all([
    read("module/blades-actor-sheet.js"),
    read("scss/import/character-sheet.scss"),
    read("scss/import/sheet-tabs.scss"),
    read("styles/blades.css"),
  ]);

  assert.match(controller, /_ensureValidPrimaryTab\(context\)[\s\S]*?validTabs = \["traits", "loadout", "character-notes", "downtime"\]/);
  assert.match(controller, /if \(validTabs\.includes\(this\.tabGroups\.primary\)\) return;/);
  assert.match(controller, /this\.tabGroups\.primary = "traits";[\s\S]*?context\.tabs\.primary = "traits";/);
  assert.doesNotMatch(styles, /character-sheet__workspace:has\(\.tab\[data-tab="downtime"\]\.active\)/);
  assert.match(styles, /\.tab\[data-tab\]\s*\{[^}]*?min-height:\s*0/);
  assert.match(styles, /form\.actor-sheet\s*\{[\s\S]*?width:\s*100%[\s\S]*?min-width:\s*0[\s\S]*?max-width:\s*100%/);
  assert.match(styles, /\.downtime-actions\s*\{[\s\S]*?width:\s*100%[\s\S]*?min-width:\s*0/);
  assert.match(styles, /\.tab\.downtime\s*\{[\s\S]*?max-width:\s*100%/);
  assert.doesNotMatch(styles, /\.downtime-action\s*\{[^}]*border(?:-left)?:/);
  assert.doesNotMatch(styles, /\.tab\.downtime,[\s\S]*?\.downtime-action\s*\{[\s\S]*?border-left/);
  assert.doesNotMatch(styles, /\.downtime-action\s*\{[^}]*(?:padding|font-family|overflow-wrap):/);
  assert.match(styles, /\.window-content\s*\{[^}]*overflow-y:\s*hidden/);
  assert.match(styles, /character-sheet__workspace > \.tab-content\s*\{[\s\S]*?overflow:\s*visible/);
  assert.match(tabStyles, /> \.tab\.active\s*\{[^}]*overflow-y:\s*auto[^}]*scrollbar-gutter:\s*stable[^}]*scrollbar-width:\s*thin/);
  assert.match(styles, /form\.actor-sheet\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(styles, /character-sheet__workspace > \.sheet-tabs\s*\{[\s\S]*?position:\s*sticky/);
  assert.match(styles, /\.tab\[data-tab\]\.active\s*\{[\s\S]*?overflow:\s*visible/);
  assert.match(compiled, /\.brinkwood \.sheet-tab-content > \.tab\.active\s*\{[^}]*scrollbar-gutter:\s*stable[^}]*scrollbar-width:\s*thin/);
  assert.match(compiled, /\.brinkwood \.bw-ruled-card\s*\{[\s\S]*?border-left:\s*5px solid var\(--bw-accent\)/);
});

test("Character sheet commits generic controls once and completes tab-panel contracts", async () => {
  const [controller, template] = await Promise.all([
    read("module/blades-actor-sheet.js"),
    read("templates/actor-sheet.html"),
  ]);

  assert.match(controller, /control\.addEventListener\("change", event => this\._persistFormControl\(event\), listenerOptions\)/);
  assert.doesNotMatch(controller, /control\.addEventListener\("focusout", event => this\._persistFormControl\(event\), listenerOptions\)/);
  assert.match(controller, /input\[name="system\.scars"\], input\[name="system\.oath"\], \[data-path\]/);
  assert.match(controller, /persistRichTextChange\(this, event\)/);
  assert.match(controller, /this\._bindSheetViewState\(html, listenerOptions\);[\s\S]*?bindLoadoutControls\(this, html, listenerOptions\);[\s\S]*?if \(!this\.isEditable\) return;/);

  assert.match(template, /<thead(?:\s+[^>]*)?>\s*<tr>[\s\S]*?<\/tr>\s*<\/thead>/);
  for (const [tab, panel] of [
    ["traits", "traits-tab"],
    ["loadout", "loadout"],
    ["notes", "notes"],
    ["downtime", "downtime"],
    ["effects", "effects"],
  ]) {
    assert.match(template, new RegExp(`id="character-\\{\\{_id\\}\\}-tab-${tab}"[\\s\\S]*?aria-controls="character-\\{\\{_id\\}\\}-${panel}"`));
    assert.match(template, new RegExp(`id="character-\\{\\{_id\\}\\}-${panel}"[\\s\\S]*?role="tabpanel"[\\s\\S]*?aria-labelledby="character-\\{\\{_id\\}\\}-tab-${tab}"`));
  }
  assert.match(template, /\{\{#if isGM\}\}[\s\S]*?id="character-\{\{_id\}\}-tab-effects"[\s\S]*?\{\{\/if\}\}[\s\S]*?\{\{#if isGM\}\}[\s\S]*?id="character-\{\{_id\}\}-effects"[\s\S]*?\{\{\/if\}\}/);
});

test("Character fiction tab is labelled Background without changing its stored tab key", async () => {
  const template = await read("templates/actor-sheet.html");
  assert.match(template, /data-tab="character-notes">\{\{localize "BITD\.Background"\}\}<\/button>/);
  assert.doesNotMatch(template, /data-tab="character-notes">\{\{localize "BITD\.Notes"\}\}<\/button>/);
});

test("Character sheet owns Attribute-grid geometry and breakpoints", async () => {
  const [styles, legacyStyles] = await Promise.all([
    read("scss/import/character-sheet.scss"),
    read("scss/import/legacy-character-effects.scss"),
  ]);

 assert.match(styles, /\.character-attributes > \.attributes\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)[\s\S]*?width:\s*100%[\s\S]*?max-width:\s*100%[\s\S]*?box-sizing:\s*border-box[\s\S]*?flex:\s*1 1 100%/);
 assert.match(styles, /\.character-attributes\s*\{[\s\S]*?align-self:\s*stretch[\s\S]*?width:\s*100%[\s\S]*?flex:\s*0 0 auto/);
 assert.match(styles, /\.attribute > \.flex-horizontal\s*\{[\s\S]*?display:\s*block[\s\S]*?width:\s*100%/);
 assert.match(styles, /@container \(max-width: 570px\)\s*\{[\s\S]*?\.character-attributes > \.attributes\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@container \(max-width: 430px\)\s*\{[\s\S]*?\.character-attributes > \.attributes\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
 assert.doesNotMatch(legacyStyles, /character-sheet__workspace > (?:nav\.tabs|\.tab-content)/);
 assert.doesNotMatch(legacyStyles, /character-attributes(?: > \.attributes)?\s*\{/);
});
