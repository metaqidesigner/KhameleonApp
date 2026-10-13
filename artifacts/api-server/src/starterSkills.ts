/**
 * Starter skills shipped with Khameleon (docs/starter-skills-draft.md,
 * approved by Newton 2026-10-13). Plain-language steps that work from what
 * the user gives the chat; none of them sends, submits or deletes anything.
 * Each is tagged with one built-in work domain by name.
 *
 * Seeded by seed-skill-sets-data.ts: any starter missing by name is added
 * as "available" on startup, so existing installs get new starters too.
 */

export interface StarterSkill {
  name: string;
  description: string;
  /** Name of a built-in work domain (seed-skill-sets-data.ts DEFAULT_WORK_DOMAINS). */
  domain: string;
  content: string;
}

function steps(intro: string, list: string[]): string {
  return [intro, ...list.map((s, i) => `${i + 1}. ${s}`)].join("\n");
}

export const STARTER_SKILLS: StarterSkill[] = [
  {
    name: "Month-end reconciliation check",
    description: "Compares two sets of figures and lists what matches, what doesn't, and what's missing.",
    domain: "Business as Usual",
    content: steps("When asked to reconcile two sets of figures (e.g. month-end):", [
      "Ask for the two sources if they haven't been given (e.g. the spreadsheet totals and the system or bank figures), and what should be matched on (reference, date, amount).",
      "Match line by line on that key.",
      "List three groups: matched; mismatched (show both values and the difference); in one source only.",
      "Give the totals for each source and the overall difference.",
      "Suggest the likely cause for each mismatch (timing, rounding, duplicate, keying error) and mark it \"suggested\", not confirmed.",
      "End with a short list of items the user needs to check by hand.",
    ]),
  },
  {
    name: "Invoice check",
    description: "Checks an invoice's details before it's paid or entered.",
    domain: "Business as Usual",
    content: steps("When asked to check an invoice:", [
      "Pull out supplier, invoice number, date, due date, line items, subtotal, tax and total.",
      "Check the arithmetic: line items add up to the subtotal, and the tax and total are right.",
      "Flag anything missing: purchase order number, tax number, bank details, payment terms.",
      "Flag anything unusual: a duplicate invoice number if earlier ones are given, a total far above similar invoices, a due date already passed.",
      "Present a short summary: \"Ready to process\" or \"Needs attention\", with the reasons.",
    ]),
  },
  {
    name: "Expense report preparation",
    description: "Turns a list of receipts or expenses into a tidy report.",
    domain: "Business as Usual",
    content: steps("When asked to prepare an expense report:", [
      "List each expense with date, merchant, amount and category (travel, meals, accommodation, supplies, other).",
      "Total by category and overall.",
      "Flag missing receipts, unclear items, and anything that looks outside normal policy (e.g. alcohol, first-class travel) if the user has said what their policy is.",
      "Write a one-paragraph business purpose summary.",
      "Present the report for review; never submit it.",
    ]),
  },
  {
    name: "Client onboarding checklist",
    description: "Builds a checklist and welcome note for a new client.",
    domain: "Business as Usual",
    content: steps("When asked to onboard a new client:", [
      "Ask for the client's name, the service, the start date and the main contact, if not given.",
      "Produce a checklist: contract signed, details captured, accounts and access set up, kickoff meeting booked, first deliverable date agreed.",
      "Mark each item done or to do from what the user has said.",
      "Draft a short welcome email for the user to review.",
    ]),
  },
  {
    name: "Meeting minutes and action items",
    description: "Turns notes or a transcript into minutes with clear actions.",
    domain: "Administration",
    content: steps("When asked to write up meeting minutes:", [
      "List attendees and the date if they're given.",
      "Summarise each topic discussed in two or three sentences.",
      "Record decisions made, word for word where possible.",
      "List action items as: what, who, by when. Mark the owner or date \"not stated\" rather than guessing.",
      "Keep the minutes to one page.",
    ]),
  },
  {
    name: "Meeting Prep Briefing",
    description: "Builds a short pre-meeting briefing from the meeting's own details and any linked context.",
    domain: "Administration",
    content: steps("When asked to prep for a meeting:", [
      "Summarise the meeting's stated purpose and attendees.",
      "Note open items from the last meeting with the same attendees, if available.",
      "Suggest up to 3 questions worth raising.",
      "Keep the whole briefing under 150 words.",
    ]),
  },
  {
    name: "Weekly Status Update Drafting",
    description: "Guides the agent through drafting a weekly status update from your recent task and calendar activity.",
    domain: "Administration",
    content: steps("When asked to draft a weekly status update:", [
      "Review completed and in-progress tasks from the last 7 days.",
      "Group them under Done / In Progress / Blocked.",
      "One sentence per line, plain language.",
      "End with a one-line callout for anything that needs a decision from someone else.",
      "Present the draft for review; never send it.",
    ]),
  },
  {
    name: "Approvals follow-up",
    description: "Lists outstanding approvals and drafts polite reminders.",
    domain: "Administration",
    content: steps("When asked to follow up on outstanding approvals:", [
      "List each item waiting on someone: what it is, who it's waiting on, and how long it has been waiting.",
      "Sort by how long it has been waiting, longest first.",
      "Draft a short, friendly reminder for each, firmer for anything over a week.",
      "Present the drafts for review; never send them.",
    ]),
  },
  {
    name: "New starter first week",
    description: "Plans a new team member's first week.",
    domain: "People",
    content: steps("When asked to plan a new starter's first week:", [
      "Ask for their name, role, start date and manager, if not given.",
      "Lay out day by day: welcome and setup, introductions, systems training, first small task, end-of-week check-in.",
      "List the access and equipment they'll need before day one.",
      "Draft a welcome message from the manager for review.",
    ]),
  },
  {
    name: "One-on-one prep",
    description: "Prepares the manager for a one-on-one.",
    domain: "People",
    content: steps("When asked to prepare for a one-on-one:", [
      "Summarise what the person has been working on, from what the user provides.",
      "Note wins to recognise and anything that looks stuck.",
      "Carry over open items from the last one-on-one, if given.",
      "Suggest three open questions (e.g. \"What's getting in your way?\").",
      "Keep it under 150 words.",
    ]),
  },
  {
    name: "Policy or procedure review",
    description: "Checks a policy or procedure document for gaps and clarity.",
    domain: "Governance",
    content: steps("When asked to review a policy or procedure:", [
      "Summarise what the document covers in three sentences.",
      "Check it has: an owner, an effective date, a review date, a scope, and clear steps.",
      "Flag unclear wording, steps with no owner, and anything that contradicts itself.",
      "If an earlier version is given, list what changed.",
      "Present findings as: Missing / Unclear / Suggested changes.",
    ]),
  },
  {
    name: "Incident write-up",
    description: "Writes up an incident or issue in a standard format.",
    domain: "Governance",
    content: steps("When asked to write up an incident or issue:", [
      "What happened, and when it started and ended.",
      "Who and what was affected, and how badly.",
      "The cause, marked \"suspected\" unless confirmed.",
      "What was done to fix it.",
      "Actions to stop it happening again: what, who, by when.",
      "Keep it factual and blame-free.",
    ]),
  },
  {
    name: "Project kickoff brief",
    description: "Builds a one-page brief to start a project.",
    domain: "Change",
    content: steps("When asked for a project kickoff brief:", [
      "Goal: one sentence on what success looks like.",
      "Scope: what's in and what's out.",
      "Stakeholders and who decides.",
      "Key milestones with rough dates.",
      "Top three risks and how to reduce each.",
      "Mark anything the user hasn't provided as \"to confirm\".",
    ]),
  },
  {
    name: "Report or board pack summary",
    description: "Turns a long report into a short summary for busy readers.",
    domain: "Strategic",
    content: steps("When asked to summarise a report or board pack:", [
      "An executive summary of no more than five bullet points.",
      "Key figures, quoted exactly from the report.",
      "Decisions or approvals being asked for.",
      "Risks or concerns raised.",
      "Questions a board member is likely to ask.",
      "Never add figures that aren't in the report.",
    ]),
  },
];

/** Starters not yet in the database, matched by name (case-insensitive). */
export function missingStarters(existingNames: string[], starters: StarterSkill[] = STARTER_SKILLS): StarterSkill[] {
  const have = new Set(existingNames.map(n => n.trim().toLowerCase()));
  return starters.filter(s => !have.has(s.name.trim().toLowerCase()));
}
