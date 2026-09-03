# Khameleon — Lean v1 Scope

## Positioning

Khameleon is built for individuals working inside corporations — the knowledge workers who spend their day in email, CRM, spreadsheets, project trackers, and internal tools — not for the corporation itself as a buyer. It operates *inside the apps they already use*, the same way the person does: reading screens, clicking, typing, navigating. It does not ask anyone to move data into a new system, adopt a new interface, or change how their team works, and it does not require an IT-led, org-wide rollout to be useful to one person. The name is the pitch: it adapts to whatever environment it's dropped into, rather than making the environment adapt to it.

This is a meaningfully different bet than most of the field. Voice-companion products (Asiko, Alexa+) sell presence and conversation. Executive-assistant products (alfred_) sell narrow inbox/calendar triage. Workflow builders (Bardeen, Gumloop, Lindy) sell a canvas the user has to design automations on. Enterprise agent platforms (Copilot Agent 365, PwC Agent OS) sell IT-deployed, governed automation across an org. Khameleon's gap is: a self-serve tool an individual employee at a corporation can pick up on their own — no procurement cycle, no IT deployment — that takes action across *multiple* of a person's own daily apps, without requiring them to pre-build a workflow or have an API integration exist for every tool.

## Competitive landscape (closest comps)

| Product | What it actually does | Where Khameleon differs |
|---|---|---|
| Bardeen | Browser-agent automation, runs actions in open tabs, user builds the automation | Khameleon should observe recurring patterns and propose the automation, not require a workflow builder |
| Gumloop / Lindy | No-code multi-step agent pipelines, API-connector based | API-only breaks on tools without APIs (internal tools, legacy web apps); Khameleon needs a UI-automation fallback |
| alfred_ | Deep but narrow — email/calendar only | Proof that narrow + reliable beats broad + shallow; informs the wedge choice below |
| Copilot Agent 365 | Enterprise, IT-provisioned, governance-first | Not self-serve, not for an individual who wants to automate their own workflow today |
| RPA (UiPath etc.) | UI automation at enterprise scale | Requires process mapping and IT setup; no adaptive/self-serve layer for one person |

None of these combine "acts across a person's own arbitrary app stack" with "no per-app integration required" with "self-serve, individual pricing." That combination is the actual product.

## The v1 wedge

Don't build the general platform first. Pick one narrow, high-frequency pattern: **a piece of information lands in one app and needs to be entered or updated in another app, the same way, every time** (e.g., a request arrives in email or Slack and needs a corresponding record created or updated in a CRM, tracker, or spreadsheet). This is the single most common repetitive cross-app task knowledge workers do, it's easy to detect, easy to verify success on, and low-risk to get wrong (worst case: a duplicate or missed entry, not a sent email or a payment).

Scope v1 to exactly one trigger app and one destination app per user, confirmed by the user once, then run automatically. Resist adding a third app, a workflow builder UI, voice, or the dashboard/telemetry polish already mocked up — those come later. The job of v1 is to prove the core mechanic (agent reliably acts inside real apps on someone's behalf) works and saves real time, not to ship the full vision.

## Technical approach

Use a hybrid execution engine rather than committing to one automation style:

- **API-first** wherever the destination app has one (Gmail, Slack, Google Sheets, Notion, HubSpot, most modern SaaS). Cheap, fast, reliable — this should be the default path.
- **Computer-use / browser automation fallback** for apps without APIs or where the user's specific internal tool has none. This is slower and more expensive per action, but it's what lets Khameleon truthfully claim to work with *whatever the person already uses*, which is the differentiator against API-only tools like Gumloop and Lindy.

This is a real, available building block today — Anthropic's Claude computer-use tooling (the same capability underlying Claude in Chrome and Claude Cowork) does exactly this: reads a screen, clicks, types, adapts when a button moves. You would be building a product experience and a reliability layer on top of an existing capability, not inventing computer-use agents from scratch.

### How execution actually works

This is the mechanism that makes "no API required, no pre-built workflow" more than a slogan — it's the same computer-use capability underlying Grok Bot and Claude in Chrome, operating on two levels depending on what the target app exposes.

**Reading the app.** For a normal web app, the agent reads the page's DOM/accessibility tree directly — the same structured data screen readers use — so it identifies "the field labeled Customer Name" or "the Save button" semantically rather than by pixel position. This is fast and cheap, and should be the default path. If the app is a legacy internal tool, an Electron app, or anything with no clean structure to read, the agent falls back to vision: a screenshot, interpreted by a vision-capable model the way a person would look at the screen. That fallback is slower and costs more per step (screenshot tokens add up), which is why it's reserved for apps that genuinely need it rather than used everywhere.

**Acting on the app.** Once it knows what's there, the agent drives the same inputs a human would — click, type, scroll, navigate — inside a real browser session, ideally a persistent sandboxed one (Grok Bot's "own computer" approach) so work continues even when the person isn't watching. After each action it re-checks the resulting screen state before moving on, catching a failed click or an unexpected popup rather than barreling forward blind.

