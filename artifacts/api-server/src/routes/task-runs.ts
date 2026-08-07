import { Router } from "express";
import { db } from "@workspace/db";
import { taskRunsTable } from "@workspace/db";
import { eq, desc, and, or, ilike, inArray } from "drizzle-orm";
import { taskEvents } from "../agents/taskEvents.js";
import { startTaskRun } from "../agents/task-executor.js";

const router = Router();

// ── GET /api/task-runs — list with filters ───────────────────

router.get("/", async (req, res) => {
  try {
    const {
      status,
      triggerType,
      q,
      limit = "50",
    } = req.query as Record<string, string>;

    const lim = Math.min(Math.max(1, parseInt(limit, 10) || 50), 200);

    const conditions = [];
    if (status) {
      const statuses = status.split(",").map((s) => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        conditions.push(eq(taskRunsTable.status, statuses[0]));
      } else if (statuses.length > 1) {
        conditions.push(inArray(taskRunsTable.status, statuses));
      }
    }
    if (triggerType) {
      const types = triggerType.split(",").map((t) => t.trim()).filter(Boolean);
      if (types.length === 1) {
        conditions.push(eq(taskRunsTable.triggerType, types[0]));
      } else if (types.length > 1) {
        conditions.push(inArray(taskRunsTable.triggerType, types));
      }
    }
    if (q) {
      conditions.push(ilike(taskRunsTable.commandText, `%${q}%`));
    }

    const rows = await db
      .select()
      .from(taskRunsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(taskRunsTable.createdAt))
      .limit(lim);

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Error listing task runs");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/task-runs/:id ───────────────────────────────────

router.get("/:id", async (req, res) => {
  try {
    const [run] = await db
      .select()
      .from(taskRunsTable)
      .where(eq(taskRunsTable.id, req.params.id))
      .limit(1);

    if (!run) {
      res.status(404).json({ error: "Task run not found" });
      return;
    }
    res.json(run);
  } catch (err) {
    req.log.error({ err }, "Error fetching task run");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/task-runs/:id/stream — live SSE stream ─────────

router.get("/:id/stream", async (req, res) => {
  const { id } = req.params;

  try {
    const [task] = await db
      .select()
      .from(taskRunsTable)
      .where(eq(taskRunsTable.id, id))
      .limit(1);

    if (!task) {
      res.status(404).json({ error: "Task run not found" });
      return;
    }

    res.setHeader("Content-Type",  "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection",    "keep-alive");
    res.flushHeaders();

    const send = (data: unknown) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    };

    // Send current snapshot so client can render immediately
    send({ type: "init", task });

    // If the task is already terminal, send the final event and close
    if (task.status === "completed") {
      send({ type: "done", summary: task.resultSummary, preview: task.previewContent });
      res.end();
      return;
    }
    if (task.status === "failed") {
      send({ type: "error", error: task.errorMessage, retryFromStep: task.retryFromStep ?? 0 });
      res.end();
      return;
    }
    if (task.status === "cancelled") {
      send({ type: "cancelled" });
      res.end();
      return;
    }

    // Subscribe to in-process events for running/queued tasks
    const listener = (event: unknown) => {
      send(event);
      const e = event as Record<string, unknown>;
      if (e.type === "done" || e.type === "error" || e.type === "cancelled") {
        setImmediate(() => {
          if (!res.writableEnded) res.end();
        });
      }
    };

    const channel = `task:${id}`;
    taskEvents.on(channel, listener);

    req.on("close", () => {
      taskEvents.off(channel, listener);
    });
  } catch (err) {
    req.log.error({ err }, "Error streaming task run");
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/task-runs/:id/retry ────────────────────────────

router.post("/:id/retry", async (req, res) => {
  try {
    const [task] = await db
      .select()
      .from(taskRunsTable)
      .where(eq(taskRunsTable.id, req.params.id))
      .limit(1);

    if (!task) {
      res.status(404).json({ error: "Task run not found" });
      return;
    }
    if (task.status === "running") {
      res.status(409).json({ error: "Task is already running" });
      return;
    }

    const retryFrom = task.retryFromStep ?? 0;
    await db
      .update(taskRunsTable)
      .set({ status: "queued", retryCount: (task.retryCount ?? 0) + 1, updatedAt: new Date() })
      .where(eq(taskRunsTable.id, req.params.id));

    startTaskRun(req.params.id, retryFrom);
    res.json({ ok: true, retryFromStep: retryFrom });
  } catch (err) {
    req.log.error({ err }, "Error retrying task run");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/task-runs/:id/cancel ───────────────────────────

router.post("/:id/cancel", async (req, res) => {
  try {
    await db
      .update(taskRunsTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(taskRunsTable.id, req.params.id));

    taskEvents.emit(`task:${req.params.id}`, {
      type:   "cancelled",
      taskId: req.params.id,
    });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error cancelling task run");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
