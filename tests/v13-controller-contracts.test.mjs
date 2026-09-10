import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("Character ApplicationV2 window is resizable", async () => {
  const source = await read("module/blades-actor-sheet.js");
  assert.match(source, /position:\s*\{\s*width:\s*700,\s*height:\s*1170\s*\},[\s\S]*?window:\s*\{\s*resizable:\s*true\s*\}/);
});

const lifecycleControllers = [
  "module/blades-sheet.js",
  "module/blades-actor-sheet.js",
  "module/blades-item-sheet.js",
  "module/blades-mask-sheet.js",
  "module/blades-rebelion-sheet.js",
];

test("each ApplicationV2 sheet awaits its own render lifecycle", async t => {
  for (const path of lifecycleControllers) {
    await t.test(path, async () => {
      const source = await read(path);
      assert.match(source, /async _onRender\(context, options\)\s*\{\s*await super\._onRender\(context, options\)/);
    });
  }

  await t.test("module/blades-npc-sheet.js inherits the base lifecycle", async () => {
    const source = await read("module/blades-npc-sheet.js");
    assert.match(source, /async _onRender\(context, options\)\s*\{\s*await super\._onRender\(context, options\)/);
    assert.match(source, /this\._npcSheetListenerController\?\.abort\(\)/);
    assert.match(source, /this\._npcSheetListenerController = new AbortController\(\)/);
    assert.match(source, /signal: this\._npcSheetListenerController\.signal/);
  });
});

const listenerControllers = [
  ["module/blades-sheet.js", "_brinkwoodListenerController"],
  ["module/blades-actor-sheet.js", "_characterSheetListenerController"],
  ["module/blades-item-sheet.js", "_itemSheetListenerController"],
  ["module/blades-mask-sheet.js", "_maskSheetListenerController"],
  ["module/blades-rebelion-sheet.js", "_rebelionSheetListenerController"],
];

test("each listener-owning controller replaces its own AbortController", async t => {
  for (const [path, property] of listenerControllers) {
    await t.test(path, async () => {
      const source = await read(path);
      assert.match(source, new RegExp(`this\\.${property}\\?\\.abort\\(\\)`));
      assert.match(source, new RegExp(`this\\.${property} = new AbortController\\(\\)`));
      assert.match(source, new RegExp(`signal: this\\.${property}\\.signal`));
    });
  }
});

test("each audited module is free of legacy sheet APIs", async t => {
  const paths = [
    ...lifecycleControllers,
    "module/blades-npc-sheet.js",
    "module/blades-active-effect.js",
    "module/blades-roll.js",
  ];
  for (const path of paths) {
    await t.test(path, async () => {
      const source = await read(path);
      assert.doesNotMatch(source, /render\(true\)/);
      assert.doesNotMatch(source, /foundry\.appv1/);
      assert.doesNotMatch(source, /document\.getElementById/);
    });
  }
});

test("tracker-only actor updates synchronize every open renderer", async () => {
  const [bootstrap, characterTemplate, maskTemplate] = await Promise.all([
    read("module/blades.js"),
    read("templates/actor-sheet.html"),
    read("templates/mask-sheet.html")
  ]);
  assert.match(bootstrap, /Hooks\.on\("updateActor", \(actor, changes\) => syncOpenActorTrackers\(actor, changes\)\)/);
  assert.match(characterTemplate, /class="\{\{cssClass\}\} actor-sheet character-sheet" data-actor-uuid="\{\{actor\.uuid\}\}"/);
  assert.match(maskTemplate, /class="\{\{cssClass\}\} actor-sheet mask-sheet" data-actor-uuid="\{\{actor\.uuid\}\}"/);
});

test("Simple Roll uses a close-safe native DialogV2 form contract", async () => {
  const source = await read("module/blades-roll.js");
  assert.match(source, /DialogV2\.wait/);
  assert.match(source, /dialog\.element\.querySelector\("form"\)/);
  assert.match(source, /form\?\.elements\.qty/);
  assert.match(source, /rejectClose:\s*false,\s*\}\);/);
  assert.doesNotMatch(source, /\},\s*\{\s*rejectClose:\s*false\s*\}\);/);
});

