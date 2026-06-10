import { Router } from "express";
import { db } from "@workspace/db";
import { calendarEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/events", async (req, res) => {
  try {
    const events = await db.select().from(calendarEventsTable).orderBy(calendarEventsTable.startTime);
    res.json(events);
  } catch (err) {
    req.log.error({ err }, "Error fetching calendar events");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/events/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [event] = await db.select().from(calendarEventsTable).where(eq(calendarEventsTable.id, id));
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  } catch (err) {
    req.log.error({ err }, "Error fetching calendar event");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
