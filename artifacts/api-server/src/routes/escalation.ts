import { Router } from "express";
import type { ChatMessage } from "../agents/types.js";
import { detectConfidential, looksTricky, type EscalationMode } from "../lib/escalation.js";
import { getEscalationMode, setEscalationMode } from "../lib/escalationSettings.js";
import { firstOutsideAI, aiLabel } from "../lib/askAI.js";

/**
 * Khami step 5: before the chat sends a message to Khami, it asks here
 * (plain code, instant) whether the conversation is confidential and
 * whether the task looks beyond Khami - and if so, which outside AI to
 * offer (Copilot first). The chat route itself enforces the lock.
 */
const router = Router();

router.get("/settings", async (_req, res) => {
  res.json({ mode: await getEscalationMode() });
});

router.put("/settings", async (req, res) => {
  const mode = (req.body ?? {}).mode as EscalationMode;
  if (mode !== "ask" && mode !== "auto" && mode !== "never") { res.status(400).json({ error: "Choose ask, auto or never." }); return; }
  await setEscalationMode(mode);
  res.json({ mode });
});

/** Is this conversation confidential (by what's in it, or because the user locked it)? */
export function conversationConfidential(messages: ChatMessage[] | undefined, locked?: boolean): { confidential: boolean; reasons: string[] } {
  if (locked) return { confidential: true, reasons: ["you marked it confidential"] };
  const text = (messages ?? []).filter(m => m.role === "user").map(m => m.content).join("\n");
  return detectConfidential(text);
}

router.post("/check", async (req, res) => {
  const { messages, agentId, confidential: locked } = req.body as { messages?: ChatMessage[]; agentId?: string; confidential?: boolean };
  const conf = conversationConfidential(messages, locked);
  const last = [...(messages ?? [])].reverse().find(m => m.role === "user")?.content ?? "";
  const tricky = looksTricky(last);
  const mode = await getEscalationMode();
  let offer: { id: string; name: string } | null = null;
  if (agentId === "khami" && tricky.tricky && !conf.confidential && mode !== "never") {
    const a = await firstOutsideAI();
    if (a) offer = { id: a.id, name: aiLabel(a) };
  }
  res.json({ confidential: conf.confidential, reasons: conf.reasons, tricky: tricky.tricky, reason: tricky.reason ?? null, offer, mode });
});

export default router;
