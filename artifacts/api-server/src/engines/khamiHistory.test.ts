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

test("dateContext gives today and the real dates of the coming week", async () => {
  const { dateContext } = await import("./khamiHistory.js");
  const text = dateContext(new Date(2026, 9, 18, 14, 0)); // Sunday 18 October 2026
  assert.match(text, /Today is Sunday,? 18 October 2026 \(2026-10-18\)/);
  assert.match(text, /Friday 2026-10-23/);
  assert.match(text, /Monday 2026-10-19/);
});
