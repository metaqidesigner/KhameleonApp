# Khameleon — Product Spec / PRD

**Purpose of this document:** a living product/strategy spec — what Khameleon is, who it's for, and why — kept separate from the two documents that already track *implementation*: [`khameleon-design-spec.md`](khameleon-design-spec.md) (detailed UX/behavior spec, §1–18) and [`khameleon-decisions-log.md`](khameleon-decisions-log.md) (dated build/decision journal). This file is where product-level ideas from planning conversations get filed so they don't stay informal notes — it doesn't replace or duplicate those two, it sits above them. When something here implies a build, the actual work still gets tracked in the decisions log.

---

## 1. Product Overview

Khameleon (formerly "JARVIS" during early prototyping) is a personal multi-agent AI command centre — a single place a person routes their work across whichever AI models and agents they have access to, rather than living inside one vendor's chat window.

It's built for people (and, longer-term, organisations) who already have access to more than one AI system — a personal Claude or ChatGPT account, an employer-provisioned Copilot or Gemini seat — and want one coherent place to direct that work, see it through to a finished result, and trust what came back.

**Origin:** Khameleon began as an Iron Man 2–inspired prototype — a React/TypeScript/Vite front end with multi-AI routing and ElevenLabs voice output, aiming for a HUD-like command-centre feel rather than a chat window. That visual and interaction language (voice I/O, glass-panel "Signal Glass" UI, an ambient status orb) carried through into the current build. The originally-described backend approach (FastAPI + LiteLLM) did not carry through, however — see §3 for what's actually running today, and the Changelog for when that diverged.

## 2. Positioning & Competitive Strategy

