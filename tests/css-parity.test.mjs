import assert from "node:assert/strict";
import test from "node:test";

import { cssContentsMatch } from "../scripts/css-parity.mjs";

test("CSS parity accepts CRLF-only generated stylesheet differences", () => {
  assert.equal(
    cssContentsMatch(Buffer.from(".sheet { color: red; }\r\n"), Buffer.from(".sheet { color: red; }\n")),
    true,
  );
});

test("CSS parity rejects substantive generated stylesheet differences", () => {
  assert.equal(
    cssContentsMatch(Buffer.from(".sheet { color: red; }\n"), Buffer.from(".sheet { color: blue; }\n")),
    false,
  );
});