**Why it doesn't need an API or a pre-built workflow.** Targeting is semantic ("the button that submits the form") rather than a fixed API call or a hardcoded coordinate, so it survives the app changing its layout — a redesign that would break a brittle script just gets re-identified by function. This is also what makes learn-by-demonstration possible (Phase 3): when a user shows the agent a task once, it isn't recording exact clicks, it's extracting the generalized steps ("find the record matching X, update field Y with the value from Z") so it can replay the *intent* on different data next time, not a literal macro.

**Authentication.** The agent operates inside a session the person has already logged into — the user authenticates once and hands off an active session to the agent's sandboxed browser profile, or it prompts the person to log in when a session expires. It isn't independently scraping or storing raw credentials; it's working inside a browser context the same way a human colleague using the same login would. Credential scoping and sandbox isolation should be treated as a first-class design decision, not an afterthought — see Key Risks below.

## Cost model

Two very different cost profiles per action, so the architecture above isn't just a reliability choice — it's the thing that keeps unit economics sane:

- **API-based action**: mostly reasoning tokens, on the order of a few cents per action even on capable models.
- **Computer-use action**: each step adds a base tool-call overhead plus a full screenshot's worth of image tokens, repeated per step in a multi-step task. A single UI-driven task can run noticeably higher than an API call — meaningfully more if the task takes many steps or uses a large/expensive model.

Practical implication: default every action to an API connector when one exists, reserve computer-use for the apps that genuinely have no other path, and use a cheaper model tier for the UI-automation loop where possible. Comparable self-serve tools price individual plans in the $10–$50/month range (Bardeen $10–$50, Gumloop from $37) on credit-based systems — that's a reasonable anchor for where Khameleon's own pricing should land, with the hybrid approach protecting margin under it.

## Suggested build plan

**Phase 0 — Validate before building (1–2 weeks).** Pick 5–10 target users with the exact same trigger-app/destination-app pattern. Do the automation for them manually or with existing no-code tools (Zapier, Gumloop, or Claude computer-use directly). Confirm it actually saves meaningful time and that they'd pay for it, before writing custom product code.

**Phase 1 — MVP (single pattern, API-first).** One trigger app, one destination app, API connectors only, simple "here's what I'm about to do, confirm once" flow. No voice, no dashboard, no multi-agent orchestration yet.

**Phase 2 — UI-automation fallback.** Add computer-use execution for the same pattern when no API exists. This is where the real differentiation and the real cost/reliability engineering happens — treat it as its own milestone, not a bolt-on.

**Phase 3 — Adaptive detection.** The signature "Khameleon" feature: the agent notices a user doing the same cross-app action repeatedly and offers to take it over, rather than the user having to configure anything. This is what separates the product from a workflow builder.

**Phase 4 — Expand.** More app pairs, the dashboard/telemetry UI already designed, voice/wake-word, multi-agent orchestration. This is genuinely a phase-4 concern — it's the most visually compelling part of the current mockup but the least load-bearing for proving the business works.

## Competitive update — Grok Bot (Aug 11, 2026)

xAI and Cursor — who are in the process of merging into a single company — launched Grok Bot in beta on Aug 11, 2026, and it lands almost exactly on Khameleon's original wedge. It's the clearest sign yet that this problem space is real, and that it's no longer uncontested.

**What it is:** "AI teammates you can give real work to." Each bot runs on its own persistent cloud computer, signs into the apps and tools a person already uses, works across inboxes and software end-to-end, and only comes back when it needs approval. Interaction is chat-first — you message a bot like a colleague, not a workflow you configure.

**Where it overlaps with Khameleon almost exactly:**
- Core mechanic: operates inside existing apps rather than requiring migration to a new system — the same "adapt to the environment" premise this plan is built on.
- Learns by observation: a bot watches a task once, saves it as a routine, runs it unsupervised afterward, and incorporates corrections — this is Phase 3 ("adaptive detection") in the plan above, already shipped by a competitor.
- Chat-first, no workflow canvas — the same differentiation this plan aimed at Bardeen/Gumloop/Lindy.
- Multi-agent coordination: a "chief of staff" bot manages specialist bots (inbox, expenses, recruiting, bug fixes) that message each other and hand off work — conceptually the same as Khameleon's Agents-tab/multi-agent dashboard concept.

