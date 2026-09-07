import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("character notes keep rich text readable and inset from their frame", async () => {
  const [source, compiled] = await Promise.all([
    read("scss/import/sheet-notes.scss"),
    read("styles/blades.css"),
  ]);

  for (const styles of [source, compiled]) {
    assert.match(styles, /\.editor-content,[\s\S]*?prose-mirror \.ProseMirror\s*\{[\s\S]*?min-inline-size:\s*0[\s\S]*?max-inline-size:\s*100%[\s\S]*?padding-inline:\s*5px[\s\S]*?color:\s*var\(--bw-ink\)/);
    assert.match(styles, /\.editor-content \*,[\s\S]*?prose-mirror \.ProseMirror \*\s*\{[\s\S]*?max-inline-size:\s*100%[\s\S]*?color:\s*inherit !important[\s\S]*?overflow-wrap:\s*anywhere/);
  }
});

test("Character Background fills remaining height and stops 10px before the frame edge", async () => {
  const [source, compiled] = await Promise.all([
    read("scss/import/character-sheet.scss"),
    read("styles/blades.css"),
  ]);
  for (const styles of [source, compiled]) {
    assert.match(styles, /character-sheet__workspace:has\([^)]*character-notes[^)]*\)\s*\{[\s\S]*?flex:\s*1 0 300px;[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\);[\s\S]*?margin-block-end:\s*-10px/);
    assert.match(styles, /sheet-notes\.active\s*\{[\s\S]*?height:\s*100%;[\s\S]*?overflow:\s*hidden;[\s\S]*?> \.sheet-notes__editor,[\s\S]*?> \.sheet-notes__preview\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?height:\s*100%/);
  }
});
