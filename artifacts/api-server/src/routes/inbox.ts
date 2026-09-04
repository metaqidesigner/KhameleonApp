import { Router } from "express";
import { db } from "@workspace/db";
import { inboxItemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateInboxItemBody } from "@workspace/api-zod";
import { getFreshToken, isConnected } from "../lib/oauthTokens.js";

const router = Router();

/**
 * Normalised inbox item shape - matches inbox_items' real DB columns
 * (lib/db/src/schema/inbox.ts) exactly, since that's the more
 * authoritative, already-established shape. The live Gmail/Outlook
 * fetch functions below used to return a different, ad hoc shape
 * (`type`/`title`/`content` instead of `source`/`subject`/`summary`,
 * missing `classification`/`aiRecommendation`/etc. entirely) - a real
 * bug nothing ever caught, since GET / returned one shape or the other
 * depending on which branch ran, with no shared type checking either
 * against the other or against the DB rows the fallback branch returns
 * unmapped. A frontend built against either shape alone would have
 * silently broken against the other.
 */
interface InboxItem {
  id: string | number;
  source: string;
  sourceIcon: string;
  sender: string;
  subject: string;
  summary: string;
  priority: string;
  classification: string;
  aiRecommendation: string;
  relatedProject: string;
  priorityScore: number;
  isRead: boolean;
  isArchived: boolean;
  createdAt: string;
}

// ── Google Gmail fetch ────────────────────────────────────────────────────────
async function fetchGmail(): Promise<InboxItem[]> {
  const token = await getFreshToken("google");

  // 1. List recent inbox message IDs
  const listRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=30",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!listRes.ok) throw new Error(`Gmail list failed: ${listRes.status}`);
  const listJson = await listRes.json() as { messages?: { id: string }[] };
  const ids = listJson.messages?.map(m => m.id) ?? [];

  // 2. Fetch metadata for each message in parallel
  const details = await Promise.all(
    ids.map(id =>
      fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token}` } }
      ).then(r => r.json()) as Promise<{
        id: string;
        snippet: string;
        labelIds: string[];
        payload: { headers: { name: string; value: string }[] };
        internalDate: string;
      }>
    )
  );

  return details.map(msg => {
    const header = (name: string) =>
      msg.payload.headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
    return {
      id: msg.id,
      source: "gmail",
      sourceIcon: "gmail",
      sender: header("From"),
      subject: header("Subject") || "(no subject)",
      summary: msg.snippet ?? "",
      priority: "normal",
      // These four are AI-enrichment fields the DB fallback carries but
      // a raw provider fetch has no equivalent for - honest defaults,
      // not fabricated values.
      classification: "task",
      aiRecommendation: "",
      relatedProject: "",
      priorityScore: 50,
      isRead: !msg.labelIds.includes("UNREAD"),
      isArchived: false,
      createdAt: msg.internalDate
        ? new Date(parseInt(msg.internalDate)).toISOString()
        : new Date().toISOString(),
    };
  });
}

// ── Microsoft Graph fetch ─────────────────────────────────────────────────────
async function fetchOutlook(): Promise<InboxItem[]> {
  const token = await getFreshToken("microsoft");
  const res = await fetch(
    "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages" +
    "?$top=30&$orderby=receivedDateTime+desc" +
    "&$select=id,subject,from,receivedDateTime,bodyPreview,isRead,importance",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Outlook fetch failed: ${res.status}`);
  const json = await res.json() as {
    value: {
      id: string;
      subject: string;
      from: { emailAddress: { address: string; name: string } };
      receivedDateTime: string;
      bodyPreview: string;
      isRead: boolean;
      importance: string;
    }[];
  };
  return json.value.map(msg => ({
    id: msg.id,
    source: "outlook",
    sourceIcon: "outlook",
    sender: msg.from?.emailAddress?.name
      ? `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>`
      : (msg.from?.emailAddress?.address ?? ""),
    subject: msg.subject || "(no subject)",
    summary: msg.bodyPreview ?? "",
    priority: msg.importance === "high" ? "high" : "normal",
    classification: "task",
    aiRecommendation: "",
    relatedProject: "",
    priorityScore: 50,
    isRead: msg.isRead,
    isArchived: false,
    createdAt: msg.receivedDateTime,
  }));
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * `source` in the response tells the frontend which path served the
 * list: PATCH /:id below only ever writes to the local DB table (its
 * `id` is a serial int; Gmail/Outlook ids are opaque provider strings
 * that will never match a DB row), so "mark as read" can only actually
 * work when source === 'local' - the frontend uses this to gate that
 * control honestly instead of offering a button that would silently
 * 404 against a live-provider item.
 */
router.get("/", async (req, res) => {
  try {
    // Try live providers first (Google then Microsoft), fall back to DB
    const [googleOk, msOk] = await Promise.all([
      isConnected("google"),
      isConnected("microsoft"),
    ]);

    if (googleOk) {
      const items = await fetchGmail();
      res.json({ items, source: "gmail" });
      return;
    }
    if (msOk) {
      const items = await fetchOutlook();
      res.json({ items, source: "outlook" });
      return;
    }

    // No connector — serve from local DB
    const items = await db.select().from(inboxItemsTable).orderBy(inboxItemsTable.createdAt);
    res.json({ items: items.reverse(), source: "local" });
  } catch (err) {
    req.log.error({ err }, "Error fetching inbox");
    // Fall back to DB on any upstream error
    try {
      const items = await db.select().from(inboxItemsTable).orderBy(inboxItemsTable.createdAt);
      res.json({ items: items.reverse(), source: "local" });
    } catch {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = UpdateInboxItemBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
    const [updated] = await db
      .update(inboxItemsTable)
      .set(parsed.data)
      .where(eq(inboxItemsTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Item not found" });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error updating inbox item");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
