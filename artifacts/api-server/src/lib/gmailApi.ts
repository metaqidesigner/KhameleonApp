/**
 * Gmail API client for the gmail-draft-email skill (mirrors
 * outlookGraph.ts's role for outlook-draft-email, §12.1) — closes the
 * "Gmail is read-only" gap flagged in the 2026-10-01 function audit.
 * Thin, typed wrapper, authenticated via the stored Google OAuth token
 * (oauthTokens.ts). Scopes used: gmail.modify (read + draft),
 * gmail.send (send only — see sendDraft). Both are already requested in
 * the Google OAuth consent screen (routes/auth.ts) but were never
 * actually used by anything until this.
 *
 * Gmail's draft API is structurally different from Graph's, not just a
 * different base URL: there's no "create an empty reply draft, then PATCH
 * its body" two-step - a draft's full RFC 2822 MIME content (headers and
 * body together) must be provided as base64url in `raw` at creation, and
 * again on every update. So recipient/subject/threading headers are
 * rebuilt from the original message on every create/update call here,
 * rather than set once - callers pass the original message through each
 * time instead of just a draft id + new body text.
 */

import { getFreshToken } from "./oauthTokens.js";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

interface GmailHeader { name: string; value: string }
interface GmailPayload {
  mimeType?: string;
  headers?: GmailHeader[];
  body?: { data?: string };
  parts?: GmailPayload[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  /** The RFC Message-ID header, needed for In-Reply-To/References on a reply. */
  messageIdHeader: string;
  body: string;
}

async function gmailFetch(path: string, init: RequestInit = {}): Promise<globalThis.Response> {
  const token = await getFreshToken("google");
  return fetch(`${GMAIL_BASE}${path}`, {
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
    throw new Error(`Gmail ${action} failed: ${res.status} ${text}`);
  }
}

function headerValue(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function encodeBase64Url(data: string): string {
  return Buffer.from(data, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Walks MIME parts depth-first for the first text/plain body - falls back to the top-level body if there are no parts (a simple, non-multipart message). */
function extractPlainTextBody(payload: GmailPayload): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) return decodeBase64Url(payload.body.data);
  for (const part of payload.parts ?? []) {
    const found = extractPlainTextBody(part);
    if (found) return found;
  }
  if (!payload.parts && payload.body?.data) return decodeBase64Url(payload.body.data);
  return "";
}

function toMessage(json: { id: string; threadId: string; snippet?: string; payload: GmailPayload }): GmailMessage {
  const headers = json.payload.headers;
  return {
    id: json.id,
    threadId: json.threadId,
    from: headerValue(headers, "From"),
    subject: headerValue(headers, "Subject"),
    messageIdHeader: headerValue(headers, "Message-ID") || headerValue(headers, "Message-Id"),
    body: stripHtml(extractPlainTextBody(json.payload) || json.snippet || ""),
  };
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function getMessage(messageId: string): Promise<GmailMessage> {
  const res = await gmailFetch(`/messages/${encodeURIComponent(messageId)}?format=full`);
  await assertOk(res, "get message");
  const json = (await res.json()) as { id: string; threadId: string; snippet?: string; payload: GmailPayload };
  return toMessage(json);
}

export async function getThreadMessages(threadId: string): Promise<GmailMessage[]> {
  const res = await gmailFetch(`/threads/${encodeURIComponent(threadId)}?format=full`);
  await assertOk(res, "get thread");
  const json = (await res.json()) as { messages: { id: string; threadId: string; snippet?: string; payload: GmailPayload }[] };
  return json.messages.map(toMessage);
}

/** The N most recent inbox messages, newest first - lets a user pick a real message id instead of finding one via an external tool. */
export async function listRecentInboxMessages(max = 15): Promise<{ id: string; subject: string; from: string; preview: string; internalDate: string }[]> {
  const listRes = await gmailFetch(`/messages?labelIds=INBOX&maxResults=${max}`);
  await assertOk(listRes, "list inbox messages");
  const listJson = (await listRes.json()) as { messages?: { id: string }[] };
  const ids = listJson.messages?.map((m) => m.id) ?? [];

  const details = await Promise.all(
    ids.map(async (id) => {
      const res = await gmailFetch(`/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`);
      await assertOk(res, "get message metadata");
      return res.json() as Promise<{ id: string; snippet: string; internalDate: string; payload: GmailPayload }>;
    })
  );

  return details.map((m) => ({
    id: m.id,
    subject: headerValue(m.payload.headers, "Subject") || "(no subject)",
    from: headerValue(m.payload.headers, "From") || "(unknown sender)",
    preview: (m.snippet ?? "").slice(0, 140),
    internalDate: m.internalDate,
  }));
}

// ── Writes ────────────────────────────────────────────────────────────────────

function extractEmailAddress(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return match ? match[1] : fromHeader.trim();
}

function buildReplyMime(opts: { to: string; subject: string; inReplyTo: string; body: string }): string {
  const lines = [
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    opts.inReplyTo ? `In-Reply-To: ${opts.inReplyTo}` : null,
    opts.inReplyTo ? `References: ${opts.inReplyTo}` : null,
    `Content-Type: text/plain; charset="UTF-8"`,
    "",
    opts.body,
  ].filter((l): l is string => l !== null);
  return lines.join("\r\n");
}

export interface GmailDraftRef {
  id: string;
  to: string;
  subject: string;
}

/** Creates a real (unsent) reply draft in the same thread as `original`, with `body` as its full content. */
export async function createReplyDraft(original: GmailMessage, body: string): Promise<GmailDraftRef> {
  const to = extractEmailAddress(original.from);
  const subject = replySubject(original.subject);
  const raw = encodeBase64Url(buildReplyMime({ to, subject, inReplyTo: original.messageIdHeader, body }));

  const res = await gmailFetch(`/drafts`, {
    method: "POST",
    body: JSON.stringify({ message: { raw, threadId: original.threadId } }),
  });
  await assertOk(res, "create draft");
  const json = (await res.json()) as { id: string };
  return { id: json.id, to, subject };
}

/** Overwrites a draft's full content - Gmail has no partial-update for just the body, so headers are rebuilt from `original` again here. */
export async function updateDraftBody(draftId: string, original: GmailMessage, newBody: string): Promise<void> {
  const to = extractEmailAddress(original.from);
  const subject = replySubject(original.subject);
  const raw = encodeBase64Url(buildReplyMime({ to, subject, inReplyTo: original.messageIdHeader, body: newBody }));

  const res = await gmailFetch(`/drafts/${encodeURIComponent(draftId)}`, {
    method: "PUT",
    body: JSON.stringify({ message: { raw, threadId: original.threadId } }),
  });
  await assertOk(res, "update draft");
}

/** The one and only gmail.send call this skill ever makes - fired exclusively from routes/gmailSkills.ts's /send endpoint, on explicit user confirmation. */
export async function sendDraft(draftId: string): Promise<void> {
  const res = await gmailFetch(`/drafts/send`, { method: "POST", body: JSON.stringify({ id: draftId }) });
  await assertOk(res, "send draft");
}

/** Best-effort cleanup when a draft is rejected instead of sent. */
export async function deleteDraft(draftId: string): Promise<void> {
  const res = await gmailFetch(`/drafts/${encodeURIComponent(draftId)}`, { method: "DELETE" });
  await assertOk(res, "delete draft");
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

export function replySubject(subject: string | null | undefined): string {
  const s = (subject ?? "").trim();
  if (!s) return "Re:";
  return /^re:/i.test(s) ? s : `Re: ${s}`;
}

/** The frontend displays/edits payload as "Subject: X\n\n<body>" (matching ConfirmGate's existing convention) - strips that back off before it's written into a real MIME body. */
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

export function threadToPlainText(messages: Pick<GmailMessage, "from" | "body">[]): string {
  return messages.map((m) => `From: ${m.from}\n\n${m.body}`).join("\n\n---\n\n");
}
