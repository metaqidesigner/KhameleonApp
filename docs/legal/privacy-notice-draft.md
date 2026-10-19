# Khameleon Privacy Notice - DRAFT

> **Draft for legal review - not yet approved, not legal advice.** Written 2026-10-20 from what the software actually does (checked against the code). Items in [square brackets] need a decision or wording from Newton or the lawyer. Questions for the reviewer are at the end.

**Who this notice is for.** People who use Khameleon at work, and the organisations that install it.

**The short version**

- Khameleon runs on **your computer and your organisation's own Khameleon server**. [COMPANY NAME] (the maker of Khameleon) does not run a service your data passes through, and **receives none of your data** - no usage tracking, no analytics, no crash reports.
- Khameleon's own AI, **Khami, runs on your computer or your organisation's server**. What you ask Khami stays there.
- **Outside AI services** (such as Microsoft 365 Copilot) are only used if your organisation has switched them on, and **work that looks confidential is never sent to them**.
- Khameleon **never sends an email on its own**. It only sends one after you have read it and pressed send in Khameleon.
- Features that watch what you do on your computer (**Capture** and **Spot tasks I repeat**) are **off until you start or switch them on**, and you can stop them or delete their history at any time.

---

## 1. Who is responsible for your data

Khameleon is software that an organisation installs and runs itself. **Your organisation decides** whether to use Khameleon, which features and outside services are switched on, and how long information is kept. For data-protection purposes, your organisation is the **controller** of the personal information Khameleon handles.

[COMPANY NAME] makes the software but does not host it, cannot see the information in it, and does not process it on your organisation's behalf. [CONFIRM - this depends on the launch model: if [COMPANY NAME] ever hosts Khameleon for customers, or offers support with access to customer data, it becomes a processor and this section, plus a data processing agreement, must change.]

