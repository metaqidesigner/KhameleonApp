/**
 * Microsoft Graph mail client for the outlook-draft-email skill
 * (design-spec.md §12.1). A thin, typed wrapper — no framework code, just
 * Graph calls authenticated via the stored Microsoft OAuth token
 * (oauthTokens.ts), following the same pattern as spotify.ts's
 * spotifyFetch. Scopes used: Mail.Read (implicit in Mail.ReadWrite),
 * Mail.ReadWrite (fetch/draft), Mail.Send (send only — see sendDraft).
 */

import { getFreshToken } from "./oauthTokens.js";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export interface GraphEmailAddress {
  emailAddress: { name?: string; address: string };
}

export interface GraphMessage {
  id: string;
  conversationId: string;
  subject: string;
  from: GraphEmailAddress | null;
  toRecipients: GraphEmailAddress[];
  bodyPreview: string;
  body: { contentType: string; content: string };
  receivedDateTime: string;
  categories?: string[];
  flag?: { flagStatus: string };
  parentFolderId?: string;
}

const MESSAGE_FIELDS = "id,conversationId,subject,from,toRecipients,bodyPreview,body,receivedDateTime";
const TRIAGE_MESSAGE_FIELDS = "id,conversationId,subject,from,toRecipients,bodyPreview,receivedDateTime,categories,flag,parentFolderId";

async function graphFetch(path: string, init: RequestInit = {}): Promise<globalThis.Response> {
  const token = await getFreshToken("microsoft");
  return fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
}

async function assertOk(res: globalThis.Response, action: string): Promise<void> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Graph ${action} failed: ${res.status} ${text}`);
  }
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function getMessage(messageId: string): Promise<GraphMessage> {
  const res = await graphFetch(`/me/messages/${encodeURIComponent(messageId)}?$select=${MESSAGE_FIELDS}`);
  await assertOk(res, "get message");
  return res.json() as Promise<GraphMessage>;
}

export async function listConversationMessages(conversationId: string): Promise<GraphMessage[]> {
  const filter = encodeURIComponent(`conversationId eq '${conversationId.replace(/'/g, "''")}'`);
  const res = await graphFetch(`/me/messages?$filter=${filter}&$orderby=receivedDateTime asc&$select=${MESSAGE_FIELDS}`);
  await assertOk(res, "list conversation messages");
  const json = (await res.json()) as { value: GraphMessage[] };
  return json.value;
}

/** Unread messages in the inbox, newest first — the input to outlook-triage-inbox (§12.3). */
export async function listUnreadInboxMessages(top = 50): Promise<GraphMessage[]> {
  const res = await graphFetch(
    `/me/mailFolders/inbox/messages?$filter=isRead eq false&$orderby=receivedDateTime desc&$top=${top}&$select=${TRIAGE_MESSAGE_FIELDS}`
  );
  await assertOk(res, "list unread inbox messages");
  const json = (await res.json()) as { value: GraphMessage[] };
  return json.value;
}

/**
 * The N most recent inbox messages regardless of read state — lets a user
 * pick a real message id for outlook-draft-email/outlook-summarize-thread
 * instead of having to find one via Graph Explorer or another tool first.
 */
export async function listRecentInboxMessages(top = 15): Promise<GraphMessage[]> {
  const res = await graphFetch(
    `/me/mailFolders/inbox/messages?$orderby=receivedDateTime desc&$top=${top}&$select=${TRIAGE_MESSAGE_FIELDS}`
  );
  await assertOk(res, "list recent inbox messages");
  const json = (await res.json()) as { value: GraphMessage[] };
  return json.value;
}

// ── Writes ────────────────────────────────────────────────────────────────────

/** Creates a draft reply to `messageId` (Mail.ReadWrite) — never sends it. */
export async function createReplyDraft(messageId: string): Promise<GraphMessage> {
  const res = await graphFetch(`/me/messages/${encodeURIComponent(messageId)}/createReply`, {
    method: "POST",
    body: "{}",
  });
  await assertOk(res, "create reply draft");
  return res.json() as Promise<GraphMessage>;
}

