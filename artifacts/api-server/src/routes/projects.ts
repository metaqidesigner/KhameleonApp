import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, tasksTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { CreateProjectBody, UpdateProjectBody } from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const projects = await db.select().from(projectsTable).orderBy(projectsTable.createdAt);
    const result = await Promise.all(
      projects.map(async (p) => {
        const [totalResult] = await db.select({ count: count() }).from(tasksTable).where(eq(tasksTable.projectId, p.id));
        const [completedResult] = await db.select({ count: count() }).from(tasksTable).where(eq(tasksTable.projectId, p.id));
        return {
          ...p,
          taskCount: totalResult?.count ?? 0,
          completedTaskCount: completedResult?.count ?? 0,
        };
      })
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

    const [totalResult] = await db.select({ count: count() }).from(tasksTable).where(eq(tasksTable.projectId, id));
    const tasks = await db.select().from(tasksTable).where(eq(tasksTable.projectId, id));
    const completedCount = tasks.filter((t) => t.status === "completed").length;

    res.json({
      ...project,
      taskCount: totalResult?.count ?? 0,
      completedTaskCount: completedCount,
    });
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

    const [totalResult] = await db.select({ count: count() }).from(tasksTable).where(eq(tasksTable.projectId, id));
    res.json({ ...updated, taskCount: totalResult?.count ?? 0, completedTaskCount: 0 });
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
