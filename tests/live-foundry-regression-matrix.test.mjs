import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const matrix = new URL("./LIVE-FOUNDRY-REGRESSION-MATRIX.md", import.meta.url);

test("the live Foundry release matrix retains its required manual coverage", async () => {
  const contents = await readFile(matrix, "utf8");
  const required = [
    "does **not** execute Foundry",
    "Preconditions and evidence",
    "L01", "L02", "L03", "L04", "L05", "L06", "L07", "L08", "L09",
    "every registered Actor sheet and every registered Item sheet/template",
    "primary tab/view state",
    "Exactly one authoritative document commit",
    "every Item sheet Effect section",
    "root form keeps its vertical scroll position",
    "ProseMirror",
    "non-owner player",
    "deterministically elected GM",
    "migration version is not advanced on failure",
    "700, 620, 480, and 410",
    "Clock boundary",
    "Do not test a dedicated Clock Actor or scene-token synchronization"
  ];

  for (const phrase of required) assert.ok(contents.includes(phrase), `missing matrix coverage: ${phrase}`);
});
