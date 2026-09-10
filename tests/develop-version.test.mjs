import assert from "node:assert/strict";
import test from "node:test";

import { createDevelopVersion } from "../scripts/develop-version.mjs";

test("develop builds extend the current release candidate", () => {
  assert.equal(createDevelopVersion("1.0.0-rc.3", 42, 1), "1.0.0-rc.3.dev.42.1");
});

test("develop builds replace an existing development build number", () => {
  assert.equal(createDevelopVersion("1.0.1-dev.0", 42, 2), "1.0.1-dev.42.2");
});

test("develop builds reject stable source versions", () => {
  assert.throws(
    () => createDevelopVersion("1.0.0", 42),
    /Start the next development line/,
  );
});

test("develop builds reject invalid build numbers", () => {
  assert.throws(() => createDevelopVersion("1.0.0-rc.3", "0"), /Invalid development build sequence/);
});
