import { extractPack } from "@foundryvtt/foundryvtt-cli";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const imageRoot = "systems/brinkwood-reforged/images/loadout";
const imageByName = Object.freeze({
  "Ashwood": "ashwood.webp",
  "Black Powder": "black-powder.webp",
  "Blackjack": "blackjack.webp",
  "Blade or Two": "blade-or-two.webp",
  "Buckler": "buckler.webp",
  "Burglary Kit": "burglary-kit.webp",
  "Censer": "censer.webp",
  "Chainmail": "chainmail.webp",
  "Climbing Gear": "climbing-gear.webp",
  "Crossbow": "crossbow.webp",
  "Demolition Tools": "demolition-tools.webp",
  "Hunting Bow": "hunting-bow.webp",
  "Knightly Shield": "knightly-shield.webp",
  "Lantern": "lantern.webp",
  "Leather Armor": "leather-armor.webp",
  "Longbow": "longbow.webp",
  "Longsword": "longsword.webp",
  "Manna Wood": "manna-wood.webp",
  "Pistol": "pistol.webp",
  "Plated Jacket": "plated-jacket.webp",
  "Rifle": "rifle.webp",
  "Round Shield": "round-shield.webp",
  "Second Pistol": "second-pistol.webp",
  "Shortbow": "shortbow.webp",
  "Spear": "spear.webp",
  "Subterfuge Supplies": "subterfuge-supplies.webp",
  "Tinkering Tools": "tinkering-tools.webp",
});

function expectedImage(name) {
  return `${imageRoot}/${imageByName[name]}`;
}

test("loadout source catalogue assigns one optimized image to every item", async () => {
  const lines = (await readFile(path.join(root, "packs", "items.db"), "utf8"))
    .split(/\r?\n/)
    .filter(line => line.trim());
  const documents = lines.map(line => JSON.parse(line));

  assert.equal(documents.length, Object.keys(imageByName).length);
  assert.deepEqual(documents.map(document => document.name).sort(), Object.keys(imageByName).sort());
  for (const document of documents) assert.equal(document.img, expectedImage(document.name));

  for (const filename of Object.values(imageByName)) {
    const imagePath = path.join(root, "images", "loadout", filename);
    const metadata = await stat(imagePath);
    assert.ok(metadata.size > 0, `${filename} must not be empty`);
    const header = (await readFile(imagePath)).subarray(0, 12);
    assert.equal(header.subarray(0, 4).toString(), "RIFF");
    assert.equal(header.subarray(8, 12).toString(), "WEBP");
  }
});

test("active LevelDB item pack carries the same loadout images", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "brinkwood-loadout-icons-"));
  try {
    const packCopy = path.join(workspace, "pack");
    const extracted = path.join(workspace, "documents");
    await cp(path.join(root, "packs", "items"), packCopy, { recursive: true });
    await extractPack(packCopy, extracted);
    const files = (await readdir(extracted)).filter(file => file.endsWith(".json"));
    const documents = await Promise.all(files.map(async file => JSON.parse(
      await readFile(path.join(extracted, file), "utf8"),
    )));
    assert.equal(documents.length, Object.keys(imageByName).length);
    for (const document of documents) assert.equal(document.img, expectedImage(document.name));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("Character loadout rows render Item-owned images as decorative thumbnails", async () => {
  const template = await readFile(path.join(root, "templates", "actor-sheet.html"), "utf8");
  const sourceStyles = await readFile(path.join(root, "scss", "import", "character-sheet.scss"), "utf8");
  assert.match(template, /class="loadout__item-image" src="\{\{item\.img\}\}" alt=""/);
  assert.match(sourceStyles, /\.loadout__item-image\s*\{[^}]*object-fit:\s*contain;/);
});
