import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, projectsTable, skillSetsTable, taskSkillSetSuggestionsTable } from "@workspace/db";
import { eq, and, ilike, ne, inArray } from "drizzle-orm";
import { CreateTaskBody, UpdateTaskBody } from "@workspace/api-zod";
import { suggestSkillSetForTask } from "../agents/skillSetSuggester.js";
import { logger } from "../lib/logger.js";

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

    // §15.2 contextual surfacing: join in any undismissed suggestion for
    // these tasks, dropped if its target Skill Set is no longer
    // 'available' (already installed/uninstalled by other means).
    const taskIds = tasks.map((t) => t.id);
    const suggestionMap = new Map<number, { skillSetId: number; name: string; reason: string }>();
    if (taskIds.length > 0) {
      const suggestions = await db
        .select({
          taskId: taskSkillSetSuggestionsTable.taskId,
          skillSetId: taskSkillSetSuggestionsTable.skillSetId,
          reason: taskSkillSetSuggestionsTable.reason,
          skillSetName: skillSetsTable.name,
          skillSetStatus: skillSetsTable.status,
        })
        .from(taskSkillSetSuggestionsTable)
        .innerJoin(skillSetsTable, eq(skillSetsTable.id, taskSkillSetSuggestionsTable.skillSetId))
        .where(and(inArray(taskSkillSetSuggestionsTable.taskId, taskIds), eq(taskSkillSetSuggestionsTable.dismissed, false)));

      for (const s of suggestions) {
        if (s.skillSetStatus !== "available") continue;
        suggestionMap.set(s.taskId, { skillSetId: s.skillSetId, name: s.skillSetName, reason: s.reason });
      }
    }

    return res.json(tasks.map((t) => ({
      ...t,
      projectName: t.projectId ? (projectMap.get(t.projectId) ?? null) : null,
      skillSetSuggestion: suggestionMap.get(t.id) ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "Error fetching tasks");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /tasks/completion-trend — design-spec.md §8: a chart "built from
 * a live read of the connected system at the moment it's generated...
 * not from a persisted analytics store." No completedAt column exists
 * on tasks - updatedAt is used as the completion timestamp, since the
 * $onUpdate trigger stamps it at the moment a task's status is set to
 * 'done', which is what this trend is actually measuring.
 */
router.get("/completion-trend", async (req, res) => {
  try {
    const doneTasks = await db.select().from(tasksTable).where(eq(tasksTable.status, "done"));

    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (13 - i));
      return d;
    });
    const buckets = days.map(d => ({
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      dayStart: d.getTime(),
      completed: 0,
    }));

    for (const t of doneTasks) {
      const ts = new Date(t.updatedAt).getTime();
      const bucket = buckets.find((b, i) => ts >= b.dayStart && (i === buckets.length - 1 || ts < buckets[i + 1].dayStart));
      if (bucket) bucket.completed += 1;
    }

    return res.json(buckets.map(({ label, completed }) => ({ label, completed })));
  } catch (err) {
    req.log.error({ err }, "Error computing task completion trend");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /tasks/daily — today's tasks bucketed by day section ──────────────────
router.get("/daily", async (req, res) => {
  try {
    const [activeTasks, doneTasks] = await Promise.all([
      db.select().from(tasksTable)
        .where(ne(tasksTable.status, "done"))
        .orderBy(tasksTable.createdAt),
      db.select({ id: tasksTable.id }).from(tasksTable)
        .where(eq(tasksTable.status, "done")),
    ]);

    const sections: Record<string, typeof activeTasks> = {
      start_of_day:  [],
      core_work:     [],
      meetings:      [],
      communication: [],
      administrative:[],
      end_of_day:    [],
    };

    for (const task of activeTasks) {
      const section = toSection(task);
      sections[section].push(task);

      // Recurring tasks also surface in Start of Day (flagged, not duplicated)
      if ((task.recurrence === "daily" || task.recurrence === "weekly") && section !== "start_of_day") {
        // We flag them rather than duplicate — client reads the `recurrence` field
      }
    }

    return res.json({
      sections,
      total: activeTasks.length,
      doneCount: doneTasks.length,
      byCategory: Object.fromEntries(
        ["communication","meetings","deep_work","task_project_management","administrative","planning"]
          .map(cat => [cat, activeTasks.filter(t => t.category === cat).length])
      ),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching daily tasks");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * §15.2 contextual surfacing: after a task is created, check whether any
 * not-yet-installed ('available') Skill Set closely matches it and
 * record the match if so. Fire-and-forget, called only after the task's
 * own response has already been sent - a failure here (no ANTHROPIC_API_KEY
 * configured, a network error, an unparseable reply) never affects task
 * creation itself, matching classifyComplexity's own degrade-gracefully
 * shape (agents/task-executor.ts).
 */
async function computeSkillSetSuggestion(task: { id: number; title: string; description: string }): Promise<void> {
  try {
    const candidates = await db
      .select({ id: skillSetsTable.id, name: skillSetsTable.name, description: skillSetsTable.description })
      .from(skillSetsTable)
      .where(eq(skillSetsTable.status, "available"));
    if (candidates.length === 0) return;

    const match = await suggestSkillSetForTask(task, candidates);
    if (!match) return;

    await db.insert(taskSkillSetSuggestionsTable).values({
      taskId: task.id,
      skillSetId: match.skillSetId,
      reason: match.reason,
    });
  } catch (err) {
    logger.warn({ err, taskId: task.id }, "Error computing Skill Set suggestion for new task");
  }
}

// ── POST /tasks — create ──────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const parsed = CreateTaskBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });

    const [task] = await db.insert(tasksTable).values(parsed.data).returning();
    void computeSkillSetSuggestion(task);
    return res.status(201).json({ ...task, projectName: null });
  } catch (err) {
    req.log.error({ err }, "Error creating task");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /tasks/:id/skill-set-suggestion/dismiss ───────────────────────────────
// §15.2: "A dismissed suggestion does not repeat for the same task thread."
// Idempotent-success if there's nothing to dismiss - that isn't an error.
router.post("/:id/skill-set-suggestion/dismiss", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db
      .update(taskSkillSetSuggestionsTable)
      .set({ dismissed: true })
      .where(and(eq(taskSkillSetSuggestionsTable.taskId, id), eq(taskSkillSetSuggestionsTable.dismissed, false)));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error dismissing skill set suggestion");
    return res.status(500).json({ error: "Internal server error" });
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
    return res.json({ ...updated, projectName: null });
  } catch (err) {
    req.log.error({ err }, "Error updating task");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /tasks/:id ─────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const deleted = await db.transaction(async (tx) => {
      // Verify the task exists before touching any children
      const [existing] = await tx.select({ id: tasksTable.id })
        .from(tasksTable)
        .where(eq(tasksTable.id, id));
      if (!existing) return null;

      // Promote direct children to root tasks (atomic with the delete)
      await tx.update(tasksTable)
        .set({ parentTaskId: null })
        .where(eq(tasksTable.parentTaskId, id));

      const [row] = await tx.delete(tasksTable).where(eq(tasksTable.id, id)).returning();
      return row ?? null;
    });

    if (!deleted) return res.status(404).json({ error: "Task not found" });
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting task");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