**Not competing head-on with single-vendor agents on raw model capability.** OpenAI, Google, and others are shipping increasingly autonomous, increasingly capable agents (e.g. OpenAI's more autonomous "Ultra Mode"–style offerings) at a pace Khameleon cannot out-race by building a better model. That isn't the game being played.

**The target customer is the multi-vendor organisation** — companies (and individuals) stuck with a mixed environment: Claude for some things, Copilot because IT issued it, Gemini because of a Workspace bundle. These users don't want to bet everything on one lab's roadmap, pricing, or outages. Khameleon's value is being the layer that sits *across* whatever a user already has, not a vertically-integrated model competing for the same seat.

**Users pick the right tool per task, not per session.** Khameleon orchestrates and routes across a user's already-connected agents based on which is best suited for a given piece of work — it is the router, not another destination model.

**"Runs on your own instance" is a real differentiator, not just infrastructure.** The default deployment model (§3) means an org's data and connected-provider credentials never sit in a Khameleon-operated database at all — a sharper, more concrete trust claim than most SaaS competitors can make, and one worth putting in front of the same IT/security reviewer §2's IT-trust pitch is aimed at.

*Related existing analysis:* [`Khameleon_v1_Scope.md`](Khameleon_v1_Scope.md)'s "Competitive landscape" section covers a different, adjacent angle — workflow-automation competitors (Bardeen, Gumloop, Lindy, Grok Bot) rather than foundation-model vendors. Both are real competitive fronts; this section is the foundation-model-vendor angle specifically.

## 3. Architecture

**What's actually built and running** (see `khameleon-decisions-log.md` for the full build history):

- **Frontend:** `artifacts/khameleon-command` — React 19 + TypeScript + Vite 7, Tailwind v4, a custom "Signal Glass" HUD design system (glass panels, an ambient status orb, floating/dockable windows) carrying forward the original Iron Man–inspired visual language. Zustand for client state. As of 2026-09-25, the Assistant tab specifically runs a second, distinct layout — "Live Wall" (`khameleon-design-spec.md` §7.5) — a fixed three-panel layout with an overlaid always-on-top orb window, ported from a Replit design exploration and wired to real data; the Workspace tab still runs the original floating-window canvas model.
- **Backend:** `artifacts/api-server` — **Express 5** (Node), not FastAPI. PostgreSQL via Drizzle ORM (`lib/db`). Zod-validated request bodies, an Orval-generated API client/type layer (`lib/api-zod`).
- **Multi-model orchestration:** `agents/gateway.ts` resolves and calls providers **directly via their own SDKs** (the Anthropic SDK; the OpenAI SDK, pointed at OpenAI-compatible base URLs for Google Gemini, OpenRouter, and local Ollama models) — **not via LiteLLM.** Supported providers today: Anthropic (Claude), OpenAI (GPT), Google (Gemini), OpenRouter, Ollama (local), Minimax.
- **Multi-agent modes:** a real Roster/Compare/Council system exists for running the same request across multiple connected agents and comparing or voting on results — this is the shipped version of the "parallel/vote/council agent modes" concept.
- **Voice:** ElevenLabs integration (`routes/voice.ts`) for voice output; a real wake-word/voice-input path exists client-side.
- **Desktop control:** `apps/khameleon-shell` — a minimal real Electron app (a small always-on-top control panel) giving a local agent window/file/memory control on macOS. Not the primary interface — the browser SPA is.
- **Provider access model:** design-spec §18 — each user connects their own provider access rather than Khameleon holding a shared key. Partially built: a user can save their own Anthropic/OpenAI/Google/OpenRouter/Minimax key, encrypted at rest, and (as of 2026-09-06) every core AI call site actually resolves that saved key first before falling back to a server-level one. True per-account isolation is deliberately deferred to the hosted deployment mode below, not the default one.
- **Deployment model — decided 2026-09-08, hybrid.** Two distinct modes, not one architecture pretending to be both:
  - **Default: single-tenant per install.** Matches the original 2026-08-07 native-app decision — each user/org runs their own separate instance (own Postgres, own api-server), isolated because nothing is shared, not because of row-level permissions. This is also the trust story: consistent with §2's "nothing new to trust with your data," and the reason Composio was rejected in 2026-08-12 (a managed-auth platform that would have put user credentials in *someone else's* cloud — the same shape problem a shared multi-tenant backend would create). **Packaged for real self-hosting as of 2026-09-10** — see [`SELF_HOSTING.md`](SELF_HOSTING.md): `docker compose up -d` after setting one required secret, verified live end to end (build, schema push, a real mutation surviving a full restart) via a real headless Docker runtime.
  - **Opt-in: hosted/managed mode**, for orgs that explicitly want convenience over the per-install trust guarantee. This is the actual home for real accounts, login, and per-account data isolation — §11.4's org-approved trust tier and §18's full "per-user isolated storage" both belong here specifically, not to the default mode. Not yet started.

**Note on the FastAPI/LiteLLM origin story:** an early prototype was described (and possibly built, outside this repo) around FastAPI + LiteLLM. No trace of either exists in the current codebase — confirmed by search, 2026-09-08. Treat that as historical framing for *why* Khameleon has always been multi-model, not as a description of what ships today.

## 4. Core Principles

- **Deliver one finished, verified piece of work — not a menu of drafts.** Khameleon's job is to produce a result the user approves or corrects, not a set of options for the user to pick between. "Show me three drafts and you choose" is the failure mode this explicitly avoids.
- **No extraction, no shadow copy.** Khameleon does not pull a client's or company's data out of the systems it lives in (e.g. a client's property management database) into a Khameleon-owned store. Only the minimal context needed for a given task is routed through model endpoints — and, where available, through zero-data-retention endpoints specifically — as a trust differentiator, not a footnote. (This is the same principle already codified in `khameleon-design-spec.md` §2; restated here because it's also a *commercial* differentiator, not just an architecture rule.)
- **Fit into existing workflows, don't demand new ones.** An organisation shouldn't have to redesign how it works before Khameleon is useful inside it.

## 5. Features

