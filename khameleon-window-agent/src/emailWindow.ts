/**
 * Knowing which email is open (docs/build-review.md, Build 9 - brought into
 * the Capture build for the email assistant). Works from the window's app
 * and title alone: mail apps and webmail put the subject of an opened email
 * in the title, and folder/list views in a recognisable form. When the
 * title can't say (e.g. an email shown in the reading pane), `subject` is
 * null and the desktop app may ask the mail app which message is selected.
 */
export type MailClient = "outlook" | "mail" | "gmail-web" | "outlook-web";

export interface EmailWindowInfo {
  client: MailClient;
  /** The opened email's subject, or null for an inbox/list/compose view. */
  subject: string | null;
}

const BROWSER = /chrome|safari|edge|firefox|arc|brave|opera|vivaldi|chromium/i;
const FOLDERS = /^(inbox|all inboxes|mail|sent( items| mail)?|drafts?|starred|spam|junk( email)?|bin|trash|deleted items|all mail|snoozed|important|archive|outbox|search results?|scheduled|flagged|focused|other|calendar|people|contacts|tasks|to do|untitled)(\s*\(\d+\))?$/i;
const COUNT = /^\D*\b\d+ (messages?|unread|drafts?|items?)$/i;

function folderOrList(part: string): boolean {
  const p = part.trim();
  return !p || FOLDERS.test(p) || COUNT.test(p);
}

/** Which mail client (if any) is this window, and which email is open in it? */
export function emailFromWindow(app: string, title: string): EmailWindowInfo | null {
  const a = (app || "").trim();
  const t = (title || "").trim();

  if (BROWSER.test(a)) {
    // Browsers add their own name (and sometimes a profile) after the page
    // title; drop trailing parts until the webmail's name is last.
    const parts = t.split(/\s+[-—–]\s+/);
    while (parts.length && !/^(gmail|outlook)$/i.test(parts[parts.length - 1].trim())) parts.pop();
    if (!parts.length) return null;
    const service = parts.pop()!.trim().toLowerCase();
    // Gmail: "Subject - you@gmail.com - Gmail"; Outlook: "Subject - Jane Smith - Outlook" or "Subject - Outlook".
    if (parts.length >= 2) parts.pop(); // the account
    const subject = parts.join(" - ").trim();
    if (service === "outlook" && /^calendar\b/i.test(subject)) return null;
    return { client: service === "gmail" ? "gmail-web" : "outlook-web", subject: folderOrList(subject) ? null : subject };
  }

  if (/^(microsoft outlook|outlook|olk)$/i.test(a)) {
    // Windows: a message in its own window is "Subject - Message (HTML)".
    const msg = t.match(/^(.*)\s+[-—–]\s+Message(?: \([^)]*\))?$/i);
    if (msg) return { client: "outlook", subject: folderOrList(msg[1]) ? null : msg[1] };
    // Main window: "Inbox - you@x.com - Outlook" (Windows) or "Inbox • you@x.com" (Mac).
    if (/[-—–]\s+Outlook$/i.test(t) || /\s•\s/.test(t) || folderOrList(t)) return { client: "outlook", subject: null };
    if (/^(calendar|reminders?)\b/i.test(t)) return null;
    return { client: "outlook", subject: t }; // Mac: a message in its own window is titled with its subject
  }

  if (/^mail$/i.test(a)) {
    // Apple Mail: "Inbox – 12 messages", "All Inboxes – 3 unread"; an opened message's window is its subject.
    const first = t.split(/\s+[-—–]\s+/)[0] ?? "";
    if (folderOrList(first) || COUNT.test(t) || /^new message$/i.test(t)) return { client: "mail", subject: null };
    return { client: "mail", subject: t };
  }

  return null;
}

/** Was this email new to the user? Opening an email often marks it read at once, so a recent arrival counts too. */
export function isNewEmail(unread: boolean, receivedAt: string | number | undefined, now = Date.now()): boolean {
  if (unread) return true;
  const t = typeof receivedAt === "number" ? receivedAt : receivedAt ? Date.parse(receivedAt) : NaN;
  return Number.isFinite(t) && now - t >= 0 && now - t < 60 * 60 * 1000;
}
