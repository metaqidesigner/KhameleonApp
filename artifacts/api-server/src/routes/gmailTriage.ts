import { Router } from "express";
import { inArray } from "drizzle-orm";
import { db, tasksTable } from "@workspace/db";
import { isConnected } from "../lib/oauthTokens.js";
import { runGmailTriageInbox, undoGmailTriageItem, type GmailUndoEntry } from "../agents/skills/gmailTriageInbox.js";

/** POST /api/skills/gmail-triage-inbox (sort) and /undo - the Gmail twin of outlook-triage-inbox. */
const router = Router();

router.post("/", async (req, res) => {
  if (!(await isConnected("google"))) { res.status(409).json({ error: "Gmail isn't connected - connect it in Integrations." }); return; }
  try { res.status(201).json(await runGmailTriageInbox()); }
  catch (err) { req.log.error({ err }, "gmail triage failed"); res.status(502).json({ error: err instanceof Error ? err.message : "Sorting failed" }); }
});

router.post("/undo", async (req, res) => {
  const { entries, taskIds } = req.body as { entries?: GmailUndoEntry[]; taskIds?: number[] };
  if (!Array.isArray(entries) || !entries.length) { res.status(400).json({ error: "Nothing to undo." }); return; }
  const results = await Promise.allSettled(entries.map(undoGmailTriageItem));
  const failed = results.filter(r => r.status === "rejected").length;
  if (Array.isArray(taskIds) && taskIds.length) await db.delete(tasksTable).where(inArray(tasksTable.id, taskIds)).catch(() => undefined);
  res.json({ restored: entries.length - failed, failed });
});

export default router;
