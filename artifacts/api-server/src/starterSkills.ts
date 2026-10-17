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
  /**
   * Set when the skill was adapted from someone else's openly licensed
   * work - the licence notice and "modified" statement then live on the
   * About -> Licences page (docs/legal-compliance.md). Never shown in the
   * skill itself.
   */
  adaptedFrom?: string;
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
  // ── Added 2026-10-17 (docs/legal-compliance.md) ────────────────────────
  {
    name: "Internal communications",
    description: "Writes internal communications in clear, consistent formats: weekly 3P updates (Progress, Plans, Problems), company newsletters, FAQ answers, and general announcements to staff.",
    domain: "Administration",
    adaptedFrom: "Anthropic internal-comms skill (Apache 2.0), modified for Khameleon",
    content: [
      "When asked to write an internal communication:",
      "1. Work out which kind it is: a 3P update, a newsletter, FAQ answers, or a general message. If it isn't clear, ask.",
      "2. Use only what the user has given you or what's in the conversation. If something important is missing (team name, dates, the actual news), ask for it rather than inventing it.",
      "3. Write it in the matching format below, then offer to adjust tone or length.",
      "",
      "=== 3P update (Progress, Plans, Problems) ===",
      "For leaders and teammates who have some context but not a lot. Readable in under a minute. Covers one team over one period, usually a week. The bigger the team, the less detail per item.",
      "Format - keep exactly this shape:",
      "[an emoji that suits the update] [Team name] ([dates covered])",
      "Progress: [1-3 sentences - what was finished or achieved, with numbers where possible]",
      "Plans: [1-3 sentences - the top priorities for the next period]",
      "Problems: [1-3 sentences - what's slowing the team down: blockers, missing people or information]",
      "Matter-of-fact tone. If the team name or dates are missing, ask.",
      "",
      "=== Company newsletter ===",
      "For everyone in the organisation, covering the past week or month. About 15-25 short bullet points, each 1-2 sentences. Write as \"we\" - you're part of the organisation.",
      "Group bullets under a few headed sections that fit the news, for example: Announcements, Progress on priorities, People and hiring, Customers and partners, Coming up.",
      "Focus on things that affect most people: leadership announcements, big milestones, organisation-wide changes, external recognition. Leave out small team details (those belong in 3P updates) and anything already widely announced. Include links when the user provides them.",
      "",
      "=== FAQ answers ===",
      "For questions many people are asking. Format each one as:",
      "Question: [one sentence]",
      "Answer: [one or two sentences]",
      "Base answers on official information the user gives you. If something is uncertain, say so. Point out any question that needs an official answer from leadership.",
      "",
      "=== General message ===",
      "For anything that doesn't fit the formats above. First confirm the audience, the purpose, the tone (formal, friendly, urgent, informational) and any format requirements. Then: most important information first, short sentences, active voice, clear next steps or links.",
    ].join("\n"),
  },
  {
    name: "Skill writer",
    description: "Helps write or improve a Khameleon skill: turns a task you describe or have just done into clear, reusable steps with a good name and description, then tests and refines it.",
    domain: "Change",
    adaptedFrom: "Anthropic skill-creator skill (Apache 2.0), instructions only, modified for Khameleon",
    content: steps("When asked to create or improve a skill:", [
      "Understand the task first. If it was just done in this conversation, take the steps, the order, any corrections the user made, and the inputs and outputs from there. Otherwise ask: what should the skill achieve, when should it be used, and what should the result look like? Ask about edge cases and examples before writing anything.",
      "Write a short, plain name for the skill (e.g. \"Supplier invoice check\").",
      "Write a one- or two-sentence description that says what the skill does AND when to use it, using the words people actually say when they need it (e.g. \"invoice\", \"supplier\", \"check before paying\"). Khameleon picks skills by matching requests against names and descriptions, so this is what makes the skill get used.",
      "Write the steps as numbered, plain instructions in the imperative (\"Check that...\", \"List...\"). Explain why a step matters when it isn't obvious - that helps the skill handle situations the steps didn't foresee. Avoid shouting rules in capitals.",
      "Say exactly what the finished result should look like (sections, headings, a table, a short summary). Tell the skill to ask for missing information instead of guessing, and to mark anything uncertain.",
      "Keep it lean: remove steps that don't change the result. If it's getting long, split it into a main workflow plus clearly named reference sections.",
      "Never write a skill whose real purpose would surprise the person using it, or that tries to get around security, permissions or the organisation's rules.",
      "Suggest two or three realistic requests to try the skill with, the way a real person would phrase them. After trying them, improve the skill by fixing the underlying cause, not by patching one example.",
      "Show the finished skill (name, description, steps) for the user to review before they save it.",
    ]),
  },
  {
    name: "Document co-writing",
    description: "Works through writing a structured document together - a proposal, plan, specification, decision paper or report - from purpose and outline to a finished draft.",
    domain: "Change",
    content: steps("When asked to help write a document together:", [
      "Agree the basics before writing: what the document is for, who will read it, what decision or action it should lead to, roughly how long it should be, and the deadline. Ask about anything you don't know.",
      "Gather the material: ask the user for their notes, facts, figures and any previous versions. Note what's still missing.",
      "Propose an outline: the sections in order, with one line on what each will cover. Get the user's agreement or changes before drafting.",
      "Draft one section at a time, starting with the one that matters most to the reader. After each, ask whether it's right before moving on.",
      "Keep the reader in mind: lead with the main point or recommendation, use plain language, put detail in later sections or an appendix, and mark any figure or claim you couldn't confirm.",
      "When all sections are drafted, read the whole document as the reader would. Point out gaps, repetition and anything unclear, and suggest fixes.",
      "Finish with a short summary at the top (three to five sentences) and a list of open questions or decisions still needed.",
    ]),
  },
  {
    name: "Brand style check",
    description: "Checks a document, email or presentation text against your organisation's brand and writing rules - name usage, tone, terminology, formatting - and suggests corrections.",
    domain: "Governance",
    content: steps("When asked to check something against the organisation's brand or style:", [
      "Find the rules to check against. Use the rules below if they've been filled in; otherwise ask the user for their brand or style guide, or the key rules (how the organisation's name is written, tone of voice, words to use and avoid, formatting conventions).",
      "Go through the text and list each place it doesn't follow a rule: quote the text, say which rule it breaks, and give a corrected version.",
      "Check consistency too: the same terms, spellings, capitalisation, date and number formats throughout.",
      "Separate definite problems from suggestions, so the user knows what must change and what's optional.",
      "Finish with a corrected version of the full text if the user wants one.",
      "Our brand rules (edit this skill to fill these in): Organisation name written as: [ ]. Tone of voice: [ ]. Words to use: [ ]. Words to avoid: [ ]. Formatting conventions: [ ].",
    ]),
  },
];

/** Starters not yet in the database, matched by name (case-insensitive). */
export function missingStarters(existingNames: string[], starters: StarterSkill[] = STARTER_SKILLS): StarterSkill[] {
  const have = new Set(existingNames.map(n => n.trim().toLowerCase()));
  return starters.filter(s => !have.has(s.name.trim().toLowerCase()));
}
