/**
 * Email assistant (docs/build-review.md, Build 4 answers + Build 9's
 * open-email detection): when the user has an email open, Khami offers a
 * short summary, a suggested reply and up to three actions. Pure helpers -
 * the route (routes/emailAssist.ts) does the fetching and asking.
 *
 * Khameleon never sends anything: "Use this reply" only ever makes a draft.
 */

export interface AssistEmail {
  subject: string;
  /** "Jane Smith <jane@acme.com>" or just the address. */
  from: string;
  body: string;
}

export type AssistActionKind = "task" | "calendar" | "other";
export interface AssistAction { kind: AssistActionKind; label: string }
export interface AssistResult { summary: string; reply: string; actions: AssistAction[] }

const MAX_BODY = 4000;

/** "RE: Fwd:  Q3 figures " -> "q3 figures". */
export function normaliseSubject(subject: string): string {
  let s = (subject || "").trim();
  for (;;) {
    const next = s.replace(/^\s*(re|fw|fwd|aw|wg|tr|sv|antw)\s*(\[\d+\])?\s*:\s*/i, "");
    if (next === s) break;
    s = next;
  }
  return s.replace(/[…]+$|\.\.\.$/, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Does the subject shown in a window title belong to this message? Titles
 * are sometimes cut short, so a long enough start counts as a match.
 */
export function subjectMatches(fromWindow: string, messageSubject: string): boolean {
  const a = normaliseSubject(fromWindow);
  const b = normaliseSubject(messageSubject);
  if (!a || !b) return false;
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 12 && longer.startsWith(shorter);
}

export function splitSender(from: string): { name: string; address: string } {
  const m = (from || "").match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), address: m[2].trim().toLowerCase() };
  return { name: "", address: (from || "").trim().toLowerCase() };
}

const AUTOMATED_LOCAL = /^(no-?reply|do-?not-?reply|donotreply|notifications?|notify|alerts?|news(letter)?s?|marketing|mailer-daemon|postmaster|bounces?|updates?|info|support|hello|team|billing|invoices?|receipts?|digest|automated|system|admin|accounts?|security|service|feedback|offers?|promo(tions)?|events?)([+._-].*)?$/i;
const AUTOMATED_DOMAIN = /(^|\.)(e?mail|news|newsletter|marketing|notifications?|mailer|bounce|em|e)\.[^.]+\.[a-z.]+$|(mailchimp|sendgrid|mailgun|amazonses|hubspot|mcsv|mktomail|exacttarget|sparkpost)\./i;
const AUTOMATED_GMAIL_LABELS = ["CATEGORY_PROMOTIONS", "CATEGORY_UPDATES", "CATEGORY_SOCIAL", "CATEGORY_FORUMS"];

/**
 * Is this email (probably) from a real person rather than a newsletter,
 * notification or system? Cards only appear on their own for real people;
 * everything else gets the "Help with this email" button instead.
 */
export function looksLikeAPerson(from: string, opts: { gmailLabels?: string[] } = {}): boolean {
  if (opts.gmailLabels?.some((l) => AUTOMATED_GMAIL_LABELS.includes(l))) return false;
  const { address } = splitSender(from);
  const at = address.lastIndexOf("@");
  if (at < 1) return false;
  const local = address.slice(0, at);
  const domain = address.slice(at + 1);
  if (AUTOMATED_LOCAL.test(local)) return false;
  if (AUTOMATED_DOMAIN.test(domain)) return false;
  return true;
}

function emailBlock(email: AssistEmail): string {
  const body = email.body.replace(/\n{3,}/g, "\n\n").trim();
  return [
    `From: ${email.from || "(unknown)"}`,
    `Subject: ${email.subject || "(no subject)"}`,
    "",
    body.length > MAX_BODY ? `${body.slice(0, MAX_BODY)}\n[...the rest of the email was cut for length]` : body,
  ].join("\n");
}

