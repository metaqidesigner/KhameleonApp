# Khameleon

An ambient, HUD-style AI assistant that orchestrates the tools an organization already uses (Outlook, Spotify, weather, and more) rather than becoming a new place data lives — see khameleon-design-spec.md for the full spec.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required for the Outlook skills (§12 of the design spec) and any Anthropic-backed pipeline step: `ANTHROPIC_API_KEY` (or set one in-app via Settings → API Keys), `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`, `KHAMELEON_ENCRYPTION_KEY` (16+ chars — credentials fail closed without it, see the 2026-08-27 decisions-log entry)

### Verifying the three Outlook skills against a real mailbox

Built 2026-09-03, never run end-to-end — this sandbox has no live network or a Microsoft app registration. Do this once real credentials exist:

1. Register an app at [entra.microsoft.com](https://entra.microsoft.com) (App registrations), add a web redirect URI matching this deployment's `/api/auth/oauth/microsoft/callback`, and grant delegated `Mail.ReadWrite` + `Mail.Send` + `User.Read`. Set `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET` from it.
2. Visit `/api/auth/oauth/microsoft/start`, sign in, confirm `GET /api/connectors` now shows `outlook: connected: true`.
3. Get a real message id: `GET https://graph.microsoft.com/v1.0/me/messages?$top=1` in [Graph Explorer](https://developer.microsoft.com/graph/graph-explorer) (signed in as the same account) — copy its `id`.
4. On the Approvals page, run each skill against that id / the connected inbox in this order:
   - **outlook-summarize-thread** first — pure read, safest, confirms the Graph connection and thread-fetch logic work before anything writes.
   - **outlook-draft-email** next — confirms it creates a real (unsent) draft; check it actually appears in Drafts before ever clicking Confirm & Send in ConfirmGate.
   - **outlook-triage-inbox** last, and only against a mailbox you don't mind being reorganized — it flags/categorizes/archives every real unread message. Test the Undo button immediately after and confirm messages actually reappear in Inbox with prior categories/flags restored.
5. Watch specifically for the id-reassignment behavior `moveMessage` depends on (see Gotchas) — it's documented from Graph's own reference docs, not observed firsthand.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **Project-reference build order.** Raw `tsc --noEmit` in `artifacts/khameleon-command` or `artifacts/api-server` throws TS6305 on every file importing `@workspace/db`/`@workspace/api-zod`/`@workspace/api-client-react` unless those packages are built first: `(cd lib/db && tsc -p tsconfig.json) && (cd lib/api-zod && tsc -p tsconfig.json) && (cd lib/api-client-react && tsc -p tsconfig.json)`. Pre-existing condition, not specific to any one change.
- **`@workspace/db` throws at import time, not query time**, if `DATABASE_URL` isn't set — so even a pure-logic unit test fails at import if the file it's testing (even transitively) imports `@workspace/db`. Set any syntactically-valid dummy value (e.g. `DATABASE_URL=postgres://user:pass@localhost:5432/dummy`) to satisfy the check when running DB-free tests without a live Postgres — `pg.Pool` itself doesn't eagerly connect, only an actual query does.
- **Microsoft Graph reassigns a message's `id` on every folder move.** `outlookGraph.ts`'s `moveMessage` (used by `outlook-triage-inbox` to archive, and by its undo path to restore) returns the *new* message object — every subsequent reference to that message, including undo, must use the id from that response, not the id that existed before the move. Confirmed from Graph's own API reference; not yet observed against a real mailbox (see the Verification section above).
- **`pnpm dev`/`pnpm typecheck` inside a single package can trigger pnpm's own `pnpm install` gate** (`[ERR_PNPM_IGNORED_BUILDS]`, asking to run `pnpm approve-builds` for `electron`/`node-window-manager`/etc.) if new native-dependent workspace packages were added since the last full install. Bypass for one-off checks by calling the local binary directly — `node_modules/.bin/tsc`, `node_modules/.bin/vite`, `node_modules/.bin/tsx` — from inside the package directory, which skips pnpm's own preflight.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
