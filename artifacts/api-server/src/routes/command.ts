import { Router } from "express";
import { db } from "@workspace/db";
import { taskRunsTable } from "@workspace/db";
import { startTaskRun } from "../agents/task-executor.js";

const router = Router();

/**
 * POST /api/command
 * Accepts any natural-language command (typed or transcribed from voice)
 * and spins it up as a tracked, streaming task run.
 *
 * Body: { text: string, triggerType?: 'manual'|'scheduled'|'event', triggerSource?: string }
 * Returns: { taskRunId: string }
 */
router.post("/", async (req, res) => {
  const {
    text,
    triggerType   = "manual",
    triggerSource,
    agentId       = "claude",
  } = req.body as {
    text:          string;
    triggerType?:  string;
    triggerSource?: string;
    agentId?:      string;
  };

  if (!text?.trim()) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const [run] = await db
    .insert(taskRunsTable)
    .values({
      commandText:   text.trim(),
      triggerType,
      triggerSource: triggerSource ?? null,
      agentId,
      status:        "queued",
      steps:         [],
    })
    .returning({ id: taskRunsTable.id });

  // Non-blocking — response returns immediately while task runs in the background
  startTaskRun(run.id);

  res.status(201).json({ taskRunId: run.id });
});

export default router;
