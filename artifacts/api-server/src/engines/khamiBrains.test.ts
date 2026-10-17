import { test } from "node:test";
import assert from "node:assert/strict";
import { recommendBrain, pickActiveBrain, BRAINS } from "./khamiBrains.js";

test("recommends Better only with enough memory", () => {
  assert.equal(recommendBrain(8), "standard");
  assert.equal(recommendBrain(15.9), "standard");
  assert.equal(recommendBrain(16), "better");
});

test("uses the saved brain if downloaded, else the best downloaded one", () => {
  assert.equal(pickActiveBrain("standard", new Set(["standard", "better"])), "standard");
  assert.equal(pickActiveBrain("better", new Set(["standard"])), "standard");
  assert.equal(pickActiveBrain(null, new Set(["standard", "better"])), "better");
  assert.equal(pickActiveBrain(null, new Set()), null);
});

test("every brain is a commercially licensed Qwen 2.5 Instruct build", () => {
  for (const b of Object.values(BRAINS)) assert.match(b.uri, /^hf:Qwen\/Qwen2\.5-(1\.5B|7B)-Instruct-GGUF:/);
});