test("each Actor HTML editor has its own enriched context and template target", async t => {
  const notesPartial = await read("templates/parts/sheet-notes.html");
  const contracts = [
    ["character", "module/blades-actor-sheet.js", "templates/actor-sheet.html", ["description"]],
    ["mask", "module/blades-mask-sheet.js", "templates/mask-sheet.html", ["description"]],
    ["NPC", "module/blades-npc-sheet.js", "templates/npc-sheet.html", ["description", "abilities", "schemes"]],
  ];

  for (const [name, controllerPath, templatePath, fields] of contracts) {
    await t.test(name, async () => {
      const [controller, template] = await Promise.all([read(controllerPath), read(templatePath)]);
      for (const field of fields) {
        const enrichedField = field === "description" ? "enrichedDescription" : `enriched${field[0].toUpperCase()}${field.slice(1)}`;
        assert.match(controller, new RegExp(`context\\.${enrichedField}\\s*=\\s*await[\\s\\S]*?enrichHTML`));
        if ((name === "character" || name === "mask") && field === "description") {
          assert.match(template, /parts\/sheet-notes\.html"\s*\}\}/);
          assert.match(notesPartial, new RegExp(`<prose-mirror class="sheet-notes__editor" name="system\\.${field}" value="\\{\\{system\\.${field}\\}\\}" data-document-uuid="\\{\\{actor\\.uuid\\}\\}" collaborate toggled>`));
          assert.match(notesPartial, new RegExp(`\\{\\{\\{${enrichedField}\\}\\}\\}`));
        } else {
          assert.match(template, new RegExp(`<prose-mirror name="system\\.${field}" value="\\{\\{system\\.${field}\\}\\}" data-document-uuid="\\{\\{actor\\.uuid\\}\\}" collaborate toggled>`));
          assert.match(template, new RegExp(`\\{\\{\\{${enrichedField}\\}\\}`));
        }
      assert.doesNotMatch(template, /\{\{editor\b/);
      }
      assert.match(controller, /relativeTo:\s*this\.document/);
      assert.match(controller, /secrets:\s*this\.document\.isOwner/);
    });
  }
});

test("each Item description editor uses the dedicated enriched context", async t => {
  const controller = await read("module/blades-item-sheet.js");
  assert.match(controller, /context\.enrichedDescription\s*=\s*await[\s\S]*?enrichHTML/);
  assert.match(controller, /context\.item\s*=\s*doc/);
  assert.match(controller, /relativeTo:\s*doc/);
  assert.match(controller, /secrets:\s*doc\.isOwner/);

  for (const type of ["item", "simple", "trait", "class", "moot_decision"]) {
    await t.test(type, async () => {
      const template = await read(`templates/items/${type}.html`);
      if (type === "item") {
        assert.match(template, /<textarea id="item-description" name="system\.description"[^>]*>\{\{system\.description\}\}<\/textarea>/);
        assert.doesNotMatch(template, /<prose-mirror name="system\.description"/);
        return;
      }
      assert.match(template, /\{\{#if editable\}\}[\s\S]*?<prose-mirror name="system\.description" value="\{\{system\.description\}\}" data-document-uuid="\{\{item\.uuid\}\}" collaborate toggled>/);
      assert.match(template, /\{\{else\}\}[\s\S]*?<div class="editor editor-content">\{\{\{enrichedDescription\}\}\}<\/div>/);
      assert.doesNotMatch(template, /\{\{editor\b/);
    });
  }
});

test("each Item portrait is keyboard-operable only while editable", async t => {
  const portrait = await read("templates/parts/sheet-identity-portrait.html");
  assert.match(portrait, /\{\{#if editable\}\} data-action="editImage" data-edit="img" role="button" tabindex="0" aria-label=/);

  for (const type of ["item", "simple", "trait", "class", "moot_decision"]) {
    await t.test(type, async () => {
      const template = await read(`templates/items/${type}.html`);
      assert.match(template, /parts\/sheet-identity-portrait\.html/);
      assert.doesNotMatch(template, /data-action="editImage"/);
    });
  }

  const controller = await read("module/blades-item-sheet.js");
  assert.match(controller, /\[data-action="editImage"\]\[role="button"\]/);
  assert.match(controller, /\["Enter", " "\]\.includes\(event\.key\)/);
  assert.match(controller, /event\.currentTarget\.click\(\)/);
});

test("Actor effect controls share a pending guard and enforce the GM-only policy", async () => {
  const [base, character, mask] = await Promise.all([
    read("module/blades-sheet.js"),
    read("module/blades-actor-sheet.js"),
    read("module/blades-mask-sheet.js"),
  ]);
  assert.match(base, /async _onActorEffectControl\(event, action, \{ renderAfter = false \} = \{\}\)/);
  assert.match(base, /_pendingActorEffectControls\?\.has\(control\)/);
  assert.match(character, /_onActorEffectControl\([\s\S]*?onManageActiveEffect\(ev, this\.actor, \{ gmOnly: true, render: false \}\)/);
  assert.match(character, /renderAfter: ev\.currentTarget\.dataset\.effectAction !== "edit"/);
  assert.match(mask, /_onActorEffectControl\([\s\S]*?onManageActiveEffect\(ev, this\.actor, \{ gmOnly: true \}\)/);
});

test("Simple Roll closes and cancels without submitting a roll", async () => {
  let dialogConfig;
  class Field {
    constructor(options = {}) {
      this.options = options;
    }
  }
  globalThis.game = { i18n: { localize: key => key } };
  globalThis.foundry = {
    abstract: { TypeDataModel: class {} },
    data: {
      fields: {
        ArrayField: Field,
        BooleanField: Field,
        HTMLField: Field,
        NumberField: Field,
        ObjectField: Field,
        SchemaField: Field,
        StringField: Field,
      }
    },
    utils: { deepClone: value => structuredClone(value) },
    applications: {
      api: {
        DialogV2: {
          wait: async config => {
            dialogConfig = config;
            return undefined;
          }
        }
      }
    }
  };

  const { simpleRollPopup } = await import(`../module/blades-roll.js?dialog=${Date.now()}`);
  await simpleRollPopup();

  assert.equal(dialogConfig.rejectClose, false);
  assert.equal(dialogConfig.buttons.find(button => button.action === "cancel").callback, undefined);
});
