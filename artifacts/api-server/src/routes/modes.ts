import { Router } from "express";
import { db } from "@workspace/db";
import { operatingModesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SetCurrentModeBody } from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const modes = await db.select().from(operatingModesTable).orderBy(operatingModesTable.id);
    res.json(modes);
  } catch (err) {
    req.log.error({ err }, "Error fetching modes");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/current", async (req, res) => {
  try {
    const [active] = await db
      .select()
      .from(operatingModesTable)
      .where(eq(operatingModesTable.isActive, true))
      .limit(1);
    if (!active) {
      const [first] = await db.select().from(operatingModesTable).limit(1);
      return res.json(first ?? { id: 1, name: "Work Mode", description: "Standard work configuration", icon: "Briefcase", isActive: true, color: "cyan" });
    }
    res.json(active);
  } catch (err) {
    req.log.error({ err }, "Error fetching current mode");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/current", async (req, res) => {
  try {
    const parsed = SetModeBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    // Deactivate all modes
    await db.update(operatingModesTable).set({ isActive: false });

    // Activate selected mode
    const [updated] = await db
      .update(operatingModesTable)
      .set({ isActive: true })
      .where(eq(operatingModesTable.id, parsed.data.modeId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Mode not found" });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error setting mode");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