**Shipped** (see `khameleon-decisions-log.md` for build/verification detail on each):
- Core command orchestrator (`/api/command`) with real multi-step and single-shot (`simple`) execution paths
- Real Tasks/Projects, Calendar, Inbox, Analytics, Communications — backed by real Postgres, not mock data
- Three named Outlook skills: draft-email, summarize-thread, triage-inbox (real Microsoft Graph calls, hybrid pipeline+instructional design)
- Skill Sets, Integrations, and Work Domains (design-spec §15–17), including confirm-gated install flows and a real per-item Skill Set access audit trail
- Contextual Skill Set surfacing (§15.2) — a real Claude-judged "this looks like a match" suggestion on new tasks
- Multi-Agent Roster, Compare, and Council modes across Claude/GPT/Gemini/OpenRouter/Ollama/Minimax
- A real encrypted Vault for user-stored secrets, with reveal/audit logging
- Real onboarding flow, real first-run wizard, real per-provider API key storage (encrypted)
- Voice output (ElevenLabs) and voice input/wake-word
- A minimal real Electron desktop-control shell (window/file/memory tools) — separate from the main web app
- Real local Postgres dev environment, schema, and end-to-end verification pipeline
- Real self-hosting via Docker Compose (`Dockerfile`, `docker-compose.yml`, `SELF_HOSTING.md`) for the default single-tenant deployment mode

