import assert from "node:assert/strict";
import test from "node:test";
import { handleActorNameEnter, persistActorNameChange } from "../module/sheet-dom.js";

const editableSheet = name => {
  const calls = [];
  return {
    isEditable: true,
    document: {
      name,
      async update(update, options) { calls.push({ update, options }); },
    },
    calls,
  };
};

test("Actor Name Enter only prevents native submission and blurs once", () => {
  const event = {
    key: "Enter",
    isComposing: false,
    prevented: 0,
    blurred: 0,
    preventDefault() { this.prevented += 1; },
    currentTarget: { blur() { event.blurred += 1; } },
  };
  assert.equal(handleActorNameEnter(event), true);
  assert.deepEqual({ prevented: event.prevented, blurred: event.blurred }, { prevented: 1, blurred: 1 });
});

test("Actor Name ignores non-Enter and composing key events", () => {
  for (const event of [
    { key: "a", isComposing: false },
    { key: "Enter", isComposing: true },
  ]) {
    event.prevented = 0;
    event.blurred = 0;
    event.preventDefault = () => { event.prevented += 1; };
    event.currentTarget = { blur: () => { event.blurred += 1; } };
    assert.equal(handleActorNameEnter(event), false);
    assert.deepEqual({ prevented: event.prevented, blurred: event.blurred }, { prevented: 0, blurred: 0 });
  }
});

test("Actor Name blur/change persists exactly once with a Foundry-visible render", async () => {
  const sheet = editableSheet("Old Name");
  const input = { name: "name", type: "text", value: "  New Name  " };
  await persistActorNameChange(sheet, { currentTarget: input });
  assert.deepEqual(sheet.calls, [{ update: { name: "  New Name  " }, options: { render: true } }]);
  assert.equal(input.value, "  New Name  ");
});

test("Actor Name Enter-driven blur uses the same one-update change path", async () => {
  const sheet = editableSheet("Old Name");
  const input = {
    name: "name",
    type: "text",
    value: "New Name",
    blur: async () => persistActorNameChange(sheet, { currentTarget: input }),
  };
  const event = { key: "Enter", isComposing: false, preventDefault() {}, currentTarget: input };
  assert.equal(handleActorNameEnter(event), true);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(sheet.calls, [{ update: { name: "New Name" }, options: { render: true } }]);
});

test("Actor Name preserves submitted values and ignores only unchanged or read-only inputs", async () => {
  const sheet = editableSheet("Existing");
  await persistActorNameChange(sheet, { currentTarget: { name: "name", type: "text", value: "Existing" } });
  await persistActorNameChange(sheet, { currentTarget: { name: "name", type: "text", value: "   " } });
  await persistActorNameChange(sheet, { currentTarget: { name: "name", type: "text", value: "Other", disabled: true } });
  assert.deepEqual(sheet.calls, [{ update: { name: "   " }, options: { render: true } }]);
});
