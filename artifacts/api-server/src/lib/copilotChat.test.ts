import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { buildCopilotChatBody, cleanCopilotText, extractCopilotReply, askCopilot } from "./copilotChat.js";

/**
 * A stand-in for Microsoft's Copilot Chat API, following the request and
 * response shapes in Microsoft's documentation (POST /conversations with {},
 * then POST /conversations/{id}/chat). Lets Khameleon's side be tested
 * end to end without a Copilot-licensed account.
 */
function copilotStandIn(opts: { status?: number } = {}) {
  const seen: { path: string; auth?: string; body: unknown }[] = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", c => (raw += c));
    req.on("end", () => {
      const body = raw ? JSON.parse(raw) : undefined;
      seen.push({ path: req.url ?? "", auth: req.headers.authorization, body });
      res.setHeader("Content-Type", "application/json");
      if (opts.status) { res.statusCode = opts.status; res.end("{}"); return; }
      if (req.method === "POST" && req.url === "/conversations") {
        res.statusCode = 201;
        res.end(JSON.stringify({ id: "0d110e7e-2b7e-4270-a899-fd2af6fde333", createdDateTime: "2026-10-18T00:00:00Z", displayName: "", status: "active", turnCount: 0 }));
        return;
      }
      const m = req.url?.match(/^\/conversations\/([^/]+)\/chat$/);
      if (req.method === "POST" && m) {
        const text = (body as { message: { text: string } }).message.text;
        res.end(JSON.stringify({
          id: m[1], state: "active", turnCount: 1,
          messages: [
            { "@odata.type": "#microsoft.graph.copilotConversationResponseMessage", id: "a", text },
            { "@odata.type": "#microsoft.graph.copilotConversationResponseMessage", id: "b", text: "You have <Event>Contoso Standup</Event> at 9 AM with <Person>John Doe</Person>[^1^]." },
          ],
        }));
        return;
      }
      res.statusCode = 404; res.end("{}");
    });
  });
  return new Promise<{ url: string; seen: typeof seen; close: () => void }>(resolve => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ url: `http://127.0.0.1:${port}/conversations`, seen, close: () => server.close() });
    });
  });
}

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

test("end to end against a Copilot stand-in: starts a conversation, sends the question with context, returns a clean answer", async () => {
  const stand = await copilotStandIn();
  try {
    const r = await askCopilot("Be brief.", [
      { role: "user", content: "I work in finance." },
      { role: "assistant", content: "Noted." },
      { role: "user", content: "What meeting do I have at 9 AM tomorrow?" },
    ], { baseUrl: stand.url, getToken: async () => "test-token" });
    assert.equal(r.content, "You have Contoso Standup at 9 AM with John Doe.");
    assert.equal(stand.seen.length, 2);
    assert.equal(stand.seen[0].path, "/conversations");
    assert.deepEqual(stand.seen[0].body, {});
    assert.equal(stand.seen[0].auth, "Bearer test-token");
    assert.equal(stand.seen[1].path, "/conversations/0d110e7e-2b7e-4270-a899-fd2af6fde333/chat");
    const chat = stand.seen[1].body as { message: { text: string }; additionalContext: { text: string }[]; locationHint: { timeZone: string } };
    assert.equal(chat.message.text, "What meeting do I have at 9 AM tomorrow?");
    assert.ok(chat.locationHint.timeZone.length > 0);
    assert.match(chat.additionalContext[1].text, /I work in finance/);
  } finally {
    stand.close();
  }
});

test("a 403 from Microsoft becomes a plain explanation about the licence", async () => {
  const stand = await copilotStandIn({ status: 403 });
  try {
    await assert.rejects(
      askCopilot("", [{ role: "user", content: "hi" }], { baseUrl: stand.url, getToken: async () => "t" }),
      /Microsoft 365 Copilot licence/,
    );
  } finally {
    stand.close();
  }
});