/** What Khami is asked. Fixed headings so the answer can be read back reliably. */
export function assistPrompt(email: AssistEmail): string {
  return [
    "Help me with this email. Answer in exactly this format and nothing else:",
    "",
    "SUMMARY: <one or two plain sentences: what they want and by when>",
    "REPLY:",
    "<a short, polite reply I could send, in the same language as the email, without a subject line, signed off with just 'Thanks,' or 'Kind regards,' - or the words NO REPLY NEEDED if it doesn't need one>",
    "ACTIONS:",
    "- TASK: <something I need to do, if any>",
    "- CALENDAR: <a meeting or deadline to put in my calendar, if any>",
    "",
    "List at most 3 actions, only ones the email actually calls for; leave the list empty if there are none.",
    "Never invent facts, figures or promises that aren't in the email - write [check] where I need to fill something in.",
    "Never accept a meeting, agree a date or commit me to anything - write [check] there so I decide.",
    "",
    "The email:",
    emailBlock(email),
  ].join("\n");
}

/** How the user wants the suggested reply changed. */
export function rewritePrompt(email: AssistEmail, reply: string, how: string): string {
  const instruction = how === "shorter" ? "Make it shorter - keep only what matters."
    : how === "more-formal" ? "Make it more formal and polished."
    : `Change it like this: ${how}`;
  return [
    "Here is an email and a reply I'm drafting to it.",
    instruction,
    "Answer with only the new reply text - no subject line, no explanations. Never invent facts that aren't in the email; write [check] where I need to fill something in.",
    "",
    "The email:",
    emailBlock(email),
    "",
    "My reply:",
    reply,
  ].join("\n");
}

function stripMarkup(s: string): string {
  return s.replace(/\*\*|__/g, "").replace(/^\s*[*_"'`]+|[*_"'`]+\s*$/g, "").trim();
}

/** Reads Khami's answer back into summary / reply / actions. Forgiving about formatting. */
export function parseAssist(text: string): AssistResult {
  const src = (text || "").replace(/\r\n/g, "\n");
  const heading = (name: string) => new RegExp(`^\\s*[*#_ ]*${name}[*_ ]*:[*_ ]*`, "im");
  const find = (name: string) => { const m = heading(name).exec(src); return m ? { start: m.index, end: m.index + m[0].length } : null; };
  const sum = find("SUMMARY");
  const rep = find("REPLY");
  const act = find("ACTIONS");
  const section = (from: { end: number } | null, ...nexts: ({ start: number } | null)[]) => {
    if (!from) return "";
    const stops = nexts.filter((n): n is { start: number } => !!n && n.start > from.end).map((n) => n.start);
    return src.slice(from.end, stops.length ? Math.min(...stops) : undefined).trim();
  };

  let summary = stripMarkup(section(sum, rep, act).split("\n").filter(Boolean).join(" "));
  let reply = section(rep, act, sum).replace(/^```\w*\n?|```$/g, "").trim();
  if (/^no reply needed\.?$/i.test(stripMarkup(reply))) reply = "";
  if (!sum && !rep) { summary = ""; reply = src.trim(); }

  const actions: AssistAction[] = [];
  for (const raw of section(act, sum, rep).split("\n")) {
    const line = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();
    if (!line || /^(none|n\/a|-)\.?$/i.test(line)) continue;
    const m = line.match(/^\**\s*(TASK|CALENDAR|NOTE|OTHER)\s*\**\s*:\s*(.*)$/i);
    const label = stripMarkup(m ? m[2] : line);
    if (!label || /^(none|n\/a|nothing)\b/i.test(label) || /^<.*>$/.test(label)) continue;
    const kind: AssistActionKind = m?.[1].toUpperCase() === "TASK" ? "task" : m?.[1].toUpperCase() === "CALENDAR" ? "calendar" : "other";
    actions.push({ kind, label: label.replace(/\.$/, "") });
    if (actions.length === 3) break;
  }
  return { summary, reply, actions };
}
