import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");

function contrastRatio(foreground, background) {
  const luminance = color => {
    const channels = color.slice(1).match(/../g).map(channel => parseInt(channel, 16) / 255);
    const [red, green, blue] = channels.map(value =>
      value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    );
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test("shared sheet palette meets WCAG contrast requirements", async () => {
  const [paletteSource, generalStyles] = await Promise.all([
    read("scss/style.scss"),
    read("scss/import/general-styles.scss")
  ]);
  const palette = Object.fromEntries(
    [...paletteSource.matchAll(/--bw-([\w-]+):\s*(#[\da-f]{6})/gi)].map(([, name, value]) => [name, value])
  );

  assert.ok(contrastRatio(palette.ink, palette.paper) >= 4.5);
  assert.ok(contrastRatio(palette.ink, palette["paper-deep"]) >= 4.5);
  assert.ok(contrastRatio(palette["ink-soft"], palette["paper-deep"]) >= 4.5);
  assert.ok(contrastRatio(palette.inverse, palette.ink) >= 4.5);
  assert.ok(contrastRatio(palette.focus, palette.paper) >= 3);
  assert.match(generalStyles, /\.window-content\s*\{[^}]*color:\s*var\(--bw-ink\)/s);
  assert.match(generalStyles, /\.label-stripe-gray\s*\{[^}]*color:\s*var\(--bw-ink\)/s);
  assert.match(generalStyles, /option\s*\{[^}]*background-color:\s*var\(--bw-ink\)/s);
});
