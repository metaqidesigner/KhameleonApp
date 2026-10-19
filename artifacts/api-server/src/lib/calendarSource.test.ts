import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGoogleEvents, parseOutlookEvents, rangeFor, describeEvents, otherPeople } from "./calendarSource.js";
import { ownToolsFor } from "../agents/tools/anyAiTools.js";

test("reads Google events: attendees, the user's own 'no', free time, all-day", () => {
  const [a, b, c] = parseGoogleEvents([
    { id: "1", summary: "Q3 review", start: { dateTime: "2026-10-19T14:00:00+01:00" }, end: { dateTime: "2026-10-19T15:00:00+01:00" },
      attendees: [{ email: "me@acme.com", self: true, responseStatus: "accepted" }, { email: "Jane@acme.com", displayName: "Jane Smith" }, { email: "bob@acme.com", responseStatus: "declined" }] },
    { id: "2", summary: "Offsite", start: { date: "2026-10-20" }, end: { date: "2026-10-21" } },
    { id: "3", summary: "Lunch", transparency: "transparent", start: { dateTime: "2026-10-19T12:00:00Z" }, end: { dateTime: "2026-10-19T13:00:00Z" }, attendees: [{ email: "me@acme.com", self: true, responseStatus: "declined" }] },
  ]);
  assert.deepEqual(otherPeople(a).map(p => p.name), ["Jane Smith"]);
  assert.equal(b.allDay, true);
  assert.equal(c.free, true);
  assert.equal(c.declined, true);
  assert.equal(parseGoogleEvents([{ id: "x", status: "cancelled", start: {}, end: {} }]).length, 0);
});

test("reads Outlook events, treating their times as UTC", () => {
  const [e] = parseOutlookEvents([{ id: "o1", subject: "Supplier call", start: { dateTime: "2026-10-19T13:00:00.0000000" }, end: { dateTime: "2026-10-19T13:30:00.0000000" }, showAs: "busy",
    responseStatus: { response: "accepted" }, attendees: [{ emailAddress: { address: "Jane@Acme.com", name: "Jane Smith" } }] }]);
  assert.equal(e.start, "2026-10-19T13:00:00Z");
  assert.equal(e.attendees[0].email, "jane@acme.com");
  assert.equal(e.declined, false);
});

test("turns 'tomorrow', 'this week' and dates into time ranges", () => {
  const now = new Date(2026, 9, 21, 10, 0); // Wednesday
  assert.equal(rangeFor("tomorrow", now).from.getDate(), 22);
  const week = rangeFor("this week", now);
  assert.equal(week.to.getDate(), 26, "up to Monday");
  assert.equal(rangeFor("next week", now).from.getDate(), 26);
  assert.equal(rangeFor("2026-11-02", now).from.getMonth(), 10);
  assert.equal(rangeFor(undefined, now).label, "the rest of today");
});

test("describes the day for the chat, leaving out declined meetings", () => {
  const events = parseGoogleEvents([
    { id: "1", summary: "Q3 review", location: "Room 2", start: { dateTime: "2026-10-19T14:00:00Z" }, end: { dateTime: "2026-10-19T15:00:00Z" }, attendees: [{ email: "jane@acme.com", displayName: "Jane" }] },
    { id: "2", summary: "Skipped", start: { dateTime: "2026-10-19T16:00:00Z" }, end: { dateTime: "2026-10-19T17:00:00Z" }, attendees: [{ email: "me@acme.com", self: true, responseStatus: "declined" }] },
  ]);
  const text = describeEvents(events, "today");
  assert.match(text, /Q3 review \(Room 2\) - with Jane/);
  assert.doesNotMatch(text, /Skipped/);
  assert.equal(describeEvents([], "tomorrow"), "Nothing in the calendar for tomorrow.");
});

test("the chat gets the calendar tool for calendar questions only", () => {
  assert.ok(ownToolsFor("What's on this afternoon?").includes("get_calendar"));
  assert.ok(ownToolsFor("Am I free tomorrow at 3?").includes("get_calendar"));
  assert.ok(!ownToolsFor("Summarise this paragraph").includes("get_calendar"));
});
