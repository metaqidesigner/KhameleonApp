/**
 * Meeting prep (docs/build-review.md, Build 10) - the pure parts. A brief is
 * mostly gathered by plain code (who's coming, recent emails from them,
 * related open tasks, when you last met); Khami adds only a short "what
 * it's about and points to raise". One brief per meeting, topped up with
 * new emails rather than rewritten. Service: lib/meetingPrepService.ts.
 */
import type { CalendarEvent, CalendarAttendee } from "./calendarSource.js";
import { otherPeople } from "./calendarSource.js";
import { similarity } from "./procedures.js";

export interface PrepEmail { id: string; from: string; subject: string; preview: string; receivedAt: string }
export interface PrepTask { id: number; title: string; status: string; calendarEventId: string | null; dueDate: string | null }
export interface PastMeeting { title: string; startsAt: string; attendees: { email: string }[] }

const NOT_A_MEETING = /\b(focus|focus time|block(ed)?|hold|lunch|commute|travel|ooo|out of office|holiday|annual leave|gym|school run|private|busy)\b/i;

/** Meetings with other people that the user is going to: skips solo blocks, focus time, declined, all-day and free. Pure. */
export function needsBrief(e: CalendarEvent, selfEmails: string[] = []): boolean {
  if (e.declined || e.allDay || e.free) return false;
  if (NOT_A_MEETING.test(e.title)) return false;
  return otherPeople(e, selfEmails).length > 0;
}

const addressOf = (from: string) => (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();

/** The latest emails from the people in the meeting (up to 5). Pure. */
export function relatedEmails(emails: PrepEmail[], people: CalendarAttendee[]): PrepEmail[] {
  const addrs = new Set(people.map(p => p.email));
  return emails.filter(m => addrs.has(addressOf(m.from)))
    .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt)).slice(0, 5);
}

/** Open tasks linked to the meeting, about the same thing, or naming someone in it (up to 5). Pure. */
export function relatedTasks(tasks: PrepTask[], e: CalendarEvent, people: CalendarAttendee[]): PrepTask[] {
  const firstNames = people.map(p => p.name.split(/[\s@.]/)[0]).filter(n => n.length >= 3).map(n => n.toLowerCase());
  return tasks.filter(t => t.status !== "done").filter(t =>
    t.calendarEventId === e.id
    || similarity(t.title, e.title) >= 0.35
    || firstNames.some(n => new RegExp(`\\b${n.replace(/[^a-z]/g, "")}\\b`, "i").test(t.title)),
  ).slice(0, 5);
}

/** The most recent earlier meeting sharing at least one person. Pure. */
export function lastMeetingWith(past: PastMeeting[], people: CalendarAttendee[], before: string): PastMeeting | null {
  const addrs = new Set(people.map(p => p.email));
  return past
    .filter(m => Date.parse(m.startsAt) < Date.parse(before) && m.attendees.some(a => addrs.has(a.email)))
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))[0] ?? null;
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const dmy = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

/** The brief, as shown in the chat. Pure. */
export function composeBrief(p: { event: CalendarEvent; people: CalendarAttendee[]; emails: PrepEmail[]; tasks: PrepTask[]; last: PastMeeting | null; summary?: string }): string {
  const { event, people, emails, tasks, last, summary } = p;
  return [
    `${event.title} - ${dmy(event.start)}, ${hhmm(event.start)}-${hhmm(event.end)}${event.location ? `, ${event.location}` : ""}`,
    `With: ${people.map(x => x.name).join(", ")}`,
    summary ? `\n${summary.trim()}` : "",
    emails.length ? `\nRecent emails from them:\n${emails.map(m => `- ${dmy(m.receivedAt)}: ${m.subject}${m.preview ? ` - ${m.preview.slice(0, 120)}` : ""}`).join("\n")}` : "\nNo recent emails from them.",
    tasks.length ? `\nOpen tasks that relate:\n${tasks.map(t => `- ${t.title}${t.dueDate ? ` (due ${t.dueDate})` : ""}`).join("\n")}` : "",
    last ? `\nLast met: ${dmy(last.startsAt)} - ${last.title}` : "",
  ].filter(Boolean).join("\n");
}

/** Adds emails that arrived after the brief was written - no rewrite. Pure. */
export function topUp(brief: string, newEmails: PrepEmail[]): string {
  if (!newEmails.length) return brief;
  return `${brief}\n\nNew since this brief was written:\n${newEmails.map(m => `- ${m.subject} (from ${m.from.replace(/\s*<[^>]+>/, "")})`).join("\n")}`;
}

/** The question for Khami - only the summary paragraph. Pure. */
export function summaryPrompt(event: CalendarEvent, people: CalendarAttendee[], emails: PrepEmail[], tasks: PrepTask[]): string {
  return [
    "In two or three short sentences, say what this meeting is probably about, then list up to three points the user may want to raise. Only use what's below - don't invent anything. No greeting, no sign-off.",
    `Meeting: ${event.title}`,
    event.description ? `Invite text: ${event.description.slice(0, 600)}` : "",
    `With: ${people.map(p => p.name).join(", ")}`,
    emails.length ? `Recent emails from them:\n${emails.map(m => `- ${m.subject}: ${m.preview.slice(0, 200)}`).join("\n")}` : "",
    tasks.length ? `Related open tasks:\n${tasks.map(t => `- ${t.title}`).join("\n")}` : "",
  ].filter(Boolean).join("\n");
}

/** "the 3pm", "15:30", "my call with Jane", "the Q3 review" → the meeting meant. Pure. */
export function findMeeting(events: CalendarEvent[], query: string, now = new Date()): CalendarEvent | null {
  const q = query.toLowerCase();
  const t = q.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/);
  if (t && (t[2] || t[3])) {
    const n = Number(t[1]);
    let h = n;
    if (t[3] === "pm" && n < 12) h = n + 12;
    else if (t[3] === "am" && n === 12) h = 0;
    else if (!t[3] && n >= 1 && n <= 7) h = n + 12; // "the 3:30" means the afternoon
    const m = Number(t[2] ?? 0);
    const hit = events.filter(e => !e.allDay && Date.parse(e.end) > now.getTime())
      .find(e => { const d = new Date(e.start); return d.getHours() === h && d.getMinutes() === m; });
    if (hit) return hit;
  }
  let best: { e: CalendarEvent; s: number } | null = null;
  for (const e of events) {
    if (Date.parse(e.end) < now.getTime()) continue;
    const s = Math.max(similarity(q, e.title), ...e.attendees.map(a => (q.includes(a.name.split(" ")[0].toLowerCase()) && a.name.length > 2 ? 0.5 : 0)));
    if (!best || s > best.s) best = { e, s };
  }
  if (best && best.s >= 0.3) return best.e;
  return /\b(next|my next)\b/.test(q) ? events.find(e => !e.allDay && Date.parse(e.start) > now.getTime()) ?? null : null;
}
