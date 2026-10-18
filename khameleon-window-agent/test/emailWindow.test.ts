import { describe, expect, it } from "vitest";
import { emailFromWindow, isNewEmail } from "../src/emailWindow";

describe("emailFromWindow", () => {
  it("reads the subject of an email opened in Gmail or Outlook on the web", () => {
    expect(emailFromWindow("Google Chrome", "Q3 figures - jane@gmail.com - Gmail")).toEqual({ client: "gmail-web", subject: "Q3 figures" });
    expect(emailFromWindow("Microsoft Edge", "RE: Supplier statement - Jane Smith - Outlook - Microsoft​ Edge")).toEqual({ client: "outlook-web", subject: "RE: Supplier statement" });
    expect(emailFromWindow("Safari", "Supplier statement - Outlook")).toEqual({ client: "outlook-web", subject: "Supplier statement" });
  });

  it("knows an inbox or list from an opened email", () => {
    expect(emailFromWindow("Google Chrome", "Inbox (3) - jane@gmail.com - Gmail")).toEqual({ client: "gmail-web", subject: null });
    expect(emailFromWindow("Firefox", "Mail - Jane Smith - Outlook")).toEqual({ client: "outlook-web", subject: null });
    expect(emailFromWindow("Microsoft Outlook", "Inbox • jane@acme.com")).toEqual({ client: "outlook", subject: null });
    expect(emailFromWindow("OUTLOOK", "Inbox - jane@acme.com - Outlook")).toEqual({ client: "outlook", subject: null });
    expect(emailFromWindow("Mail", "All Inboxes – 3 unread")).toEqual({ client: "mail", subject: null });
  });

  it("reads the subject from mail apps' own message windows", () => {
    expect(emailFromWindow("OUTLOOK", "Supplier statement - Message (HTML)")).toEqual({ client: "outlook", subject: "Supplier statement" });
    expect(emailFromWindow("Microsoft Outlook", "Supplier statement")).toEqual({ client: "outlook", subject: "Supplier statement" });
    expect(emailFromWindow("Mail", "Lunch on Friday?")).toEqual({ client: "mail", subject: "Lunch on Friday?" });
    expect(emailFromWindow("Google Chrome", "Important: Q3 deadline (2) - jane@gmail.com - Gmail")).toEqual({ client: "gmail-web", subject: "Important: Q3 deadline (2)" });
    expect(emailFromWindow("Mail", "Mail merge question")).toEqual({ client: "mail", subject: "Mail merge question" });
  });

  it("ignores everything that isn't mail", () => {
    expect(emailFromWindow("Google Chrome", "BBC News - Home")).toBeNull();
    expect(emailFromWindow("Microsoft Excel", "Purchase Ledger 2026.xlsx")).toBeNull();
    expect(emailFromWindow("Google Chrome", "Calendar - Jane Smith - Outlook")).toBeNull();
  });
});

describe("isNewEmail", () => {
  const now = Date.parse("2026-10-18T12:00:00Z");
  it("counts unread mail, and mail that arrived in the last hour", () => {
    expect(isNewEmail(true, undefined, now)).toBe(true);
    expect(isNewEmail(false, "2026-10-18T11:30:00Z", now)).toBe(true);
    expect(isNewEmail(false, "2026-10-18T09:00:00Z", now)).toBe(false);
    expect(isNewEmail(false, undefined, now)).toBe(false);
  });
});
