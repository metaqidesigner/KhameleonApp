import { Router } from "express";
import { db } from "@workspace/db";
import { inboxItemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateInboxItemBody } from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const items = await db.select().from(inboxItemsTable).orderBy(inboxItemsTable.createdAt);
    res.json(items.reverse());
  } catch (err) {
    req.log.error({ err }, "Error fetching inbox");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = UpdateInboxItemBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const [updated] = await db
      .update(inboxItemsTable)
      .set(parsed.data)
      .where(eq(inboxItemsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Item not found" });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error updating inbox item");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
