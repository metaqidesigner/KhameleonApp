/**
 * Read-only work tools for the chat (docs/build-review.md, Builds 10-11):
 * the calendar, meeting briefs and the inbox. They only ever read - creating
 * or moving meetings, and sorting or archiving mail, happen only when the
 * user asks through the actions that already confirm first.
 */
import { listCalendarEvents, rangeFor, describeEvents } from "../../lib/calendarSource.js";
import { briefForRequest } from "../../lib/meetingPrepService.js";

export async function getCalendar(when?: string): Promise<string> {
  const { from, to, label } = rangeFor(when);
  try {
    return describeEvents(await listCalendarEvents(from, to), label);
  } catch (err) {
    return err instanceof Error ? err.message : "The calendar couldn't be read.";
  }
}

export async function prepareMeetingBrief(meeting: string): Promise<string> {
  try {
    return await briefForRequest(meeting || "my next meeting");
  } catch (err) {
    return err instanceof Error ? err.message : "The brief couldn't be made.";
  }
}
