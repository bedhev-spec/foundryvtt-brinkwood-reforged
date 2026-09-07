import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

test("shared parchment uses an ivory wash over subdued grain", async () => {
  const [tokens, general, character, mask, npc, rebellion, polish, compiled] = await Promise.all([
    read("scss/style.scss"),
    read("scss/import/general-styles.scss"),
    read("scss/import/character-sheet.scss"),
    read("scss/import/mask-sheet.scss"),
    read("scss/import/npc-sheet.scss"),
    read("scss/import/rebelion-sheet.scss"),
    read("scss/import/legacy-character-sheet-polish.scss"),
    read("styles/blades.css"),
  ]);

  assert.match(tokens, /--bw-paper:\s*#f7f4ed/);
  assert.match(tokens, /--bw-paper-overlay:\s*rgba\(247, 244, 237, 0\.72\)/);
  assert.match(general, /radial-gradient\(circle at 18% 0%/);
  assert.match(general, /rgba\(247, 244, 237, 0\.28\)/);
  assert.match(general, /url\("assets\/textures\/parchment-grain-sage-v4\.png"\)/);
  assert.match(general, /background-size:\s*cover, cover, 768px 768px/);
  assert.match(general, /background-blend-mode:\s*normal, normal, normal/);
  assert.match(character, /\.window-content\s*\{[\s\S]*?background-color:\s*#eeeee8/);
  assert.match(character, /form\.actor-sheet\s*\{[\s\S]*?background-color:\s*transparent/);
  assert.doesNotMatch(mask, /form\.mask-sheet\s*\{[^}]*background:\s*rgba\(247, 244, 237, 0\.28\)/);
  assert.match(npc, /\.npc-dossier\s*\{[\s\S]*?background:\s*transparent/);
  assert.match(rebellion, /\.rebelion-sheet__form\s*\{[^}]*background:\s*transparent/);
  assert.doesNotMatch(
    polish,
    /form\.actor-sheet\s*\{[^}]*var\(--bw-paper\)/,
    "late Character polish must not cover the shared parchment texture",
  );
  assert.match(compiled, /--bw-paper-overlay:\s*rgba\(247, 244, 237, 0\.72\)/);
  assert.match(compiled, /background-size:\s*cover, cover, 768px 768px/);
});
