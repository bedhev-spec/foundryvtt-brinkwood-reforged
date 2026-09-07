import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("actor rich-text fields and template defaults stay aligned", async () => {
  const [models, template] = await Promise.all([
    read("module/data/actor-data-models.js"),
    read("template.json")
  ]);
  const defaults = JSON.parse(template).Actor;

  assert.doesNotMatch(models, /notes:\s+new fields\.HTMLField/);
  assert.match(models, /description:\s+new fields\.HTMLField/);
  assert.equal(defaults.mask.description, "");
  assert.equal(Object.hasOwn(defaults.npc, "notes"), false);
  assert.equal(defaults.npc.abilities, "");
  assert.equal(defaults.npc.schemes, "");
});

test("v13 image actions and editors are editable-only", async () => {
  const templates = await Promise.all([
    "templates/mask-sheet.html",
    "templates/npc-sheet.html",
    "templates/items/simple.html",
    "templates/items/class.html",
    "templates/items/moot_decision.html",
    "templates/items/trait.html",
    "templates/parts/sheet-identity-portrait.html",
    "templates/parts/sheet-notes.html"
  ].map(read));

  for (const template of templates.slice(0, 6)) {
    assert.match(template, /parts\/sheet-identity-portrait\.html/);
    assert.doesNotMatch(template, /data-action="editImage"/);
  }
  assert.match(templates[6], /\{\{#if editable\}\}\s*data-action="editImage" data-edit="img"/);
  assert.doesNotMatch(templates[0], /parts\/sheet-notes\.html/);
  assert.match(templates[0], /parts\/mask\/alchemic-blood\.html/);
  assert.match(templates[7], /\{\{#if editable\}\}[\s\S]*?<prose-mirror class="sheet-notes__editor" name="system\.description"[^>]*value="\{\{system\.description\}\}"[^>]*data-document-uuid="\{\{actor\.uuid\}\}"[^>]*collaborate toggled>/);
  assert.match(templates[1], /<prose-mirror name="system\.description"[^>]*data-document-uuid="\{\{actor\.uuid\}\}"[^>]*collaborate toggled>/);
  assert.ok(templates.every(template => !/\{\{editor\b/.test(template)));
  for (const template of templates) assert.doesNotMatch(template, /\{\{editor\s+content=/);
  assert.doesNotMatch(templates[3], /\{\{editor system\.experience_clues/);
  assert.match(templates[3], /name="system\.experience_clues\.\{\{index\}\}"/);
  assert.doesNotMatch(templates[5], /system-edit="img"|\{\{item\.img\}\}/);
});

test("native rich-text controls submit source fields while viewers receive enriched content", async () => {
  const notesPartial = await read("templates/parts/sheet-notes.html");
  assert.match(notesPartial, /name="system\.description" value="\{\{system\.description\}\}" data-document-uuid="\{\{actor\.uuid\}\}" collaborate toggled>\{\{\{enrichedDescription\}\}\}<\/prose-mirror>/);
  assert.match(notesPartial, /\{\{else\}\}\s*<div class="editor editor-content sheet-notes__preview">\{\{\{enrichedDescription\}\}\}<\/div>/);

  const contracts = [
    ["templates/npc-sheet.html", "system.description", "actor.uuid", "enrichedDescription"],
    ["templates/npc-sheet.html", "system.abilities", "actor.uuid", "enrichedAbilities"],
    ["templates/npc-sheet.html", "system.schemes", "actor.uuid", "enrichedSchemes"],
    ...["simple", "trait", "class", "moot_decision"].map(type => [
      `templates/items/${type}.html`, "system.description", "item.uuid", "enrichedDescription"
    ])
  ];

  for (const [path, field, uuid, enriched] of contracts) {
    const template = await read(path);
    const control = [...template.matchAll(/<prose-mirror\s+([^>]+)>/g)].find(([, attributes]) =>
      attributes.includes(`name="${field}"`)
    );
    assert.ok(control, `${path} has a native rich-text form control for ${field}`);
    const tag = control[1];
    assert.ok(tag, `${path} uses a native prose-mirror form control`);
    const attributes = Object.fromEntries([...tag.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(([, key, value]) => [key, value ?? true]));
    assert.deepEqual(attributes, {
      name: field,
      value: `{{${field}}}`,
      "data-document-uuid": `{{${uuid}}}`,
      collaborate: true,
      toggled: true
    });
    const contentStart = control.index + control[0].length;
    const controlContent = template.slice(contentStart, template.indexOf("</prose-mirror>", contentStart));
    assert.equal(controlContent.trim(), `{{{${enriched}}}}`, `${path} provides enriched closed-state content`);
    const readOnlyBranch = template.slice(control.index, template.indexOf("{{/if}}", control.index));
    assert.match(readOnlyBranch, new RegExp(`\\{\\{else\\}\\}\\s*<div class="editor editor-content">\\{\\{\\{${enriched}\\}\\}\\}<\\/div>`));
  }

  const loadoutItem = await read("templates/items/item.html");
  assert.match(loadoutItem, /<textarea id="item-description" name="system\.description"[^>]*>\{\{system\.description\}\}<\/textarea>/);
  assert.doesNotMatch(loadoutItem, /<prose-mirror name="system\.description"/);
});

test("native editor activation resolves the Foundry v13 dataset UUID", async () => {
  const template = await read("templates/npc-sheet.html");
  const tag = template.match(/<prose-mirror\s+([^>]*name="system\.description"[^>]*)>/)?.[1];
  assert.ok(tag);
  const attributes = Object.fromEntries([...tag.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(([, key, value]) => [key, value ?? true]));
  const dataset = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (!key.startsWith("data-")) continue;
    dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }

  const resolved = [];
  const fromUuid = async uuid => {
    if (!uuid) throw new Error("Missing editor document UUID");
    resolved.push(uuid);
    return { uuid };
  };
  const clickEditorButton = async element => fromUuid(element.dataset.documentUuid ?? element.dataset.documentUUID);

  const document = await clickEditorButton({ dataset });
  assert.equal(document.uuid, "{{actor.uuid}}");
  assert.deepEqual(resolved, ["{{actor.uuid}}"]);

  const legacyAttributes = { "document-uuid": "{{actor.uuid}}" };
  await assert.rejects(() => clickEditorButton({ dataset: legacyAttributes }), /uuid/i);
});

test("native rich-text controls retain a playable minimum editing height", async () => {
  const styles = await read("scss/import/general-styles.scss");
  assert.match(styles, /\.editor,[\s\S]*?\.editor-content,[\s\S]*?prose-mirror\s*\{[\s\S]*?min-height:\s*150px/);
});

test("Class clue controls use indexed paths for the Item sheet persistence handler", async () => {
  const template = await read("templates/items/class.html");
  const names = [...template.matchAll(/name="(system\.experience_clues\.\{\{index\}\})"/g)].map(([, name]) => name);
  assert.deepEqual(names, ["system.experience_clues.{{index}}"]);
  assert.doesNotMatch(template, /target="system\.experience_clues"|editor[^}]*experience_clues/);

});
