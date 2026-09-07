import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CHARACTER_ACTOR_IMAGE,
  DEFAULT_MASK_ACTOR_IMAGE,
  DEFAULT_NPC_ACTOR_IMAGE,
  DEFAULT_REBELION_ACTOR_IMAGE,
  characterActorImage,
  maskActorImage,
  npcActorImage,
  rebelionActorImage,
} from "../module/actor-images.js";

test("actor image helpers replace only Foundry's generic portrait", () => {
  for (const emptyImage of [undefined, null, "", "   ", "icons/svg/mystery-man.svg"]) {
    assert.equal(characterActorImage(emptyImage), DEFAULT_CHARACTER_ACTOR_IMAGE);
    assert.equal(maskActorImage(emptyImage), DEFAULT_MASK_ACTOR_IMAGE);
    assert.equal(npcActorImage(emptyImage), DEFAULT_NPC_ACTOR_IMAGE);
    assert.equal(rebelionActorImage(emptyImage), DEFAULT_REBELION_ACTOR_IMAGE);
  }

  const customPortrait = "worlds/test/images/custom-npc.webp";
  assert.equal(characterActorImage(customPortrait), customPortrait);
  assert.equal(maskActorImage(customPortrait), customPortrait);
  assert.equal(npcActorImage(customPortrait), customPortrait);
  assert.equal(rebelionActorImage(customPortrait), customPortrait);
  assert.equal(new Set([
    DEFAULT_CHARACTER_ACTOR_IMAGE,
    DEFAULT_MASK_ACTOR_IMAGE,
    DEFAULT_NPC_ACTOR_IMAGE,
    DEFAULT_REBELION_ACTOR_IMAGE,
  ]).size, 4);
  assert.notEqual(DEFAULT_NPC_ACTOR_IMAGE, DEFAULT_MASK_ACTOR_IMAGE);
});
