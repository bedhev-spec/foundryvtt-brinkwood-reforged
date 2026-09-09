import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { bindRichTextPersistence, persistRichTextChange } from "../module/sheet-dom.js";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Character and Mask consume the shared Notes component", async () => {
  const [character, mask, partial, templates] = await Promise.all([
    read("templates/actor-sheet.html"),
    read("templates/mask-sheet.html"),
    read("templates/parts/sheet-notes.html"),
    read("module/blades-templates.js"),
  ]);
  const reference = /systems\/brinkwood-reforged\/templates\/parts\/sheet-notes\.html/;

  assert.match(character, reference);
  assert.match(mask, reference);
  assert.match(character, /class="tab flex-vertical sheet-notes bw-rich-text-surface/);
  assert.match(mask, /mask-sheet__notes flex-vertical sheet-notes bw-rich-text-surface/);
  assert.match(partial, /<prose-mirror class="sheet-notes__editor" name="system\.description" value="\{\{system\.description\}\}" data-document-uuid="\{\{actor\.uuid\}\}" collaborate toggled>/);
  assert.doesNotMatch(partial, /fieldName|fieldValue|documentUuid|enrichedContent/);
  assert.match(partial, /class="editor editor-content sheet-notes__preview"/);
  assert.match(templates, reference);
});

test("the design system owns Notes styling once", async () => {
  const [shared, character, mask, tabs, rootStyles] = await Promise.all([
    read("scss/import/sheet-notes.scss"),
    read("scss/import/character-sheet.scss"),
    read("scss/import/mask-sheet.scss"),
    read("scss/import/sheet-tabs.scss"),
    read("scss/import/general-styles.scss"),
  ]);

  assert.match(rootStyles, /@import 'sheet-notes\.scss';/);
  assert.match(shared, /\.bw-rich-text-surface\s*\{[\s\S]*?> prose-mirror[\s\S]*?min-height:\s*260px/);
  assert.match(shared, /> prose-mirror\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column/,
    "the shared Notes component must provide Foundry's flex prose-mirror host layout");
  assert.match(shared, /> \.sheet-notes__preview,[\s\S]*?> \.bw-rich-text-surface__preview\s*\{[\s\S]*?display:\s*block/);
  assert.doesNotMatch(shared, /> \.editor\s*\{[\s\S]*?display:\s*block/,
    "the preview rule must not override Foundry's runtime .editor class on prose-mirror");
  assert.match(shared, /prose-mirror \.ProseMirror\s*\{[\s\S]*?min-inline-size:\s*0[\s\S]*?color:\s*var\(--bw-ink\)/);
  assert.match(character, /\.character-sheet__workspace:has\(> \.tab-content > \.sheet-notes\[data-tab="character-notes"\]\.active\)/);
  assert.doesNotMatch(mask, /mask-sheet__notes[\s\S]*?prose-mirror/);
  assert.doesNotMatch(tabs, /mask-sheet__panel prose-mirror/);
});

test("shared rich-text persistence saves Mask Notes and requests a rerender", async () => {
  const updates = [];
  const control = {
    name: "system.description",
    value: "<p>Saved Mask note</p>",
    matches: selector => selector === "prose-mirror[name]",
  };
  const sheet = {
    isEditable: true,
    document: {
      update: async (...args) => { updates.push(args); },
    },
  };

  assert.equal(await persistRichTextChange(sheet, { currentTarget: control }), true);
  assert.deepEqual(updates, [[
    { "system.description": "<p>Saved Mask note</p>" },
    { render: true },
  ]]);
});

test("the shared Notes binder owns the prose-mirror change listener", async () => {
  const listeners = new Map();
  const control = {
    addEventListener: (type, listener, options) => listeners.set(type, { listener, options }),
  };
  const html = {
    querySelectorAll: selector => {
      assert.equal(selector, "prose-mirror[name]");
      return [control];
    },
  };
  const events = [];
  const sheet = { _persistFormControl: event => events.push(event) };
  const listenerOptions = { signal: {} };

  bindRichTextPersistence(sheet, html, listenerOptions);
  const event = { currentTarget: control };
  listeners.get("change").listener(event);

  assert.equal(listeners.get("change").options, listenerOptions);
  assert.deepEqual(events, [event]);
});

test("the shared Notes binder hydrates Foundry's empty editor value without replacing its enriched preview", () => {
  const listeners = new Map();
  const preview = { innerHTML: '<p class="enriched">Existing note</p>' };
  let value = "";
  const control = {
    name: "system.description",
    open: false,
    get value() { return value; },
    set value(nextValue) {
      value = nextValue;
      preview.innerHTML = nextValue;
    },
    querySelector: selector => selector === ".editor-content" ? preview : null,
    _setValue: nextValue => { value = nextValue; },
    _refresh: () => { preview.innerHTML = value; },
    addEventListener: (type, listener, options) => listeners.set(type, { listener, options }),
  };
  const html = { querySelectorAll: () => [control] };
  const sheet = {
    document: { system: { description: "<p>Existing note</p>" } },
    _persistFormControl: () => assert.fail("hydration must not invoke persistence"),
  };

  bindRichTextPersistence(sheet, html, { signal: {} });

  assert.equal(control.value, "<p>Existing note</p>");
  assert.equal(preview.innerHTML, '<p class="enriched">Existing note</p>');
  assert.ok(listeners.has("change"));
  assert.equal(listeners.get("click").options.capture, true);
});
