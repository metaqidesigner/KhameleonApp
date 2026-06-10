import { Router } from "express";
import { db } from "@workspace/db";
import { memoryItemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateMemoryItemBody } from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const items = await db.select().from(memoryItemsTable).orderBy(memoryItemsTable.category);
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Error fetching memory items");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = CreateMemoryItemBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const [item] = await db.insert(memoryItemsTable).values(parsed.data).returning();
    res.status(201).json(item);
  } catch (err) {
    req.log.error({ err }, "Error creating memory item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.select().from(memoryItemsTable).where(eq(memoryItemsTable.id, id));
    if (!item) return res.status(404).json({ error: "Memory item not found" });
    if (item.isProtected) return res.status(403).json({ error: "Cannot delete protected memory" });

    await db.delete(memoryItemsTable).where(eq(memoryItemsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting memory item");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
