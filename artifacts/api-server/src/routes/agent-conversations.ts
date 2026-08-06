/**
 * GET /api/agent-conversations
 * Filterable by agentId, sessionId, and limit.
 * Returns DB-persisted conversation rows in chronological order.
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { agentConversationsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { agentId, sessionId, limit = "100" } = req.query as Record<string, string>;
    const lim = Math.min(Math.max(1, parseInt(limit, 10) || 100), 500);

    // Build conditions
    const conditions = [];
    if (agentId)   conditions.push(eq(agentConversationsTable.agentId, agentId));
    if (sessionId) conditions.push(eq(agentConversationsTable.sessionId, sessionId));

    const rows = await db
      .select()
      .from(agentConversationsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(agentConversationsTable.createdAt))
      .limit(lim);

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Error fetching agent conversations");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /api/agent-conversations/sessions — distinct session IDs with metadata */
router.get("/sessions", async (req, res) => {
  try {
    const { agentId, limit = "50" } = req.query as Record<string, string>;
    const lim = Math.min(Math.max(1, parseInt(limit, 10) || 50), 200);

    // Get the most recent row per session (for summary display)
    const rows = await db.execute(sql`
      SELECT DISTINCT ON (session_id)
        session_id   AS "sessionId",
        agent_id     AS "agentId",
        created_at   AS "createdAt",
        content      AS "preview"
      FROM agent_conversations
      ${agentId ? sql`WHERE agent_id = ${agentId}` : sql``}
      ORDER BY session_id, created_at DESC
      LIMIT ${lim}
    `);

    res.json(rows.rows ?? rows);
  } catch (err) {
    req.log.error({ err }, "Error fetching sessions");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
