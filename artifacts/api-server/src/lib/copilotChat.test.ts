import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCopilotChatBody, cleanCopilotText, extractCopilotReply } from "./copilotChat.js";

test("newest user message is the question; instructions and earlier turns go in as context", () => {
  const body = buildCopilotChatBody("Be brief.", [
    { role: "user", content: "I work in finance." },
    { role: "assistant", content: "Noted." },
    { role: "user", content: "Which team am I in?" },
  ], "Australia/Sydney");
  assert.equal(body.message.text, "Which team am I in?");
  assert.deepEqual(body.locationHint, { timeZone: "Australia/Sydney" });
  assert.match(body.additionalContext![0].text, /Be brief\./);
  assert.match(body.additionalContext![1].text, /User: I work in finance\.\nAssistant: Noted\./);
});

test("no instructions or history means no extra context", () => {
  const body = buildCopilotChatBody("", [{ role: "user", content: "Hi" }], "UTC");
  assert.equal("additionalContext" in body, false);
});

test("reply is the last message, with Copilot's markup removed", () => {
  const reply = extractCopilotReply({ messages: [
    { text: "What meeting do I have?" },
    { text: "Meeting: <Event>Standup</Event> with <Person>John Doe</Person>[^1^]" },
  ] });
  assert.equal(reply, "Meeting: Standup with John Doe");
  assert.equal(cleanCopilotText("<File>a.docx</File>"), "a.docx");
  assert.equal(extractCopilotReply({ messages: [{ text: "only the question" }] }), "");
});
