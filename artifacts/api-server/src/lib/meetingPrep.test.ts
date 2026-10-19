import { test } from "node:test";
import assert from "node:assert/strict";
import { needsBrief, relatedEmails, relatedTasks, lastMeetingWith, composeBrief, topUp, findMeeting } from "./meetingPrep.js";
import type { CalendarEvent } from "./calendarSource.js";
import { ownToolsFor } from "../agents/tools/anyAiTools.js";

const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: "e1", source: "google", title: "Q3 review", description: "", start: "2026-10-19T15:00:00", end: "2026-10-19T16:00:00",
  allDay: false, location: "", attendees: [{ name: "Jane Smith", email: "jane@acme.com" }], declined: false, free: false, ...over,
});

test("briefs only for real meetings with other people", () => {
  assert.equal(needsBrief(ev({})), true);
  assert.equal(needsBrief(ev({ attendees: [] })), false, "solo block");
  assert.equal(needsBrief(ev({ title: "Focus time" })), false);
  assert.equal(needsBrief(ev({ declined: true })), false);
  assert.equal(needsBrief(ev({ allDay: true })), false);
  assert.equal(needsBrief(ev({ attendees: [{ name: "Me", email: "me@acme.com", self: true }] })), false);
});

test("gathers recent emails from the people, related tasks, and the last meeting", () => {
  const people = [{ name: "Jane Smith", email: "jane@acme.com" }];
  const emails = relatedEmails([
    { id: "1", from: "Jane Smith <jane@acme.com>", subject: "Q3 numbers", preview: "Attached", receivedAt: "2026-10-18T09:00:00Z" },
    { id: "2", from: "news@shop.com", subject: "Sale", preview: "", receivedAt: "2026-10-18T10:00:00Z" },
    { id: "3", from: "jane@acme.com", subject: "Agenda", preview: "", receivedAt: "2026-10-19T08:00:00Z" },
  ], people);
  assert.deepEqual(emails.map(e => e.id), ["3", "1"]);
  const tasks = relatedTasks([
    { id: 1, title: "Finish the Q3 review slides", status: "todo", calendarEventId: null, dueDate: null },
    { id: 2, title: "Send Jane the forecast", status: "in_progress", calendarEventId: null, dueDate: "2026-10-20" },
    { id: 3, title: "Book dentist", status: "todo", calendarEventId: null, dueDate: null },
    { id: 4, title: "Q3 review prep", status: "done", calendarEventId: null, dueDate: null },
  ], ev({}), people);
  assert.deepEqual(tasks.map(t => t.id), [1, 2]);
  const last = lastMeetingWith([{ title: "Q2 review", startsAt: "2026-07-10T15:00:00Z", attendees: [{ email: "jane@acme.com" }] }, { title: "Other", startsAt: "2026-09-01T10:00:00Z", attendees: [{ email: "bob@acme.com" }] }], people, "2026-10-19T15:00:00");
  assert.equal(last?.title, "Q2 review");
  const brief = composeBrief({ event: ev({}), people, emails, tasks, last, summary: "Reviewing Q3 results." });
  assert.match(brief, /With: Jane Smith/);
  assert.match(brief, /Reviewing Q3 results\./);
  assert.match(brief, /Agenda/);
  assert.match(brief, /Send Jane the forecast \(due 2026-10-20\)/);
  assert.match(brief, /Last met: .* Q2 review/);
  assert.match(topUp(brief, [{ id: "9", from: "Jane <jane@acme.com>", subject: "Updated figures", preview: "", receivedAt: "" }]), /New since this brief was written:\n- Updated figures \(from Jane\)/);
  assert.equal(topUp(brief, []), brief);
});

test("works out which meeting 'the 3pm' or 'my call with Jane' means", () => {
  const now = new Date(2026, 9, 19, 9, 0);
  const events = [
    ev({ id: "a", title: "Supplier call", start: new Date(2026, 9, 19, 11, 0).toISOString(), end: new Date(2026, 9, 19, 11, 30).toISOString(), attendees: [{ name: "Bob Jones", email: "bob@x.com" }] }),
    ev({ id: "b", title: "Q3 review", start: new Date(2026, 9, 19, 15, 0).toISOString(), end: new Date(2026, 9, 19, 16, 0).toISOString() }),
  ];
  assert.equal(findMeeting(events, "prep me for the 3pm", now)?.id, "b");
  assert.equal(findMeeting(events, "the 3:00 one", now)?.id, "b");
  assert.equal(findMeeting(events, "my call with Bob", now)?.id, "a");
  assert.equal(findMeeting(events, "the Q3 review", now)?.id, "b");
  assert.equal(findMeeting(events, "my next meeting", now)?.id, "a");
  assert.equal(findMeeting(events, "the board dinner", now), null);
});

test("the chat gets the brief tool for prep requests", () => {
  assert.ok(ownToolsFor("Prep me for the 3pm").includes("prepare_meeting_brief"));
  assert.ok(ownToolsFor("Brief me on my meeting with Jane").includes("prepare_meeting_brief"));
  assert.ok(!ownToolsFor("Write a brief summary of this email").includes("prepare_meeting_brief"));
});
