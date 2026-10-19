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
import { callDesktop } from "../../lib/desktopLink.js";
import { signInWithSavedLogin } from "../../lib/savedLogins.js";
import { currentSkill } from "../../lib/skillContext.js";

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

/** Build 7: work in the user's other apps and files, through the desktop app. */
export async function desktopCommand(kind: "window" | "file", command: string): Promise<string> {
  if (!command.trim()) return "Say what to do, e.g. \"open Excel\".";
  try {
    return labelOutcome(await callDesktop(kind === "window" ? "window_command" : "file_command", { command }));
  } catch (err) {
    return `FAILED - ${err instanceof Error ? err.message : "the desktop app couldn't do that."}`;
  }
}

/** Makes success or failure unmistakable for a small AI: "DONE - …" / "FAILED - …". Pure. */
export function labelOutcome(result: string): string {
  const r = result.trim();
  if (/^(done|failed) -/i.test(r)) return r;
  return /^(couldn'?t|could not|can'?t|cannot|unable|no |not |unknown|error|failed|didn'?t|isn'?t|nothing)/i.test(r) ? `FAILED - ${r}` : `DONE - ${r}`;
}

/**
 * Honesty guard: if a tool reported FAILED but the AI's answer sounds like it
 * worked, add a plain correction rather than let a false "done" stand. Pure.
 */
export function guardFalseSuccess(answer: string, toolResults: string[]): string {
  const failures = toolResults.filter(r => /^FAILED -/i.test(r));
  if (!failures.length || toolResults.some(r => /^DONE -/i.test(r))) return answer;
  if (/\b(n'?t|not|fail|failed|unable|couldn|sorry|problem|error)\b/i.test(answer)) return answer;
  return `${answer}\n\n(Correction: that didn't actually work - ${failures[failures.length - 1].replace(/^FAILED - /i, "")})`;
}

/** Build 7: sign in with a saved login - asks the user first; the AI never sees the password. */
export async function signIn(login: string, app?: string): Promise<string> {
  try {
    return await signInWithSavedLogin(login, app, currentSkill());
  } catch (err) {
    return `FAILED - ${err instanceof Error ? err.message : "the sign-in couldn't be done."}`;
  }
}