Questions about how your organisation uses Khameleon should go to [ORGANISATION'S PRIVACY CONTACT]. Questions about the software itself: [COMPANY CONTACT EMAIL].

## 2. Where your information is kept

| Where | What is kept there |
|---|---|
| **Your organisation's Khameleon server** (or your own computer, for a single-person install) | Your chats with Khameleon, tasks, notes, skills you create (including Capture recordings), meeting briefs, the activity log, your settings, and connections to your accounts |
| **Your computer only** | The desktop app's own memory, and the **Spot tasks I repeat** history (which apps and windows you switched between) |

Passwords and keys you save in Khameleon (for example a login you let Khameleon type for you, or an outside AI's key) are **locked with strong encryption** (AES-256-GCM) using a key only your organisation's server holds.

## 3. What Khameleon does with your information

### Chatting with Khameleon and Khami

When you ask Khameleon something, **Khami answers by default, on your computer or your organisation's server**. Khami may look at things you've allowed it to - your calendar, your inbox, your tasks, files you point it to - to answer.

### Outside AI services (only if your organisation switches them on)

Your organisation can let Khameleon pass some questions to an outside AI service - **Microsoft 365 Copilot** first, and also Azure OpenAI (your organisation's own), Anthropic Claude, OpenAI, Google Gemini or OpenRouter. Khameleon may suggest one when a question is hard for Khami, or you can choose one yourself.

When that happens, **the question and the information needed to answer it are sent to that service** and handled under the agreement between your organisation and that provider - not by [COMPANY NAME].

**Confidential work is never sent.** Before anything goes to an outside AI, Khameleon checks it for signs of confidential or personal information (for example bank details, national insurance or tax numbers, "confidential" markings, client data). If it finds any, **only Khami answers**. [REVIEWER: this check is automatic and good but not perfect - see question 3.]

### Your email and calendar (if you connect them)

If you connect Microsoft 365 (Outlook) or Google (Gmail, Google Calendar), Khameleon asks for permission to read, organise and draft your email, read and change your calendar, and send email. It uses that to:

- **summarise an email and suggest a reply** when you open it or ask - the reply is saved as a **draft** for you to check and send yourself;
- **sort your inbox** when you ask (with Undo), and flag what looks urgent;
- **prepare a brief before a meeting** - who's coming, recent emails from them, related tasks. Briefs are deleted after about a month;
- **send an email only after you've read it and pressed send in Khameleon.**

You can disconnect an account at any time in Settings.

### Saved logins

If you save a login (for example for a supplier website) and let a skill use it, **Khameleon asks you first** (once, always for that skill, or no) and the desktop app types it into the sign-in window itself. **The AI never sees the password.** Every use is recorded in the access log you can see in Settings.

### Capture (recording a task to make a skill)

Capture records a task **only while you are recording** - the capture bar shows it's on. It records which windows you used, the **names of the buttons you clicked and boxes you typed in**, and what you typed - but **never passwords** (they become "entered a password"), and typing that looks confidential is left out. Screenshots are only taken if you allow it. The recording is saved as a skill you can edit, replay or delete.

### Spot tasks I repeat (off unless you switch it on)

If you switch it on, the desktop app keeps a **private log, on your computer only, of which apps and windows you switch between** - no typing, screenshots or clicks - so it can notice a task you repeat and offer to turn it into a skill.

- It is kept for **30 days** by default (you can choose 7-90) and you can **delete it at any time** (Delete my history).
- **Banking, password manager and private browsing windows are left out** by default, and you can add your own exclusions.
- An extra option, **Also watch what's in the window**, reads the window's title and visible text (after about 20 seconds on a window, at most once a minute) so Khami can suggest a matching skill. This is checked **by Khami only**, never an outside AI. A **"Watching for tasks"** sign shows while it's on, with a Pause button.
- Khameleon only ever **offers** - it never starts a task by itself.

### Working in your other apps

When you ask, Khameleon can open apps, find files and click and type in other apps for you through the desktop app (for example replaying a recorded skill). A coloured border shows which window Khameleon is looking at or working in, and every action is recorded in the activity log.

### Reading documents

Documents you give Khameleon (PDF, Word, scanned pages and photos) are read **on your computer or your organisation's server** - including text recognition for scanned pages.

### Voice

[REVIEWER / NEWTON - see question 1.] If you use the wake word or speak to Khameleon, speech recognition is done by **your web browser's built-in speech service**, which in some browsers (for example Google Chrome) **sends the audio to the browser maker's servers**. If your organisation has set up spoken replies, the text of Khameleon's reply is sent to a text-to-speech service ([ElevenLabs]) to turn it into speech.

### Other services

- **Weather**: if you use the weather display, your chosen location is sent to Open-Meteo to get the forecast.
- **Music**: if you connect Spotify, Khameleon can show and control what's playing.
- **Integrations your organisation adds** (connectors to other business systems): information is exchanged with those systems as the integration needs, under their own terms.
- **Skill and integration directories**: when you browse for new skills or integrations, Khameleon looks them up in public directories (GitHub, the public MCP directory). Nothing about you is sent beyond a normal web request.
- **One-time downloads**: when Khami is set up, its AI model files are downloaded once from a public model library (Hugging Face), and the first time Khameleon reads a scanned page it downloads the English text-recognition data once. These are public files; **none of your information is sent**, though like any download the provider sees your network address.

## 4. What [COMPANY NAME] receives

**Nothing.** Khameleon does not send usage statistics, analytics, crash reports or any of your content to [COMPANY NAME]. The app's fonts and images are built in, so opening Khameleon contacts no outside service. [CONFIRM if this changes - e.g. update checks, licence checks or support tools would need adding here.]

## 5. How long information is kept

| Information | How long |
|---|---|
| Spot tasks I repeat history | 30 days by default (7-90, your choice); delete any time |
| Meeting briefs | About a month after the meeting |
| Sign-in sessions | Until they expire or you sign out |
| Everything else (chats, tasks, skills, recordings, activity log, saved logins) | Until you or your organisation delete it [ORGANISATION TO SET A RETENTION POLICY - see question 4] |

## 6. Your rights

Depending on where you are, you may have the right to see, correct, delete or move your personal information, or to object to how it's used. Because your organisation runs Khameleon, **ask your organisation** ([ORGANISATION'S PRIVACY CONTACT]). Much of it you can do yourself in Khameleon: delete chats, skills, recordings, saved logins and the Spot tasks I repeat history, and disconnect accounts.

## 7. Security

By default Khameleon can only be reached **from the computer it's installed on**. When an organisation makes it available on its network, Khameleon **requires a password or user accounts**. Only Khameleon's own windows can use it; other websites can't. Saved passwords and keys are encrypted. [COMPANY NAME] reviewed Khameleon's security on 2026-10-20.

## 8. Changes to this notice

[COMPANY NAME] will update this notice when Khameleon changes what it does with information, and the date below will change.

*Last updated: [DATE]*

---

## For organisations installing Khameleon

Before switching Khameleon on for staff, your organisation should consider:

- **Workplace monitoring rules.** *Spot tasks I repeat* and *Capture* observe how someone works. In many places (for example under the UK and EU GDPR, and employment and works-council rules) switching such features on for staff may need a **data protection impact assessment**, consultation, and a clear notice to staff. Khameleon leaves these off by default and puts each person in control of their own; [REVIEWER - see question 5 on whether an organisation should be able to switch them on for staff at all].
- **Outside AI services.** Switching one on means staff questions (except confidential ones) can go to that provider. Check your agreement with them covers this; for Azure OpenAI, your own Azure agreement applies.
- **Retention.** Decide how long chats, recordings and logs are kept.
- **The encryption key.** Keep the server's encryption key safe - if it's lost, saved logins and keys can't be read.

---

## Questions for the reviewer

1. **Voice.** Browser speech recognition can send audio to the browser maker (Google in Chrome). This conflicts with "confidential work never leaves the computer". Options: (a) disclose it as above, (b) switch voice off by default with a clear warning, or (c) replace it with on-device speech recognition before launch. [Recommendation from development: (b) for launch, (c) later.]
2. **Controller / processor.** Is it right that [COMPANY NAME] is neither controller nor processor while customers self-host and [COMPANY NAME] has no access to their data? What changes if [COMPANY NAME] provides support with access, or a hosted version?
3. **Confidential check wording.** The automatic check is pattern-based. Is "confidential work is never sent" acceptable, or should it say "Khameleon checks for and holds back work that looks confidential"?
4. **Retention.** Should Khameleon ship with default deletion periods for chats, recordings and the activity log, rather than leaving it to each organisation?
5. **Employee monitoring.** Should an organisation be able to switch *Spot tasks I repeat* or content watching on for staff centrally, or should it stay each person's own choice (as built now)?
6. **Children.** Khameleon is a workplace product; is a "not for under-18s / not directed at children" statement needed?
7. **International transfers.** When an organisation switches on an outside AI, data may go to another country. Is it enough that this falls under the organisation's agreement with that provider?