**In Progress / Recently Landed:**
- Provider Access Model (§18) — the single-user-scoped fix (every AI call site uses the user's own saved key) shipped 2026-09-06
- Deployment model decided (hybrid, 2026-09-08) and the default mode packaged for self-hosting (2026-09-10) — see Architecture. The hosted/managed mode has not been started.

**Planned:**
- **Mobile Morning Briefing** — see full description below
- Hosted/managed deployment mode — real accounts, login, per-account data isolation. The actual home for §11.4's org-approved trust tier and §18's full per-account credential isolation.
- §13.1 web-app windows (embedding Gmail/Slack/etc. live inside Khameleon) — blocked on a decision to ship a fuller Electron build
- §13.2 full agent browser automation (clicks, logins, JS-rendered pages) — today's web-reading tool only handles static/server-rendered pages
- Live-parsing an imported OpenAPI/MCP spec into real callable tools

**Idea (not yet scoped):**
- Demo/gimmick feature policy — never explicitly ruled on; the product's tone leans toward "no," but nothing's decided
- Mobile device control (beyond the Morning Briefing) — flagged as in-scope back in August, no architecture exists

### Mobile Morning Briefing (Planned — detailed spec)

An audio-predominant, minimal-visual experience for use on a commute (car or public transport):

- **Tiered delivery**, not a flat list: (1) urgent items genuinely needing the user's input, (2) FYI / already-handled items, (3) heads-up items brewing but not yet actionable.
- **Proactive, not just informational** — Khameleon offers drafted solutions rather than only surfacing what's outstanding: *"I've drafted replies to your 3 urgent emails, want to hear them?"* Approvable entirely by voice: "send it," "change the tone," "skip."
- **Continuity is a hard requirement, not a nice-to-have.** When the user arrives at their desk, Khameleon must resume exactly where the voice conversation left off — same thread, same context, continuing on-screen rather than restarting. This is what makes mobile and desktop feel like one product instead of two bolted together, and should be treated as a launch blocker for this feature, not a follow-up polish item.

## 6. Data & Security

- No extraction/shadow-copy of third-party system data (see Core Principles) — minimal necessary context only, routed through zero-data-retention endpoints where available.
- Credentials (API keys, OAuth tokens, Vault secrets) are encrypted at rest (AES-256-GCM) — real, shipped, not aspirational.
- Permissions inherit from the underlying connected system — Khameleon never becomes a way to see more than a user's existing access already allows (`khameleon-design-spec.md` §2).
- Task history logs actions and outcomes, not raw content duplicates — the underlying system of record remains authoritative.
- **Not yet solved:** the encryption key itself lives in a server-level env var, not a real secrets manager (HSM / HashiCorp Vault / AWS Secrets Manager) — flagged as future work since 2026-08-27, unchanged.
- **Not yet solved:** no real per-account data isolation exists yet — by design, deferred to the hosted deployment mode (§3), not needed for the single-tenant default.

## 7. Adoption & UX Strategy

Most enterprise AI fails at adoption, not capability — this section is about closing that gap deliberately, not assuming a good model wins on its own.

- **Role-aware onboarding.** No blank prompt box on first use — Khameleon should already suggest relevant actions based on the user's role, so the first five minutes demonstrate value instead of demanding the user figure out what to ask.
- **"Show your reasoning" toggle.** Default view is the finished output; the user can expand to see what was pulled from where and which model did what. Trust is built by making the working visible on demand, not by forcing the user to watch it happen every time.
- **Visible zero-data-retention indicator on outputs.** Needs to be a UI-visible signal for IT/employee trust, not only a backend guarantee nobody can see.
- **Simple before/after metrics** (time saved, tasks completed/caught) so a manager can see ROI and justify continued use without having to take it on faith.

## 8. Open Questions

- **Hosted mode scope and pricing** — since §18 already rules out Khameleon metering/billing *model calls* (those are always the user's own provider account), a hosted convenience tier still needs its own answer for what Khameleon itself charges for (hosting, support, admin console?) — not addressed yet.
- **§13.1 Electron decision** — ship a fuller Electron build (to support embedding live web-app sessions) or stay a browser SPA? `apps/khameleon-shell` gives a real head start either way, but the call hasn't been made. Related to, but distinct from, the deployment-mode decision above — an Electron wrap could serve either mode.
- **Demo/gimmick feature policy** — never explicitly ruled on.
- **Mobile Morning Briefing platform/delivery mechanism** — not yet decided (native app vs. PWA vs. something else); the continuity requirement with desktop may itself constrain this choice.
- **AI-provider ToS review** — whether rebranding/reselling access via others' APIs is compliant with their usage policies, before any commercial claim is made. Not yet done.
- **Live Wall vs. Signal Glass reconciliation** — the Assistant tab's new Live Wall layout (`khameleon-design-spec.md` §7.5) uses its own glass-panel recipe, not the locked Signal Glass material (§3), kept faithful to its Replit source on explicit request. Not yet decided whether to re-skin it into Signal Glass or treat it as an intentional second material scoped to that one surface.

## 9. Changelog

- **2026-09-08** — Created this spec document. Recorded Product Overview, Positioning & Competitive Strategy, Core Principles, Adoption & UX Strategy, and the Mobile Morning Briefing feature spec from planning conversation. Corrected the Architecture section to describe the actual shipped stack (Express, direct provider SDKs) rather than the originally-described FastAPI/LiteLLM approach, which has no trace in the current codebase — flagged as historical/origin context, not current fact.
- **2026-09-08** — Decided the deployment-model shape that three separate features (§11.4, §18, the original 2026-08-07 note) had each been bumping into without it ever being pinned down: hybrid, single-tenant-per-install by default, hosted/managed mode opt-in and separate. Moved this from Open Questions into Architecture and Positioning; replaced the old vague "multi-tenant foundation" Planned item with the two concrete pieces of work it actually splits into (self-host packaging; a real hosted mode). Full reasoning in `khameleon-decisions-log.md`, 2026-09-08.
- **2026-09-10** — Packaged the default single-tenant deployment mode for real self-hosting via Docker Compose, closing the "self-host packaging mechanism" Open Question. Verified live end to end using a real headless Docker runtime (`colima`, installed for this) — build, schema push against a fresh database, a real mutation through the running container, and restart-persistence all confirmed, not assumed. Full build/debugging detail (including two real fixes to the lockfile/workspace config, not just Docker files) in `khameleon-decisions-log.md`, 2026-09-09/10.
- **2026-09-25** — Ported the Replit "CommandWall" design exploration into the real app as a new Live Wall layout for the Assistant tab, wired to real task/health/chat data throughout. Added the "researching" orb state (used when a research-role agent handles a request) to the orb-states table in `khameleon-design-spec.md` §4, and documented the new layout as §7.5 there, including a flagged, unresolved divergence from the locked Signal Glass material — see the new Open Question above. Full build/verification detail in `khameleon-decisions-log.md`, 2026-09-25.
