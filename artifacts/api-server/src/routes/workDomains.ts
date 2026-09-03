import { Router } from "express";
import { db } from "@workspace/db";
import { workDomainsTable, entityWorkDomainsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

// GET / — design-spec.md §17: the user's full set of Work Domains (seeded
// illustrative examples + anything they've created), no fixed taxonomy.
router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(workDomainsTable).orderBy(workDomainsTable.id);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Error fetching work domains");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  const { name, description } = req.body as { name?: string; description?: string };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  try {
    const [domain] = await db.insert(workDomainsTable).values({ name: name.trim(), description: description ?? "" }).returning();
    res.status(201).json(domain);
  } catch (err) {
    req.log.error({ err }, "Error creating work domain");
    res.status(500).json({ error: "Internal server error" });
  }
});

// §17.1: users may rename, merge, split, delete, or invent domains freely - rename is a plain update.
router.put("/:id", async (req, res) => {
  const { name, description } = req.body as { name?: string; description?: string };
  try {
    const id = parseInt(req.params.id, 10);
    const patch: Partial<{ name: string; description: string }> = {};
    if (name?.trim()) patch.name = name.trim();
    if (description !== undefined) patch.description = description;
    const [updated] = await db.update(workDomainsTable).set(patch).where(eq(workDomainsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Work domain not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error updating work domain");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Deleting a domain is local and reversible (it's just a label) - cascades
// by removing its tag rows so no Skill Set/Integration is left pointing
// at a domain that no longer exists.
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [deleted] = await db.delete(workDomainsTable).where(eq(workDomainsTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Work domain not found" }); return; }
    await db.delete(entityWorkDomainsTable).where(eq(entityWorkDomainsTable.workDomainId, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting work domain");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /entity/:type/:id — replace an entity's full set of domain tags in one call.
router.put("/entity/:type/:id", async (req, res) => {
  const entityType = req.params.type;
  const entityId = req.params.id;
  const { workDomainIds } = req.body as { workDomainIds?: number[] };
  if (entityType !== "skill_set" && entityType !== "integration") {
    res.status(400).json({ error: "type must be 'skill_set' or 'integration'" });
    return;
  }
  try {
    await db.delete(entityWorkDomainsTable).where(
      and(eq(entityWorkDomainsTable.entityType, entityType), eq(entityWorkDomainsTable.entityId, entityId)),
    );
    for (const workDomainId of workDomainIds ?? []) {
      await db.insert(entityWorkDomainsTable).values({ entityType, entityId, workDomainId });
    }
    res.json({ ok: true, workDomainIds: workDomainIds ?? [] });
  } catch (err) {
    req.log.error({ err }, "Error tagging entity with work domains");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
