/**
 * Meeting prep (Build 10): makes each brief once, about an hour before the
 * meeting; tops it up with new emails and puts it in the suggestion slot
 * before the meeting (15 minutes by default); adds the day's briefs to the
 * morning digest; and answers "prep me for the 3pm" in chat.
 */
import { eq, gte, lt, and } from "drizzle-orm";
import { db, meetingBriefsTable, settingsTable, tasksTable, type MeetingBrief } from "@workspace/db";
import { listCalendarEvents, calendarConnected, otherPeople, type CalendarEvent } from "./calendarSource.js";
import { needsBrief, relatedEmails, relatedTasks, lastMeetingWith, composeBrief, topUp, summaryPrompt, findMeeting, type PrepEmail } from "./meetingPrep.js";
import { askAI } from "./askAI.js";
import { addSuggestion } from "./suggestions.js";
import { isConnected } from "./oauthTokens.js";
import * as outlook from "./outlookGraph.js";
import * as gmail from "./gmailApi.js";
import { logger } from "./logger.js";

export interface PrepSettings { enabled: boolean; leadMinutes: number }
const KEY = "meeting_prep";

export async function getPrepSettings(): Promise<PrepSettings> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, KEY)).limit(1).catch(() => [] as never[]);
  try {
    const s = row ? JSON.parse(row.value) as Partial<PrepSettings> : {};
    return { enabled: s.enabled !== false, leadMinutes: Math.min(60, Math.max(5, Number(s.leadMinutes) || 15)) };
  } catch {
    return { enabled: true, leadMinutes: 15 };
  }
}

export async function setPrepSettings(p: Partial<PrepSettings>): Promise<PrepSettings> {
  const next = { ...(await getPrepSettings()), ...p };
  next.leadMinutes = Math.min(60, Math.max(5, Number(next.leadMinutes) || 15));
  const value = JSON.stringify(next);
  await db.insert(settingsTable).values({ key: KEY, value }).onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
  return next;
}

/** Recent inbox mail (sender, subject, preview) from whichever mailbox is connected. */
async function recentEmails(): Promise<PrepEmail[]> {
  if (await isConnected("microsoft").catch(() => false)) {
    const list = await outlook.listRecentInboxMessages(50);
    return list.map(m => ({ id: m.id, from: m.from?.emailAddress?.address ?? "", subject: m.subject ?? "", preview: outlook.stripHtml(m.bodyPreview ?? ""), receivedAt: m.receivedDateTime }));
  }
  if (await isConnected("google").catch(() => false)) {
    const list = await gmail.listRecentInboxMessages(30);
    return list.map(m => ({ id: m.id, from: m.from, subject: m.subject, preview: m.preview, receivedAt: new Date(Number(m.internalDate)).toISOString() }));
  }
  return [];
}

async function openTasks() {
  return db.select({ id: tasksTable.id, title: tasksTable.title, status: tasksTable.status, calendarEventId: tasksTable.calendarEventId, dueDate: tasksTable.dueDate }).from(tasksTable);
}

async function existingBrief(eventId: string): Promise<MeetingBrief | undefined> {
  const [b] = await db.select().from(meetingBriefsTable).where(eq(meetingBriefsTable.eventId, eventId)).limit(1);
  return b;
}

/** Makes (once) the brief for a meeting. */
export async function makeBrief(e: CalendarEvent): Promise<MeetingBrief> {
  const have = await existingBrief(e.id);
  if (have) return have;
  const people = otherPeople(e);
  const [emails, tasks, past] = await Promise.all([
    recentEmails().catch(() => [] as PrepEmail[]),
    openTasks().catch(() => []),
    db.select().from(meetingBriefsTable).catch(() => []),
  ]);
  const mine = relatedEmails(emails, people);
  const myTasks = relatedTasks(tasks, e, people);
  const last = lastMeetingWith(past.map(b => ({ title: b.title, startsAt: b.startsAt.toISOString(), attendees: b.attendees })), people, e.start);
  let summary: string | undefined;
  try { summary = (await askAI({ prompt: summaryPrompt(e, people, mine, myTasks) })).text; } catch (err) { logger.warn({ err }, "Meeting brief summary skipped"); }
  const brief = composeBrief({ event: e, people, emails: mine, tasks: myTasks, last, summary });
  const [row] = await db.insert(meetingBriefsTable).values({
    eventId: e.id, title: e.title, startsAt: new Date(e.start), attendees: people.map(p => ({ name: p.name, email: p.email })), brief, emailIds: mine.map(m => m.id),
  }).onConflictDoNothing().returning();
  return row ?? (await existingBrief(e.id))!;
}

