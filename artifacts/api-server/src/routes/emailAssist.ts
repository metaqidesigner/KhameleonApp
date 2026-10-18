import { Router } from "express";
import { db, actionReceiptsTable } from "@workspace/db";
import { askAgent, isAgentAvailable } from "../agents/gateway.js";
import { findAgent } from "../agents/defaults.js";
import { isConnected } from "../lib/oauthTokens.js";
import * as outlook from "../lib/outlookGraph.js";
import * as gmail from "../lib/gmailApi.js";
import { assistPrompt, rewritePrompt, parseAssist, subjectMatches, looksLikeAPerson, splitSender, type AssistEmail } from "../lib/emailAssist.js";

/**
 * Email assistant (docs/build-review.md, Build 4 answers + Build 9 open-email
 * detection). The desktop app says which email window is open; this finds
 * the email through the user's Outlook or Gmail connection, and Khami -
 * on this computer - writes a summary, a suggested reply and up to three
 * actions. Microsoft 365 Copilot is used only when the user picks "Ask
 * Copilot". Nothing is ever sent: "Use this reply" saves a draft.
 */
const router = Router();

type Source = "outlook" | "gmail";

export interface FoundEmail {
  source: Source;
  id: string;
  subject: string;
  from: string;
  fromName: string;
  unread: boolean;
  isPerson: boolean;
  receivedAt?: string;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

router.get("/status", async (_req, res) => {
  const khami = findAgent("khami");
  const copilot = findAgent("copilot");
  const [k, c, o, g] = await Promise.all([
    khami ? isAgentAvailable(khami) : false,
    copilot ? isAgentAvailable(copilot) : false,
    isConnected("microsoft").catch(() => false),
    isConnected("google").catch(() => false),
  ]);
  res.json({ khami: k, copilot: c, outlook: o, gmail: g });
});

/** Finds the open email by the subject (and sender, if known) the desktop app saw. */
router.post("/find", async (req, res) => {
  const { client, subject, sender } = req.body as { client?: string; subject?: string; sender?: string };
  if (!subject?.trim()) { res.status(400).json({ error: "No email subject to look for." }); return; }
  const senderAddress = sender ? splitSender(sender).address : "";
  const order: Source[] = client === "gmail" ? ["gmail", "outlook"] : ["outlook", "gmail"];
  try {
    for (const source of order) {
      if (source === "outlook" && (await isConnected("microsoft").catch(() => false))) {
        const list = await outlook.listRecentInboxMessages(30);
        const m = list.find((x) => subjectMatches(subject, x.subject) && (!senderAddress || (x.from?.emailAddress?.address ?? "").toLowerCase() === senderAddress))
          ?? list.find((x) => subjectMatches(subject, x.subject));
        if (m) {
          const from = m.from?.emailAddress ? `${m.from.emailAddress.name} <${m.from.emailAddress.address}>` : "";
          res.json({ found: { source, id: m.id, subject: m.subject, from, fromName: m.from?.emailAddress?.name ?? "", unread: m.isRead === false, isPerson: looksLikeAPerson(from), receivedAt: m.receivedDateTime } satisfies FoundEmail });
          return;
        }
      }
      if (source === "gmail" && (await isConnected("google").catch(() => false))) {
        const list = await gmail.listRecentInboxMessages(30);
        const m = list.find((x) => subjectMatches(subject, x.subject) && (!senderAddress || splitSender(x.from).address === senderAddress))
          ?? list.find((x) => subjectMatches(subject, x.subject));
        if (m) {
          res.json({ found: { source, id: m.id, subject: m.subject, from: m.from, fromName: splitSender(m.from).name, unread: m.unread, isPerson: looksLikeAPerson(m.from, { gmailLabels: m.labelIds }), receivedAt: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : undefined } satisfies FoundEmail });
          return;
        }
      }
    }
    res.json({ found: null });
  } catch (err) {
    req.log.error({ err }, "email-assist find failed");
    res.status(502).json({ error: errorText(err) });
  }
});

/** The email's text, from the connection (or as the desktop app read it). */
async function loadEmail(body: { source?: Source; id?: string; email?: AssistEmail }): Promise<AssistEmail> {
  if (body.source === "outlook" && body.id) {
    const m = await outlook.getMessage(body.id);
    const from = m.from?.emailAddress ? `${m.from.emailAddress.name} <${m.from.emailAddress.address}>` : "";
    const text = m.body?.contentType === "html" ? outlook.stripHtml(m.body.content) : (m.body?.content ?? m.bodyPreview ?? "");
    return { subject: m.subject ?? "", from, body: text };
  }
  if (body.source === "gmail" && body.id) {
    const m = await gmail.getMessage(body.id);
    return { subject: m.subject, from: m.from, body: m.body };
  }
  if (body.email && (body.email.body || body.email.subject)) {
    return { subject: String(body.email.subject ?? ""), from: String(body.email.from ?? ""), body: String(body.email.body ?? "") };
  }
  throw Object.assign(new Error("Khameleon couldn't read this email - connect Outlook or Gmail (Integrations), or open the email in its own window."), { status: 400 });
}

/** Khami by default; Copilot only when the user asked for it. */
async function pickAgent(which: unknown) {
  const id = which === "copilot" ? "copilot" : "khami";
  const agent = findAgent(id);
  if (agent && (await isAgentAvailable(agent))) return agent;
  throw Object.assign(new Error(id === "copilot"
    ? "Microsoft 365 Copilot isn't connected - connect it from Integrations."
    : "Khami isn't set up yet - set it up from the head menu (Khami setup), or choose Ask Copilot."), { status: 503 });
}

function fail(req: { log: { error: (o: object, m: string) => void } }, res: { status: (n: number) => { json: (b: unknown) => void } }, err: unknown, what: string) {
  const status = (err as { status?: number }).status;
  if (!status) req.log.error({ err }, what);
  res.status(status ?? 502).json({ error: errorText(err) });
}

router.post("/help", async (req, res) => {
  try {
    const email = await loadEmail(req.body);
    const agent = await pickAgent(req.body?.agent);
    const reply = await askAgent(agent, [{ role: "user", content: assistPrompt(email) }]);
    if (reply.error) { res.status(502).json({ error: reply.error }); return; }
    res.json({ ...parseAssist(reply.content), by: agent.id === "khami" ? "Khami" : agent.id === "copilot" ? "Copilot" : agent.name, email: { subject: email.subject, from: email.from } });
  } catch (err) {
    fail(req, res, err, "email-assist help failed");
  }
});

router.post("/rewrite", async (req, res) => {
  const { reply, how } = req.body as { reply?: string; how?: string };
  if (!reply?.trim() || !how?.trim()) { res.status(400).json({ error: "Nothing to change." }); return; }
  try {
    const email = await loadEmail(req.body);
    const agent = await pickAgent(req.body?.agent);
    const out = await askAgent(agent, [{ role: "user", content: rewritePrompt(email, reply, how.trim()) }]);
    if (out.error) { res.status(502).json({ error: out.error }); return; }
    res.json({ reply: out.content.replace(/^```\w*\n?|```$/g, "").trim() });
  } catch (err) {
    fail(req, res, err, "email-assist rewrite failed");
  }
});

/** Saves the reply as a draft in Outlook/Gmail. Never sends. */
router.post("/draft", async (req, res) => {
  const { source, id, reply } = req.body as { source?: Source; id?: string; reply?: string };
  if (!reply?.trim() || !id || (source !== "outlook" && source !== "gmail")) { res.status(400).json({ error: "Nothing to save." }); return; }
  try {
    let subject = "";
    if (source === "outlook") {
      const draft = await outlook.createReplyDraft(id, reply.trim());
      subject = draft.subject ?? "";
    } else {
      const original = await gmail.getMessage(id);
      const draft = await gmail.createReplyDraft(original, reply.trim());
      subject = draft.subject;
    }
    const where = source === "outlook" ? "Outlook" : "Gmail";
    await db.insert(actionReceiptsTable).values({
      description: `Saved a reply draft in ${where} (not sent)`,
      category: "email_draft", scope: source, outcome: "success", target: subject || "(no subject)", canUndo: false,
    });
    res.json({ saved: true, where });
  } catch (err) {
    fail(req, res, err, "email-assist draft failed");
  }
});

export default router;
