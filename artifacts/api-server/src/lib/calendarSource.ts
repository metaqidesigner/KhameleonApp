/**
 * The user's calendar, read-only (docs/build-review.md, Build 10): Google
 * Calendar or Outlook through the existing connections. Richer than
 * routes/calendar.ts's list - attendees with addresses, the user's own
 * response, all-day and free/busy - because meeting prep needs them.
 * Parsing and wording are pure so they can be tested without an account.
 */
import { getFreshToken, isConnected } from "./oauthTokens.js";

export interface CalendarAttendee { name: string; email: string; declined?: boolean; self?: boolean }
export interface CalendarEvent {
  id: string;
  source: "google" | "outlook";
  title: string;
  description: string;
  start: string; // ISO
  end: string;   // ISO
  allDay: boolean;
  location: string;
  attendees: CalendarAttendee[];
  /** The user said no to it. */
  declined: boolean;
  /** Shown as free / out of office rather than busy. */
  free: boolean;
}

type GoogleEvent = {
  id: string; summary?: string; description?: string; location?: string; transparency?: string; status?: string;
  start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string };
  attendees?: { email: string; displayName?: string; self?: boolean; responseStatus?: string }[];
};

export function parseGoogleEvents(items: GoogleEvent[]): CalendarEvent[] {
  return items.filter(e => e.status !== "cancelled").map(e => {
    const attendees = (e.attendees ?? []).map(a => ({ name: a.displayName ?? a.email, email: a.email.toLowerCase(), declined: a.responseStatus === "declined", self: !!a.self }));
    return {
      id: e.id, source: "google" as const, title: e.summary ?? "(untitled)", description: e.description ?? "",
      start: e.start.dateTime ?? `${e.start.date}T00:00:00`, end: e.end.dateTime ?? `${e.end.date}T00:00:00`,
      allDay: !e.start.dateTime, location: e.location ?? "", attendees,
      declined: attendees.some(a => a.self && a.declined), free: e.transparency === "transparent",
    };
  });
}

type OutlookEvent = {
  id: string; subject?: string; bodyPreview?: string; isAllDay?: boolean; isCancelled?: boolean; showAs?: string;
  start: { dateTime: string }; end: { dateTime: string };
  location?: { displayName?: string };
  responseStatus?: { response?: string };
  attendees?: { emailAddress: { address: string; name?: string }; status?: { response?: string } }[];
};

/** Outlook times are requested in UTC (Prefer header) but come back without a "Z". */
const utc = (t: string) => (/[zZ]|[+-]\d\d:\d\d$/.test(t) ? t : `${t.replace(/\.\d+$/, "")}Z`);

export function parseOutlookEvents(items: OutlookEvent[]): CalendarEvent[] {
  return items.filter(e => !e.isCancelled).map(e => ({
    id: e.id, source: "outlook" as const, title: e.subject ?? "(untitled)", description: e.bodyPreview ?? "",
    start: utc(e.start.dateTime), end: utc(e.end.dateTime), allDay: !!e.isAllDay, location: e.location?.displayName ?? "",
    attendees: (e.attendees ?? []).map(a => ({ name: a.emailAddress.name ?? a.emailAddress.address, email: a.emailAddress.address.toLowerCase(), declined: a.status?.response === "declined" })),
    declined: e.responseStatus?.response === "declined",
    free: e.showAs === "free" || e.showAs === "oof",
  }));
}

export class CalendarNotConnectedError extends Error {
  status = 409;
  constructor() { super("No calendar is connected - connect Outlook or Google in Integrations."); }
}

export async function calendarConnected(): Promise<"google" | "outlook" | null> {
  if (await isConnected("google").catch(() => false)) return "google";
  if (await isConnected("microsoft").catch(() => false)) return "outlook";
  return null;
}

/** Events between two times from the connected calendar. */
export async function listCalendarEvents(from: Date, to: Date): Promise<CalendarEvent[]> {
  const which = await calendarConnected();
  if (!which) throw new CalendarNotConnectedError();
  if (which === "google") {
    const token = await getFreshToken("google");
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(from.toISOString())}&timeMax=${encodeURIComponent(to.toISOString())}&singleEvents=true&orderBy=startTime&maxResults=100`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Google Calendar didn't answer (HTTP ${res.status})`);
    return parseGoogleEvents(((await res.json()) as { items?: GoogleEvent[] }).items ?? []);
  }
  const token = await getFreshToken("microsoft");
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(from.toISOString())}&endDateTime=${encodeURIComponent(to.toISOString())}&$top=100&$orderby=start/dateTime&$select=id,subject,bodyPreview,start,end,location,attendees,isAllDay,isCancelled,showAs,responseStatus`, {
    headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' },
  });
  if (!res.ok) throw new Error(`Outlook Calendar didn't answer (HTTP ${res.status})`);
  return parseOutlookEvents(((await res.json()) as { value?: OutlookEvent[] }).value ?? []);
}

/** "today" / "tomorrow" / "this week" / "next week" / a date → a time range (local time). Pure. */
export function rangeFor(when: string | undefined, now = new Date()): { from: Date; to: Date; label: string } {
  const day = (d: Date, add = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + add);
  const w = (when ?? "today").trim().toLowerCase();
  if (w === "tomorrow") return { from: day(now, 1), to: day(now, 2), label: "tomorrow" };
  if (w === "this week" || w === "this_week" || w === "week") {
    const dow = (now.getDay() + 6) % 7; // Monday = 0
    return { from: now, to: day(now, 7 - dow), label: "the rest of this week" };
  }
  if (w === "next week" || w === "next_week") {
    const dow = (now.getDay() + 6) % 7;
    return { from: day(now, 7 - dow), to: day(now, 14 - dow), label: "next week" };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(w)) {
    const [y, m, d] = w.split("-").map(Number);
    const from = new Date(y, m - 1, d);
    return { from, to: day(from, 1), label: from.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) };
  }
  if (w === "this afternoon") return { from: new Date(Math.max(now.getTime(), new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).getTime())), to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18), label: "this afternoon" };
  return { from: now, to: day(now, 1), label: "the rest of today" };
}

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const dayName = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

/** Other people in the meeting (not the user, not people who declined). Pure. */
export function otherPeople(e: CalendarEvent, selfEmails: string[] = []): CalendarAttendee[] {
  const self = new Set(selfEmails.map(s => s.toLowerCase()));
  return e.attendees.filter(a => !a.self && !self.has(a.email) && !a.declined && !/^(room|resource)/i.test(a.email));
}

/** Plain-text list for the chat's AI. Pure. */
export function describeEvents(events: CalendarEvent[], label: string, selfEmails: string[] = []): string {
  const shown = events.filter(e => !e.declined);
  if (!shown.length) return `Nothing in the calendar for ${label}.`;
  const multiDay = new Set(shown.map(e => dayName(e.start))).size > 1;
  return [`Calendar for ${label}:`, ...shown.map(e => {
    const when = e.allDay ? "All day" : `${time(e.start)}-${time(e.end)}`;
    const people = otherPeople(e, selfEmails);
    return `- ${multiDay ? `${dayName(e.start)} ` : ""}${when}: ${e.title}${e.location ? ` (${e.location})` : ""}${people.length ? ` - with ${people.slice(0, 6).map(p => p.name).join(", ")}${people.length > 6 ? ` and ${people.length - 6} more` : ""}` : ""}${e.free ? " [shown as free]" : ""}`;
  })].join("\n");
}
