import { Router } from "express";
import { db } from "@workspace/db";
import { integrationDirectoryTable, entityWorkDomainsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getConnectorStatusMap } from "./connectors.js";

const router = Router();

/**
 * design-spec.md §16 Integrations directory. Connection status is never
 * stored here - it's joined at read time from getConnectorStatusMap()
 * (routes/connectors.ts), which checks the real oauth_tokens table. One
 * source of truth for "is this connected", not two that could drift.
 * Connect/disconnect continue to go through the existing real OAuth
 * flow in routes/auth.ts - this route is a read-only directory.
 */
router.get("/", async (req, res) => {
  try {
    const [rows, statusMap, tagRows] = await Promise.all([
      db.select().from(integrationDirectoryTable).orderBy(integrationDirectoryTable.id),
      getConnectorStatusMap(),
      db.select().from(entityWorkDomainsTable).where(eq(entityWorkDomainsTable.entityType, "integration")),
    ]);

    const tagsByEntity = new Map<string, number[]>();
    for (const t of tagRows) {
      const list = tagsByEntity.get(t.entityId) ?? [];
      list.push(t.workDomainId);
      tagsByEntity.set(t.entityId, list);
    }

    const result = rows.map((r) => ({
      ...r,
      connected: statusMap[r.id] ?? false,
      workDomainIds: tagsByEntity.get(r.id) ?? [],
    }));
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error fetching integrations directory");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