**Where Khameleon can still differentiate:**
- **Price and audience.** Grok Bot is bundled into $120–300/month premium tiers (SuperGrok Heavy, Cursor Ultra, Cursor Teams Premium) — built for power users and teams, not the $10–50/month individual self-serve tier this plan anchored on. An affordable, individual-first tier is real whitespace.
- **Model-agnostic.** Grok Bot is tied to xAI's models and increasingly the Cursor/dev-tooling ecosystem, with early use cases skewing sales/ops/engineering. Khameleon's swappable-engine design (Claude/GPT-4o, shown in the current mockup) is something Grok Bot doesn't offer.
- **Infrastructure gap to close.** Each Grok Bot gets a dedicated cloud computer — meaningful infra investment a solo build can't match at launch. Khameleon's v1 should stay honest about starting with API-first + browser/local computer-use fallback (Phase 1–2 above) rather than trying to match persistent per-bot cloud machines out of the gate.
- **Transparency.** Nothing in Grok Bot's launch materials shows per-query cost, latency, or energy telemetry. Khameleon's dashboard concept already does — a genuine, if minor, point of difference for users who care about what their automation is costing them.

**Practical implication for this plan:** the Phase 0 validation step matters more now, not less — confirm the narrow wedge (Phase 1) still has room and real willingness to pay at a lower price point before investing in Phase 2–3, since a well-capitalized incumbent has already reached the feature set this plan treats as the phase-3/4 payoff.

## Key risks to watch

UI automation breaks when apps change their interface — vision-based agents handle this better than brittle selector-based scripts, but it's still the main reliability risk and worth budgeting engineering time against, not just building once and assuming it holds. Trust is the other one: asking someone to hand an agent their live sessions/credentials for CRM, email, and internal tools is a real security and privacy conversation, not a UI detail — worth deciding early how credentials are stored/scoped and what the agent is and isn't allowed to do unsupervised. And competitively, Bardeen/Gumloop/Lindy already have distribution in "automate my apps" — the pitch has to be sharply about *adaptive, no-setup* automation, not "another workflow builder," or Khameleon competes on their turf instead of its own. As of August 2026, add Grok Bot (xAI/Cursor) to that list — see the competitive update above.

## Build log

Started against a gap analysis versus IRIS-AI (open-source JARVIS-style desktop agent). Each item below was scaffolded as its own standalone module, verified with a real build + real test run (not just written and assumed correct), and delivered as a zip in the outputs folder. Status mirrors the live task tracker for this project.

**Done:**

| # | Module | Deliverable | Verified | Real bug caught by tests |
|---|---|---|---|---|
| 6 | Window teleport + floating widgets | `khameleon-window-agent-v1.zip` | `tsc` clean, 18/18 tests passing (layout math, animation tween, full "open enlarged → move aside" scenario). Native `node-window-manager` dependency stubbed for sandbox typechecking only — real install/run needs macOS. | — |
| 7 | OS/file management layer | `khameleon-file-agent-v1.zip` | `tsc` clean, 27/27 tests passing against **real disk I/O** (temp directories, no mocks). Zero external dependencies, so fully verifiable without macOS. | Folder-name command was silently lowercasing user input ("Invoices" → "invoices") — fixed. |
| 10 | Local notes storage | folded into `khameleon-memory-v1.zip` | Covered by the memory module's note tests below. | — |
| 13 | Persistent memory system | `khameleon-memory-v1.zip` | `tsc` clean, 29/29 tests passing, including real JSON-file persistence round-tripped through disk (atomic writes, survives a simulated "restart"). Zero external dependencies. | "Remember my timezone is EST" and "what's my timezone" parsed to two different keys, so recall silently failed — fixed. |

**Not started:**

| # | Item | Notes |
|---|---|---|
| 8 | Terminal & dev tools control | Open question: is Khameleon's audience developers specifically, or knowledge workers broadly? Affects whether this is worth building. |
| 9 | Screen OCR / inline coding assist | Depends on #8 decision. |
| 11 | Research agent | Powers the "Research" tab already in the dashboard mockup. |
| 12 | Multi-agent orchestration | Powers the "Agents" tab already in the dashboard mockup. |

**Open decisions (not yet resolved):**

| # | Decision |
|---|---|
| 14 | Lifestyle utilities (Spotify, weather, maps, stock tickers) — in scope or not? |
| 15 | Mobile device control (remote Android) — in scope or not? |
| 16 | Local security vault (PIN/biometric) — priority now, or defer? |
| 17 | Demo/gimmick features (DOM "hacking," image gen, animated web builder) — in scope or not? |

**Pattern established across all modules so far:** platform-agnostic core logic (layout math, tweening, search ranking, path safety) kept pure and fully unit-tested; anything that touches the OS (Electron windows, `node-window-manager`, `child_process`) isolated behind a small interface so it can be swapped for a test double. Every module ships with a README stating exactly what was and wasn't verified, and why — most modules need no native dependencies and get full real-I/O verification in the sandbox; the one exception (window-agent) is flagged explicitly rather than silently assumed to work.