/** Adds emails that arrived since the brief was made. */
async function refresh(b: MeetingBrief): Promise<MeetingBrief> {
  const emails = relatedEmails(await recentEmails().catch(() => []), b.attendees.map(a => ({ ...a })));
  const fresh = emails.filter(m => !b.emailIds.includes(m.id) && Date.parse(m.receivedAt) > b.createdAt.getTime());
  if (!fresh.length) return b;
  const [row] = await db.update(meetingBriefsTable).set({ brief: topUp(b.brief, fresh), emailIds: [...b.emailIds, ...fresh.map(m => m.id)], refreshedAt: new Date() }).where(eq(meetingBriefsTable.id, b.id)).returning();
  return row;
}

/** Every 5 minutes: make briefs for meetings in the next hour; suggest them just before. */
export async function prepTick(now = new Date()): Promise<void> {
  const settings = await getPrepSettings();
  if (!settings.enabled || !(await calendarConnected())) return;
  const events = (await listCalendarEvents(now, new Date(now.getTime() + 75 * 60_000))).filter(e => needsBrief(e));
  for (const e of events) {
    const b = await makeBrief(e);
    const minutes = (Date.parse(e.start) - now.getTime()) / 60_000;
    if (!b.suggestedAt && minutes <= settings.leadMinutes && minutes > -5) {
      const fresh = await refresh(b);
      await addSuggestion({
        kind: "meeting_brief", title: `${e.title} in ${Math.max(0, Math.round(minutes))} min`, body: fresh.brief,
        why: `A brief for your meeting with ${fresh.attendees.slice(0, 3).map(a => a.name).join(", ")}${fresh.attendees.length > 3 ? " and others" : ""}.`,
        ref: { eventId: e.id }, expiresAt: new Date(e.end),
      });
      await db.update(meetingBriefsTable).set({ suggestedAt: new Date() }).where(eq(meetingBriefsTable.id, b.id));
    }
  }
}

let timer: NodeJS.Timeout | null = null;
export function startMeetingPrep(): void {
  if (timer) return;
  const run = () => prepTick().catch(err => logger.warn({ err }, "Meeting prep check failed"));
  timer = setInterval(run, 5 * 60_000);
  setTimeout(run, 30_000);
}

/** Morning digest: the day's briefs, made now. */
export async function todaysBriefs(now = new Date()): Promise<MeetingBrief[]> {
  if (!(await calendarConnected())) return [];
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const events = (await listCalendarEvents(now, end)).filter(e => needsBrief(e));
  const out: MeetingBrief[] = [];
  for (const e of events) out.push(await makeBrief(e).catch(() => null as never));
  return out.filter(Boolean);
}

/** "Prep me for the 3pm" - the chat's tool. */
export async function briefForRequest(query: string, now = new Date()): Promise<string> {
  if (!(await calendarConnected())) return "No calendar is connected - connect Outlook or Google in Integrations.";
  const events = await listCalendarEvents(new Date(now.getTime() - 30 * 60_000), new Date(now.getTime() + 7 * 24 * 3600_000));
  const e = findMeeting(events, query, now);
  if (!e) return `I couldn't tell which meeting "${query}" is. Ask with its time (e.g. "the 3pm") or its name.`;
  if (!otherPeople(e).length) return `"${e.title}" has no one else in it, so there's nothing to prepare.`;
  return (await refresh(await makeBrief(e))).brief;
}

/** Old briefs aren't needed after a month (kept that long for "last met"). */
export async function pruneBriefs(now = new Date()): Promise<void> {
  await db.delete(meetingBriefsTable).where(and(lt(meetingBriefsTable.startsAt, new Date(now.getTime() - 31 * 24 * 3600_000)), gte(meetingBriefsTable.id, 0)));
}
