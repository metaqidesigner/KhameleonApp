import { test } from "node:test";
import assert from "node:assert/strict";
import { toKhamiTurns } from "./khamiHistory.js";

test("earlier turns become history, newest user message becomes the prompt", () => {
  const t = toKhamiTurns([
    { role: "user", content: "Hi" },
    { role: "assistant", content: "Hello!" },
    { role: "user", content: "Summarise this." },
  ]);
  assert.equal(t.prompt, "Summarise this.");
  assert.deepEqual(t.history, [{ type: "user", text: "Hi" }, { type: "model", response: ["Hello!"] }]);
});

test("empty messages are skipped; no user message means no prompt", () => {
  assert.equal(toKhamiTurns([{ role: "user", content: "Q" }, { role: "assistant", content: "" }]).prompt, "Q");
  assert.equal(toKhamiTurns([{ role: "assistant", content: "only me" }]).prompt, "");
});
