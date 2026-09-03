import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, tasksTable } from "@workspace/db";
import { and, eq, count } from "drizzle-orm";
import { CreateProjectBody, UpdateProjectBody } from "@workspace/api-zod";

const router = Router();

/**
 * Real task counts for a project. Factored out because this was previously
 * wrong in three different ways across three handlers: the list endpoint's
 * "completed" count ran the exact same query as "total" (no status filter
 * at all, so completedTaskCount === taskCount for every project); the
 * detail endpoint filtered on the string "completed", but tasksTable's
 * actual status values are todo | in_progress | done | blocked (see
 * lib/db/src/schema/tasks.ts) - "completed" never matches anything; and
 * PATCH hardcoded completedTaskCount: 0 unconditionally. Found during the
 * 2026-09-03 backend-route audit.
 */
async function getTaskCounts(projectId: number): Promise<{ taskCount: number; completedTaskCount: number }> {
  const [total] = await db.select({ count: count() }).from(tasksTable).where(eq(tasksTable.projectId, projectId));
  const [completed] = await db
    .select({ count: count() })
    .from(tasksTable)
    .where(and(eq(tasksTable.projectId, projectId), eq(tasksTable.status, "done")));
  return { taskCount: total?.count ?? 0, completedTaskCount: completed?.count ?? 0 };
}

router.get("/", async (req, res) => {
  try {
    const projects = await db.select().from(projectsTable).orderBy(projectsTable.createdAt);
    const result = await Promise.all(
      projects.map(async (p) => ({ ...p, ...(await getTaskCounts(p.id)) }))
    );
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error fetching projects");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = CreateProjectBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const [project] = await db.insert(projectsTable).values(parsed.data).returning();
    res.status(201).json({ ...project, taskCount: 0, completedTaskCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Error creating project");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!project) return res.status(404).json({ error: "Project not found" });

    res.json({ ...project, ...(await getTaskCounts(id)) });
  } catch (err) {
    req.log.error({ err }, "Error fetching project");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = UpdateProjectBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const [updated] = await db
      .update(projectsTable)
      .set(parsed.data)
      .where(eq(projectsTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Project not found" });

    res.json({ ...updated, ...(await getTaskCounts(id)) });
  } catch (err) {
    req.log.error({ err }, "Error updating project");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/tasks", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const tasks = await db.select().from(tasksTable).where(eq(tasksTable.projectId, id));
    const project = await db.select().from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
    const projectName = project[0]?.name ?? "";
    res.json(tasks.map((t) => ({ ...t, projectName })));
  } catch (err) {
    req.log.error({ err }, "Error fetching project tasks");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
