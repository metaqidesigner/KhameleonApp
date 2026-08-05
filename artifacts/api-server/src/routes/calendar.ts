import { Router } from "express";
import { db } from "@workspace/db";
import { calendarEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getFreshToken, isConnected } from "../lib/oauthTokens.js";

const router = Router();

// ── Normalised event shape ────────────────────────────────────────────────────
interface CalEvent {
  id: string | number;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  type: string;
  attendees: string[];
  location: string;
  aiPrep: string;
  relatedProject: string;
  actionItems: string[];
  createdAt: string;
}

// ── Google Calendar fetch ─────────────────────────────────────────────────────
async function fetchGoogleCalendar(): Promise<CalEvent[]> {
  const token = await getFreshToken("google");

  const now    = new Date();
  const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const timeMin = now.toISOString();
  const timeMax = twoWeeksOut.toISOString();

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
    `?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}` +
    `&singleEvents=true&orderBy=startTime&maxResults=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Google Calendar fetch failed: ${res.status}`);

  const json = await res.json() as {
    items: {
      id: string;
      summary?: string;
      description?: string;
      start: { dateTime?: string; date?: string };
      end: { dateTime?: string; date?: string };
      location?: string;
      attendees?: { email: string; displayName?: string }[];
      created?: string;
    }[];
  };

  return json.items.map(ev => ({
    id: ev.id,
    title: ev.summary ?? "(untitled)",
    description: ev.description ?? "",
    startTime: ev.start.dateTime ?? ev.start.date ?? "",
    endTime:   ev.end.dateTime   ?? ev.end.date   ?? "",
    type: "meeting",
    attendees: ev.attendees?.map(a => a.displayName ?? a.email) ?? [],
    location: ev.location ?? "",
    aiPrep: "",
    relatedProject: "",
    actionItems: [],
    createdAt: ev.created ?? new Date().toISOString(),
  }));
}

// ── Microsoft Graph calendar fetch ────────────────────────────────────────────
async function fetchOutlookCalendar(): Promise<CalEvent[]> {
  const token = await getFreshToken("microsoft");

  const now    = new Date();
  const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const startDateTime = now.toISOString();
  const endDateTime   = twoWeeksOut.toISOString();

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendarView` +
    `?startDateTime=${encodeURIComponent(startDateTime)}&endDateTime=${encodeURIComponent(endDateTime)}` +
    `&$top=50&$orderby=start/dateTime` +
    `&$select=id,subject,bodyPreview,start,end,location,attendees,createdDateTime`,
    { headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' } }
  );
  if (!res.ok) throw new Error(`Outlook Calendar fetch failed: ${res.status}`);

  const json = await res.json() as {
    value: {
      id: string;
      subject?: string;
      bodyPreview?: string;
      start: { dateTime: string; timeZone: string };
      end:   { dateTime: string; timeZone: string };
      location?: { displayName?: string };
      attendees?: { emailAddress: { address: string; name?: string } }[];
      createdDateTime?: string;
    }[];
  };

  return json.value.map(ev => ({
    id: ev.id,
    title: ev.subject ?? "(untitled)",
    description: ev.bodyPreview ?? "",
    startTime: ev.start.dateTime,
    endTime:   ev.end.dateTime,
    type: "meeting",
    attendees: ev.attendees?.map(a => a.emailAddress.name ?? a.emailAddress.address) ?? [],
    location: ev.location?.displayName ?? "",
    aiPrep: "",
    relatedProject: "",
    actionItems: [],
    createdAt: ev.createdDateTime ?? new Date().toISOString(),
  }));
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/events", async (req, res) => {
  try {
    const [googleOk, msOk] = await Promise.all([
      isConnected("google"),
      isConnected("microsoft"),
    ]);

    if (googleOk) {
      const events = await fetchGoogleCalendar();
      res.json(events);
      return;
    }
    if (msOk) {
      const events = await fetchOutlookCalendar();
      res.json(events);
      return;
    }

    // No connector — serve from local DB
    const events = await db.select().from(calendarEventsTable).orderBy(calendarEventsTable.startTime);
    res.json(events);
  } catch (err) {
    req.log.error({ err }, "Error fetching calendar events");
    try {
      const events = await db.select().from(calendarEventsTable).orderBy(calendarEventsTable.startTime);
      res.json(events);
    } catch {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

router.get("/events/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [event] = await db.select().from(calendarEventsTable).where(eq(calendarEventsTable.id, id));
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  } catch (err) {
    req.log.error({ err }, "Error fetching calendar event");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
