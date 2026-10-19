/**
 * Read-only work tools for the chat (docs/build-review.md, Builds 10-11):
 * the calendar, meeting briefs and the inbox. They only ever read - creating
 * or moving meetings, and sorting or archiving mail, happen only when the
 * user asks through the actions that already confirm first.
 */
import { listCalendarEvents, rangeFor, describeEvents } from "../../lib/calendarSource.js";
import { briefForRequest } from "../../lib/meetingPrepService.js";
import { listUnread, classifyMessages, describeInbox } from "../../lib/inboxTriage.js";
import { isConnected } from "../../lib/oauthTokens.js";

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

/** "Anything urgent?" - reads and reports; never moves or marks anything. */
export async function checkInbox(focus?: string): Promise<string> {
  try {
    const unread = await listUnread();
    if (!unread.length) {
      const any = (await isConnected("microsoft").catch(() => false)) || (await isConnected("google").catch(() => false));
      return any ? "No unread email in the inbox." : "No mailbox is connected - connect Outlook or Gmail in Integrations.";
    }
    return describeInbox(await classifyMessages(unread), focus);
  } catch (err) {
    return err instanceof Error ? err.message : "The inbox couldn't be read.";
  }
}
