# Self-hosting Khameleon

This is the default deployment mode ([`KHAMELEON_SPEC.md`](KHAMELEON_SPEC.md) §3, decided 2026-09-08): one instance per user or org, running on infrastructure you control — no shared backend, nothing routed through a Khameleon-operated server. Isolation comes from not sharing infrastructure at all, not from an account system.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose (bundled with Docker Desktop; on Linux, install the `docker-compose-plugin` package separately if needed).

## Setup

1. Copy the example env file and fill in the two required values:
   ```
   cp .env.example .env
   ```
   Open `.env` and set:
   - `KHAMELEON_ENCRYPTION_KEY` — generate one with `openssl rand -base64 32`. This encrypts every API key, OAuth token, and Vault secret you save — there's no default, and the app refuses to save credentials without it (fails closed, not silently to plaintext).
   - `POSTGRES_PASSWORD` — any real password. It never leaves the Docker network Compose creates for you.

2. Start it:
   ```
   docker compose up -d
   ```
   First start builds the image (a couple of minutes), then brings up Postgres, waits for it to be healthy, applies the database schema automatically, and starts the app.

3. Open **http://localhost:4001** (or whatever `KHAMELEON_PORT` you set).

## What happens on first run

You'll land on the real first-run onboarding wizard — the same one this app always ships with, not something specific to self-hosting. Set your display name, and connect your own AI provider access (an Anthropic/OpenAI/Google/OpenRouter/Minimax API key, or whatever your organisation has provisioned) — per [design-spec.md §18](khameleon-design-spec.md), Khameleon never holds or proxies a shared key on your behalf.

## Data persistence

Your data lives in a Docker named volume (`khameleon_pgdata`), not inside the container — `docker compose down` and `docker compose up -d` again picks up right where you left off. `docker compose down -v` deletes the volume and all data with it; only do this deliberately.

## Updating

```
git pull
docker compose up -d --build
```

The schema is re-applied automatically on every start (idempotent — it's a no-op if nothing changed). There's no tested path yet for a schema change that would require real data migration rather than an additive `drizzle-kit push`; treat upgrades across a large version gap with normal database-backup caution.

## What this first pass does not cover

- No TLS/reverse-proxy guidance — put this behind your own reverse proxy (Caddy, nginx, Cloudflare Tunnel, etc.) if exposing it beyond your local network.
- No automated backup story for the Postgres volume — back it up the way you'd back up any Postgres database (`pg_dump`, or snapshot the volume).
- The hosted/managed deployment mode described in `KHAMELEON_SPEC.md` — for orgs that want a managed instance instead of running their own — doesn't exist yet; this document is for the self-hosted, single-tenant default only.
