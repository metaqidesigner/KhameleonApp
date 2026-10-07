/**
 * Integration tests for recordBriefingTurn - the mechanism that lets the
 * desktop Chat Window resume a Mobile Briefing session later (see
 * briefing.ts's docblock on recordBriefingTurn, and routes/briefing.ts's
 * /session/log route that wraps it over HTTP).
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@workspace/db";
import { agentConversationsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { recordBriefingTurn, InvalidBriefingTurnError } from "./briefing.js";

const sessionIds: string[] = [];
function freshSessionId(): string {
  const id = `__briefing_test__${Date.now()}_${Math.random().toString(36).slice(2)}`;
  sessionIds.push(id);
  return id;
}

after(async () => {
  if (sessionIds.length > 0) {
    await db.delete(agentConversationsTable).where(inArray(agentConversationsTable.sessionId, sessionIds));
  }
});

test("recordBriefingTurn persists a real row under agentId 'briefing'", async () => {
  const sessionId = freshSessionId();
  await recordBriefingTurn(sessionId, "assistant", "Urgent: reply to Acme Consulting. Say send it, skip, or change the tone.");

  const rows = await db.select().from(agentConversationsTable).where(eq(agentConversationsTable.sessionId, sessionId));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].agentId, "briefing");
  assert.equal(rows[0].role, "assistant");
  assert.equal(rows[0].content, "Urgent: reply to Acme Consulting. Say send it, skip, or change the tone.");
});

test("recordBriefingTurn keeps multiple turns in the same session queryable together", async () => {
  const sessionId = freshSessionId();
  await recordBriefingTurn(sessionId, "assistant", "I've drafted a reply. Say send it, skip, or change the tone.");
  await recordBriefingTurn(sessionId, "user", "send it");
  await recordBriefingTurn(sessionId, "assistant", "Sent the reply.");

  const rows = await db.select().from(agentConversationsTable).where(eq(agentConversationsTable.sessionId, sessionId));
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.role).sort(), ["assistant", "assistant", "user"]);
});

test("recordBriefingTurn rejects an empty sessionId before touching the database", async () => {
  await assert.rejects(() => recordBriefingTurn("", "user", "send it"), InvalidBriefingTurnError);
});

test("recordBriefingTurn rejects a role that isn't 'user' or 'assistant'", async () => {
  await assert.rejects(() => recordBriefingTurn(freshSessionId(), "tool_use", "x"), InvalidBriefingTurnError);
});

test("recordBriefingTurn rejects empty content", async () => {
  await assert.rejects(() => recordBriefingTurn(freshSessionId(), "user", "   "), InvalidBriefingTurnError);
});
