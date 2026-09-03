/**
 * outlook-triage-inbox skill (design-spec.md §12.3) HTTP surface.
 *
 *   POST /api/skills/outlook-triage-inbox        — classify + act on unread mail
 *   POST /api/skills/outlook-triage-inbox/undo   — reverse a set of triage actions
 *
 * No /send or hard-gate step here, unlike outlook-draft-email — flagging,
 * categorizing, and archiving only touch the user's own mailbox and are
 * all easily reversible (§6.5.3), so the whole run is a quiet action
 * receipt with real undo (§6.5.2), not a ConfirmGate.
 */

import { Router, type Request, type Response } from "express";
import { db, tasksTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { isConnected } from "../lib/oauthTokens.js";
import { runOutlookTriageInbox, undoTriageItem, type TriageUndoEntry } from "../agents/skills/outlookTriageInbox.js";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    if (!(await isConnected("microsoft"))) {
      res.status(409).json({ error: "Outlook is not connected. Connect it at /api/auth/oauth/microsoft/start." });
      return;
    }

    const result = await runOutlookTriageInbox();
    res.status(201).json(result);
  } catch (err) {
    req.log.error({ err }, "outlook-triage-inbox run failed");
    res.status(502).json({ error: err instanceof Error ? err.message : "Pipeline failed" });
  }
});

router.post("/undo", async (req: Request, res: Response) => {
  try {
    const { entries, taskIds } = req.body as { entries?: TriageUndoEntry[]; taskIds?: number[] };
    if (!Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ error: "entries (non-empty array) is required" });
      return;
    }

    // Best-effort per item - one failure shouldn't block restoring the rest.
    const results = await Promise.allSettled(entries.map((entry) => undoTriageItem(entry)));
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

    if (failures.length > 0) {
      req.log.warn({ failures: failures.map((f) => String(f.reason)) }, "Some triage undo entries failed");
    }

    // Undoing a triage run also removes the Tasks it created from that run's
    // action items - otherwise "undo" leaves real, unexplained tasks behind
    // even though the mailbox state they were derived from was reverted.
    let tasksDeleted = 0;
    if (Array.isArray(taskIds) && taskIds.length > 0) {
      try {
        const deleted = await db.delete(tasksTable).where(inArray(tasksTable.id, taskIds)).returning({ id: tasksTable.id });
        tasksDeleted = deleted.length;
      } catch (err) {
        req.log.warn({ err, taskIds }, "Failed to delete tasks created by an undone triage run");
      }
    }

    res.json({
      ok: failures.length === 0,
      restored: entries.length - failures.length,
      failed: failures.length,
      tasksDeleted,
    });
  } catch (err) {
    req.log.error({ err }, "outlook-triage-inbox undo failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
