# Khameleon

A desktop assistant that works inside the tools an organisation already uses (Outlook, Teams, Excel, the browser and other apps) rather than becoming a new place data lives. Its own AI, **Khami**, runs on the user's computer; outside AIs (Microsoft 365 Copilot first, then Azure OpenAI and others) are optional and only used when the organisation allows them. Confidential work never leaves the computer.

- **Hosting it:** [SELF_HOSTING.md](SELF_HOSTING.md)
- **What's been built, and when:** [CHANGELOG.md](CHANGELOG.md)
- **Licences and legal checklist:** [docs/legal-compliance.md](docs/legal-compliance.md), [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)
- **Security review:** [docs/security-review-2026-10-20.md](docs/security-review-2026-10-20.md)
- **Testing Outlook with a real mailbox:** [docs/outlook-test-runbook.md](docs/outlook-test-runbook.md)
- **Product decisions:** [docs/build-review.md](docs/build-review.md), [docs/gap-review.md](docs/gap-review.md), [docs/khami-design.md](docs/khami-design.md)

## What's where

| Folder | What it is |
|---|---|
| `artifacts/khameleon-command` | The app's screens (React + Vite) - the Overlay layout and the Classic layout |
| `artifacts/api-server` | The Khameleon server (Express + Drizzle/Postgres): chat, Khami, skills, integrations, the desktop link |
| `apps/khameleon-shell` | The desktop app (Electron): overlay window, Capture, detection, typing saved logins, the Mac input helper (`native/mac`) |
| `khameleon-window-agent`, `khameleon-file-agent`, `khameleon-memory` | Tested desktop runners (windows, files, memory) used by the desktop app |
| `lib/db` | Database tables (the server also creates missing tables at start-up) |
| `lib/integrations` | Offline document reading (PDF text, on-device OCR) and the desktop app's local tools |
| `lib/api-spec`, `lib/api-zod`, `lib/api-client-react` | The API description and the code generated from it |

## Running it for development

Needs Node.js 24, pnpm and PostgreSQL.

```sh
pnpm install
# Server - reads .env (DATABASE_URL, KHAMELEON_ENCRYPTION_KEY, ...); listens on this computer only
cd artifacts/api-server && PORT=4001 pnpm run dev
# Screens
cd artifacts/khameleon-command && PORT=5173 BASE_PATH=/ VITE_API_URL=http://localhost:4001/api pnpm run dev
# Desktop app, using the development server above
cd apps/khameleon-shell && pnpm build && env -u ELECTRON_RUN_AS_NODE KHAMELEON_APP_URL=http://localhost:5173 npx electron .
```

**The all-in-one app** (what customers download): without `KHAMELEON_APP_URL`, the desktop app starts its **own** server inside itself (`apps/khameleon-shell/src/localServer.ts`) with a **built-in database** (PGlite - PostgreSQL running inside the app, no separate program, no network connection), keeping everything in Khameleon's own folder (`~/Library/Application Support/Khameleon` on a Mac, `%APPDATA%\Khameleon` on Windows). The encryption key is made on first run and locked by the computer's keychain; Settings → Security → Your data shows the recovery key. Try it in development with `cd apps/khameleon-shell && pnpm bundle && pnpm build && env -u ELECTRON_RUN_AS_NODE npx electron .`. New database tables: change `lib/db/src/schema`, then `pnpm --filter @workspace/db generate` (shared servers keep using `push`).

**Keep `KHAMELEON_ENCRYPTION_KEY` safe** (shared servers). Saved keys and logins are locked with it; if it changes or is lost they can't be read and must be entered again. When restarting the server, start the new build on a spare port first and only stop the old one once the new one answers `/api/healthz`.

## Checks

```sh
pnpm run typecheck                         # everything
cd artifacts/api-server && pnpm test       # server (needs DATABASE_URL)
cd artifacts/khameleon-command && npx vitest run
cd khameleon-window-agent && npx vitest run
cd lib/integrations && npx vitest run
pnpm run licenses:check                        # fails if a package's licence isn't allowed for commercial use
```

## Building the installers

```sh
pnpm run licenses                              # refresh THIRD_PARTY_LICENSES.md first
cd apps/khameleon-shell && pnpm package:mac   # builds the server + screens into it -> release/Khameleon-<version>-arm64.dmg
cd apps/khameleon-shell && pnpm package:win   # Windows (build on Windows or in CI)
```

Unsigned builds show a warning on first open; signing needs an Apple Developer account and a Windows code-signing certificate.

## Gotchas

- **`@workspace/db` throws when imported if `DATABASE_URL` isn't set** - even for tests that never query. Any valid-looking value works for database-free tests.
- **Rebuild the shared libraries' types** (`pnpm run typecheck:libs`) after changing `lib/db` or the API spec, or the app and server typechecks report missing exports.
- **The server is bundled by esbuild** - import its own modules statically; dynamic `import()` of server files breaks the bundle (see `artifacts/api-server/build.mjs`).
- **Microsoft Graph gives a message a new `id` every time it moves folders** - anything that moves then refers to a message (sort inbox, undo) must use the id from the move's response.
- **Launching Electron from a terminal where `ELECTRON_RUN_AS_NODE` is set** runs it as plain Node and it quits silently - unset it (`env -u ELECTRON_RUN_AS_NODE ...`).
