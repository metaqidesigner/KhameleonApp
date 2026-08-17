import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, projectsTable } from "@workspace/db";
import { eq, and, ilike, ne } from "drizzle-orm";
import { CreateTaskBody, UpdateTaskBody } from "@workspace/api-zod";

const router = Router();

// ── Category → day-section mapping ───────────────────────────────────────────
const SECTION_MAP: Record<string, string> = {
  planning:                  "start_of_day",
  deep_work:                 "core_work",
  meetings:                  "meetings",
  communication:             "communication",
  administrative:            "administrative",
  task_project_management:   "end_of_day",
};

function toSection(task: { category: string; recurrence: string }): string {
  // Recurring tasks always appear in Start of Day too (handled client-side via flag)
  return SECTION_MAP[task.category] ?? "core_work";
}

// ── GET /tasks — filtered list ────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { category, priority, recurrence, source, status, q } = req.query as Record<string, string | undefined>;

    const conditions = [];
    if (category)   conditions.push(eq(tasksTable.category,   category));
    if (priority)   conditions.push(eq(tasksTable.priority,   priority));
    if (recurrence) conditions.push(eq(tasksTable.recurrence, recurrence));
    if (source)     conditions.push(eq(tasksTable.source,     source));
    if (status)     conditions.push(eq(tasksTable.status,     status));
    if (q)          conditions.push(ilike(tasksTable.title,   `%${q}%`));

    const tasks = await db.select().from(tasksTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(tasksTable.createdAt);

    const projects = await db.select().from(projectsTable);
    const projectMap = new Map(projects.map((p) => [p.id, p.name]));

    res.json(tasks.map((t) => ({
      ...t,
      projectName: t.projectId ? (projectMap.get(t.projectId) ?? null) : null,
    })));
  } catch (err) {
    req.log.error({ err }, "Error fetching tasks");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /tasks/daily — today's tasks bucketed by day section ──────────────────
router.get("/daily", async (req, res) => {
  try {
    const tasks = await db.select().from(tasksTable)
      .where(ne(tasksTable.status, "done"))
      .orderBy(tasksTable.createdAt);

    const sections: Record<string, typeof tasks> = {
      start_of_day:  [],
      core_work:     [],
      meetings:      [],
      communication: [],
      administrative:[],
      end_of_day:    [],
    };

    for (const task of tasks) {
      const section = toSection(task);
      sections[section].push(task);

      // Recurring tasks also surface in Start of Day (flagged, not duplicated)
      if ((task.recurrence === "daily" || task.recurrence === "weekly") && section !== "start_of_day") {
        // We flag them rather than duplicate — client reads the `recurrence` field
      }
    }

    res.json({
      sections,
      total: tasks.length,
      byCategory: Object.fromEntries(
        ["communication","meetings","deep_work","task_project_management","administrative","planning"]
          .map(cat => [cat, tasks.filter(t => t.category === cat).length])
      ),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching daily tasks");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /tasks — create ──────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const parsed = CreateTaskBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });

    const [task] = await db.insert(tasksTable).values(parsed.data).returning();
    res.status(201).json({ ...task, projectName: null });
  } catch (err) {
    req.log.error({ err }, "Error creating task");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PATCH /tasks/:id — update ─────────────────────────────────────────────────
router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = UpdateTaskBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const [updated] = await db.update(tasksTable).set(parsed.data).where(eq(tasksTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Task not found" });
    res.json({ ...updated, projectName: null });
  } catch (err) {
    req.log.error({ err }, "Error updating task");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /tasks/:id ─────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db.delete(tasksTable).where(eq(tasksTable.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "Task not found" });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting task");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
