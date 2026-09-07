import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("shared identity Name fields use the shared focusable input and ApplicationV2 persistence seam", async () => {
  const [field, baseSheet, characterSheet, maskSheet, sheetDom, identity] = await Promise.all([
    read("templates/parts/sheet-identity-name.html"),
    read("module/blades-sheet.js"),
    read("module/blades-actor-sheet.js"),
    read("module/blades-mask-sheet.js"),
    read("module/sheet-dom.js"),
    read("scss/import/sheet-identity.scss"),
  ]);

  assert.match(field, /class="name bw-text-field"/);
  assert.match(identity, /\.bw-text-field\s*\{[\s\S]*?&:focus,[\s\S]*?&:focus-visible[\s\S]*?border-color:\s*#191813/);
  assert.match(baseSheet, /form:\s*\{\s*submitOnChange:\s*true\s*\}/);
  assert.match(sheetDom, /event\.currentTarget\?\.blur\(\)/);
  assert.match(maskSheet, /form:\s*\{\s*submitOnChange:\s*false\s*\}/);
  assert.match(maskSheet, /"keydown",\s*handleActorNameEnter/);
  assert.match(maskSheet, /"change", event => this\._persistFormControl\(event\)/);
  assert.match(characterSheet, /input\[name="name"\][\s\S]*?persistActorNameChange\(this, event\)/);
});
