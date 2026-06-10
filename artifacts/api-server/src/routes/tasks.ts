import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateTaskBody, UpdateTaskBody } from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const tasks = await db.select().from(tasksTable).orderBy(tasksTable.createdAt);
    const projects = await db.select().from(projectsTable);
    const projectMap = new Map(projects.map((p) => [p.id, p.name]));
    res.json(tasks.map((t) => ({ ...t, projectName: t.projectId ? (projectMap.get(t.projectId) ?? null) : null })));
  } catch (err) {
    req.log.error({ err }, "Error fetching tasks");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = CreateTaskBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const [task] = await db.insert(tasksTable).values(parsed.data).returning();
    res.status(201).json({ ...task, projectName: null });
  } catch (err) {
    req.log.error({ err }, "Error creating task");
    res.status(500).json({ error: "Internal server error" });
  }
});

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

export default router;
