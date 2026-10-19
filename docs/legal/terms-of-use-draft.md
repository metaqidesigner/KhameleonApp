# Khameleon Terms of Use - DRAFT

> **Draft for legal review - not yet approved, not legal advice.** Written 2026-10-20 to match what Khameleon actually does. Items in [square brackets] need a decision or wording from Newton or the lawyer. Questions for the reviewer are at the end. The commercial terms (price, payment, number of users, support levels) are expected to sit in a separate order form or licence agreement.

These terms are between **[COMPANY NAME]** ("we") and the **organisation** that installs Khameleon ("you"), and also apply to each person in your organisation who uses it ("users").

## 1. What Khameleon is

Khameleon is software that helps people with their work inside the apps they already use: it answers questions, works with email and calendars, records and replays tasks as skills, and can work in other apps on the user's computer when asked. It includes its own AI, **Khami**, which runs on your computers or your server, and can optionally connect to outside AI services and other systems you choose.

**You install and run Khameleon yourself.** We don't host it and we can't see the information in it.

## 2. Your licence

We give you a **non-exclusive, non-transferable licence** to install and use Khameleon for your organisation's internal business purposes, for [the number of users / the period] in your order, while you follow these terms.

You may not:

- sell, rent or sublicense Khameleon, or offer it to others as a service, without our written agreement;
- copy, change, or try to extract the source code, except as the law allows or as an open-source licence allows for its own component;
- remove Khameleon's notices, including the third-party licence notices;
- use Khameleon to break the law or anyone's rights, or to monitor people in a way the law doesn't allow (see section 6).

**Open-source parts.** Khameleon includes open-source software and AI models, each under its own licence, listed in About Khameleon → Licences and in the installer (`THIRD_PARTY_LICENSES.md`). Those licences apply to those parts and nothing in these terms limits your rights under them.

## 3. Outside services you connect

Khameleon can connect to services that **we don't run** - for example Microsoft 365 (including Copilot and Outlook), Google, Azure OpenAI, Anthropic, OpenAI, Google Gemini, OpenRouter, ElevenLabs, Spotify, weather services, and other integrations you add.

- **You choose** which ones to switch on, and you need your own account and agreement with each provider.
- **Their terms apply** to what is sent to them; we're not responsible for how they handle it or whether they're available.
- When you switch on an outside AI, user questions **except those Khameleon identifies as confidential** may be sent to it. For Azure OpenAI, your organisation's own Azure agreement governs that data.
- Names of these services are used only to describe what Khameleon connects to; they don't mean the providers endorse Khameleon.

## 4. Skills and integrations

Skills tell Khameleon how to do a task; integrations connect it to other systems. Users can create skills (including by recording a task with Capture), install them from others or from public directories, and add integrations.

- **You're responsible for the skills and integrations you install or allow**, and for making sure you have the right to use them. Skills from outside your organisation may not have been checked by us.
- Khameleon asks before a skill uses a saved login or takes an action in another app, and records what it does in the activity log, but **users should check what a skill does before relying on it**.

## 5. AI output and actions

- **AI can be wrong.** Answers, summaries, suggested replies, meeting briefs and procedure comparisons may be incomplete or incorrect. Users should check anything important before acting on it.
- **Khameleon doesn't send email on its own.** Suggested replies are saved as drafts; an email is only sent after a user reads it and presses send in Khameleon.
- **Actions in other apps happen because a user asked** - for example replaying a recorded skill. Replay stops at the first step it can't find rather than guessing, but users are responsible for checking the result.
- Khameleon is **not designed for decisions with legal or similarly significant effects on people** (for example hiring, credit or medical decisions) and must not be relied on for them. [REVIEWER - see question 3.]

## 6. Your responsibilities

You agree to:

- keep Khameleon's **encryption key, passwords and user accounts** safe, and run the server securely (by default Khameleon only accepts connections from the computer it's installed on, and requires a password or accounts when opened to a network);
- tell your users how Khameleon handles their information (our privacy notice can be adapted for this);
- **follow workplace-monitoring and data-protection law** if you allow *Capture* or *Spot tasks I repeat* for staff, including any impact assessment, consultation or notice the law requires;
- make sure you're allowed to send any information you connect to outside services;
- keep backups of your Khameleon data - you control the server, so **we can't recover lost data or a lost encryption key**.

## 7. Your data

**Your data stays yours.** We don't receive it, and Khameleon sends nothing to us - no usage data, analytics or crash reports. We don't use your data to train AI. [If support involves us seeing your data, a separate data processing agreement will apply - REVIEWER, see question 2.]

## 8. Our responsibilities

We'll provide Khameleon as described in its documentation and fix security problems we learn about within a reasonable time. [Support, updates and availability terms - TO BE SET in the order form.]

## 9. Warranty

Apart from what these terms expressly say, Khameleon is provided **"as is"**, and to the extent the law allows we give no other promises - including that it will be error-free or uninterrupted, that AI output will be accurate, or that outside services will work with it. [REVIEWER - consumer-law carve-outs if any users could be consumers; check the Australian Consumer Law if selling in Australia.]

## 10. Liability

To the extent the law allows:

- neither of us is liable for **indirect or consequential loss**, or loss of profit, revenue, data or goodwill;
- our total liability under these terms is limited to **[the fees you paid in the 12 months before the claim]**.

Nothing limits liability for death or personal injury caused by negligence, fraud, or anything else the law doesn't allow to be limited.

## 11. Ending these terms

You can stop using Khameleon at any time. We can end your licence if you seriously break these terms and don't fix it within [30] days of being told. When the licence ends you must stop using Khameleon; **your data stays on your systems** for you to keep or delete.

## 12. Changes

We may update these terms; we'll tell you at least [30] days before a change affects you. [Mechanism - REVIEWER.]

## 13. General

- **Trademarks.** "Khameleon", "Khami" and the Khameleon logo belong to [COMPANY NAME]. Other names belong to their owners.
- **Export.** You'll follow export and sanctions laws that apply to your use.
- **Governing law.** These terms are governed by the law of [JURISDICTION], and its courts have jurisdiction.
- **Contact.** [COMPANY ADDRESS AND EMAIL].

*Version [X], [DATE]*

---

## Questions for the reviewer

1. **Who signs.** These are written as organisation-level terms with users bound through their organisation. Do individual users also need to accept something in the app (e.g. on first run)?
2. **Support access.** If we ever look at a customer's system to give support, we may see their data. Should a data processing agreement be ready now?
3. **Automated decisions / AI regulation.** Is the "not for significant decisions" statement enough under the EU AI Act, UK guidance and Australian guidance for a workplace assistant? Are any transparency notices needed in the app (e.g. labelling AI-written drafts)?
4. **Outside AI provider terms.** Do any of the providers' terms (Microsoft Copilot APIs, Anthropic, OpenAI, Google) restrict how Khameleon may route to them, present them, or describe them? (Already on the legal checklist.)
5. **Recording other people.** Capture can record what's on screen when screenshots are allowed - which may include other people's information (e.g. emails from clients). Should the terms say more about this?
6. **Saved logins.** Typing a user's saved login into a third-party website may conflict with some websites' terms. Is the "user is responsible" position enough?
7. **Jurisdiction and consumer law.** Which country's law, and is the product ever sold to individuals (consumers) rather than organisations?
