import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("NPC dossier keeps its rules fields and ApplicationV2 editor bindings", async () => {
  const template = await read("templates/npc-sheet.html");
  assert.match(template, /class="\{\{cssClass\}\} actor-sheet npc-dossier"/);
  assert.match(template, /parts\/sheet-identity-portrait\.html"/);
  assert.doesNotMatch(template, /<img class="npc-dossier__portrait"/);
  for (const field of ["description_short", "associated_class", "associated_faction", "associated_crew_type"]) {
    assert.match(template, new RegExp(`name="system\\.${field}" value="\\{\\{system\\.${field}\\}\\}"`));
  }
  assert.match(template, /name="system\.tier"[^>]*min="0"[^>]*max="6"/);
  assert.match(template, /name="system\.threat"[^>]*min="-3"/);
  assert.match(template, /name="system\.elite"\{\{checked system\.elite\}\}/);
  for (const [field, enriched] of [["description", "enrichedDescription"], ["abilities", "enrichedAbilities"], ["schemes", "enrichedSchemes"]]) {
    assert.match(template, new RegExp(`<prose-mirror name="system\\.${field}" value="\\{\\{system\\.${field}\\}\\}" data-document-uuid="\\{\\{actor\\.uuid\\}\\}" collaborate toggled>`));
    assert.match(template, new RegExp(`class="editor editor-content">\\{\\{\\{${enriched}\\}\\}`));
  }
  assert.equal((template.match(/class="tab npc-dossier__editor-panel bw-rich-text-surface/g) ?? []).length, 3);
  assert.equal((template.match(/data-action="tab" data-group="npcDetails"/g) ?? []).length, 3);
  assert.match(template, /data-tab="description" role="tabpanel"/);
  assert.match(template, /data-tab="abilities" role="tabpanel"/);
  assert.match(template, /data-tab="schemes" role="tabpanel"/);
  assert.doesNotMatch(template, /system\.notes|enrichedNotes|Npc\.Notes/);
  assert.equal((template.match(/class="bw-text-field"/g) ?? []).length, 6);
  assert.match(template, /class="name bw-text-field" type="text"[^>]*name="name"/);
  assert.match(template, /class="bw-checkbox-x" type="checkbox"[^>]*name="system\.elite"/);
  assert.doesNotMatch(template, /\{\{editor\b/);
});

test("NPC layout prevents global section flex from collapsing the dossier", async () => {
  const [npcStyles, richTextStyles, identityStyles, styleRoot] = await Promise.all([
    read("scss/import/npc-sheet.scss"),
    read("scss/import/sheet-notes.scss"),
    read("scss/import/sheet-identity.scss"),
    read("scss/style.scss"),
  ]);
  assert.match(npcStyles, /\.npc-dossier__header\s*\{[\s\S]*?flex:\s*0 0 auto/);
  assert.match(npcStyles, /\.npc-dossier__profile\s*\{[\s\S]*?display:\s*block[\s\S]*?flex:\s*0 0 auto/);
  assert.match(npcStyles, /\.npc-dossier__editors\s*\{[\s\S]*?flex:\s*0 0 auto[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)[\s\S]*?width:\s*100%[\s\S]*?align-self:\s*stretch/);
  assert.doesNotMatch(npcStyles, /\.editor-edit/);
  assert.match(richTextStyles, /\.bw-rich-text-surface\s*\{[\s\S]*?> prose-mirror[\s\S]*?min-height:\s*260px/);
  assert.match(richTextStyles, /background:\s*rgba\(255, 255, 255, 0\.35\)/);
  assert.match(richTextStyles, /> prose-mirror\s*\{[\s\S]*?display:\s*flex[\s\S]*?flex-direction:\s*column/);
  assert.match(npcStyles, /\.npc-dossier__editor-panel\s*\{[\s\S]*?width:\s*100%/);
  assert.match(identityStyles, /\.sheet-identity__portrait-frame\s*\{[\s\S]*?--bw-portrait-shadow:[\s\S]*?box-shadow:\s*var\(--bw-portrait-shadow\)/);
  assert.match(identityStyles, /--bw-portrait-shadow:[\s\S]*?rgba\(141, 98, 93, 0\.2\)/);
  assert.match(identityStyles, /\[data-action="editImage"\]\s*\{[\s\S]*?cursor:\s*pointer;[\s\S]*?&:hover,[\s\S]*?&:focus,[\s\S]*?&:focus-visible[\s\S]*?outline:\s*0;[\s\S]*?0 0 0 2px rgba\(25, 24, 19, 0\.25\)/);
  assert.match(npcStyles, /\.npc-dossier__header\s*\{[\s\S]*?grid-template-columns:\s*120px minmax\(0, 1fr\)/);
  assert.match(npcStyles, /\.npc-dossier__header > \.sheet-identity__portrait\s*\{[\s\S]*?--bw-portrait-size:\s*120px;[\s\S]*?--bw-portrait-shadow-offset:\s*4px/);
  assert.match(npcStyles, /@container \(max-width: 480px\)[\s\S]*?\.npc-dossier__header\s*\{[\s\S]*?grid-template-columns:\s*104px minmax\(0, 1fr\)[\s\S]*?\.npc-dossier__header > \.sheet-identity__portrait\s*\{[\s\S]*?--bw-portrait-size:\s*104px/);
  assert.doesNotMatch(npcStyles, /\.npc-dossier__field input\s*\{[\s\S]*?outline-offset:\s*1px/);
  assert.doesNotMatch(npcStyles, /\[data-action="editImage"\]/);
  assert.match(styleRoot, /@import 'import\/npc-sheet\.scss';/);
});

test("every Actor sheet with a portrait uses the shared portrait component", async () => {
  const [character, mask, npc, portrait] = await Promise.all([
    read("templates/actor-sheet.html"),
    read("templates/mask-sheet.html"),
    read("templates/npc-sheet.html"),
    read("templates/parts/sheet-identity-portrait.html"),
  ]);
  for (const template of [character, mask, npc]) {
    assert.match(template, /parts\/sheet-identity-portrait\.html/);
  }
  assert.match(portrait, /class="sheet-identity__portrait"/);
  assert.equal((character.match(/data-action="editImage"/g) ?? []).length, 0);
  assert.equal((mask.match(/data-action="editImage"/g) ?? []).length, 0);
  assert.equal((npc.match(/data-action="editImage"/g) ?? []).length, 0);
});