/** Overwrites a draft's body (Mail.ReadWrite). Used for both the initial compose and later edits. */
export async function updateDraftBody(draftId: string, content: string): Promise<void> {
  const res = await graphFetch(`/me/messages/${encodeURIComponent(draftId)}`, {
    method: "PATCH",
    body: JSON.stringify({ body: { contentType: "text", content } }),
  });
  await assertOk(res, "update draft body");
}

/**
 * The one and only Mail.Send call this skill ever makes — fired exclusively
 * from routes/outlookSkills.ts's /send endpoint, on explicit user
 * confirmation. Never called as part of the draft pipeline (§12.1).
 */
export async function sendDraft(draftId: string): Promise<void> {
  const res = await graphFetch(`/me/messages/${encodeURIComponent(draftId)}/send`, { method: "POST" });
  await assertOk(res, "send draft");
}

/** Best-effort cleanup when a draft is rejected instead of sent. */
export async function deleteDraft(draftId: string): Promise<void> {
  const res = await graphFetch(`/me/messages/${encodeURIComponent(draftId)}`, { method: "DELETE" });
  await assertOk(res, "delete draft");
}

/**
 * Sets flag/categories on a message in place (Mail.ReadWrite) — used by
 * outlook-triage-inbox (§12.3). Both fields are optional so undo can pass
 * back only what it needs to restore.
 */
export async function updateMessageTriageState(
  messageId: string,
  patch: { flagStatus?: "flagged" | "notFlagged"; categories?: string[] }
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.flagStatus) body.flag = { flagStatus: patch.flagStatus };
  if (patch.categories) body.categories = patch.categories;
  if (Object.keys(body).length === 0) return;

  const res = await graphFetch(`/me/messages/${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  await assertOk(res, "update message triage state");
}

/**
 * Moves a message to another folder (Mail.ReadWrite) — e.g. "archive" or
 * "inbox" (Graph accepts these well-known folder names directly, no lookup
 * needed). IMPORTANT: Graph's classic mail API assigns the moved message a
 * NEW id in its destination folder — the returned message's `id` is what
 * every later reference (including undo) must use, not the original id.
 */
export async function moveMessage(messageId: string, destinationFolderId: string): Promise<GraphMessage> {
  const res = await graphFetch(`/me/messages/${encodeURIComponent(messageId)}/move`, {
    method: "POST",
    body: JSON.stringify({ destinationId: destinationFolderId }),
  });
  await assertOk(res, "move message");
  return res.json() as Promise<GraphMessage>;
}

// ── Pure helpers (unit-testable without network — see outlookGraph.test.ts) ──

export function recipientLine(msg: Pick<GraphMessage, "toRecipients">): string {
  return msg.toRecipients?.map((r) => r.emailAddress.address).join(", ") || "(unknown recipient)";
}

export function replySubject(subject: string | null | undefined): string {
  const s = (subject ?? "").trim();
  if (!s) return "Re:";
  return /^re:/i.test(s) ? s : `Re: ${s}`;
}

/**
 * The frontend displays/edits payload as "Subject: X\n\n<body>" (matching
 * the existing ConfirmGate demo's convention, since ConfirmGate has no
 * separate subject field) but the Graph message body must be just the body
 * text - a literal "Subject: ..." line has no business ending up in a real
 * sent email. Strips that leading line back off before it's written to Graph.
 */
export function stripSubjectPrefix(text: string): string {
  const match = text.match(/^Subject:.*\n\n([\s\S]*)$/);
  return match ? match[1] : text;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function threadToPlainText(messages: Pick<GraphMessage, "from" | "body" | "bodyPreview" | "receivedDateTime">[]): string {
  return messages
    .map((m) => {
      const from = m.from?.emailAddress?.address ?? "(unknown sender)";
      // `||`, not `??` - an empty-string body.content (present but blank)
      // should still fall through to bodyPreview, not stop there.
      const body = stripHtml(m.body?.content || m.bodyPreview || "");
      return `From: ${from}\nDate: ${m.receivedDateTime}\n\n${body}`;
    })
    .join("\n\n---\n\n");
}
