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

## Putting a password on it (optional)

By default there's no login at all — anyone who reaches the URL gets full access. Fine on your own machine or a trusted local network; not fine the moment you expose this beyond that.

Set `KHAMELEON_APP_PASSWORD` in `.env` to put one shared password in front of the whole app. Restart (`docker compose up -d --build`) and you'll be asked for it before you can use anything. There's no per-person separation here — everyone who knows the password sees the same data, same connected accounts, same everything — this is a lock on the front door, not real multi-user accounts (see below for that).

## Multi-user accounts (optional)

If a few people are sharing one instance and need their own logins rather than one shared password, open **Security → Access Control** and use "Set up real accounts." The first account you create becomes the instance admin and the app switches over from the shared-password model above automatically — no env var, no restart.

What's actually separated per account: each person's own AI provider connections (OAuth logins, saved API keys) and their own Vault secrets — one person's saved key or secret is invisible to everyone else on the instance, confirmed by direct testing, not just by schema inspection. The admin can add further accounts and list/deactivate them from the same Security page (a "Team Accounts" panel) or the account menu in the top bar.

What's deliberately still shared across every account on the instance: the task/project workspace itself — this is a small-team tier (a few people on one paid instance), not separate-tenant hosting. If what you actually want is each person/org on their own fully separate instance with no login screen in common at all, that's just... running separate instances of this same self-hosted setup, one per person/org — not a feature to turn on here.

## Putting TLS in front of it (optional)

By default Khameleon talks plain HTTP on whatever port you expose — fine on your own machine or behind your own VPN, not fine for a real domain on the open internet.

1. Point your domain's DNS A record at this machine.
2. Copy the Caddy config: `cp Caddyfile.example Caddyfile`, and replace `your-domain.com` with your real domain.
3. Bring the stack up with the TLS override applied:
   ```
   docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build
   ```

Caddy gets and renews a real Let's Encrypt certificate automatically — no manual cert handling. The override also stops publishing Khameleon's own port directly (verified: a direct request to it is refused once this is applied) — only Caddy, on 80/443, can reach it from here on.

## Backing up your data

```
./backup-postgres.sh
```

Dumps the database to a timestamped, gzipped file in `./backups/` and keeps the most recent 14. Schedule it with cron for real automated backups, e.g. nightly at 3am:
```
0 3 * * * cd /path/to/KhameleonApp && ./backup-postgres.sh >> backup.log 2>&1
```

To restore one (this overwrites the current database — it'll ask you to confirm):
```
./restore-postgres.sh backups/khameleon-20261001-030000.sql.gz
```

## Updating

```
git pull
docker compose up -d --build
```

The schema is re-applied automatically on every start (idempotent — it's a no-op if nothing changed). There's no tested path yet for a schema change that would require real data migration rather than an additive `drizzle-kit push`; treat upgrades across a large version gap with normal database-backup caution.

## What this first pass does not cover

Read this before you consider Khameleon launch-ready — these are real, known gaps, not hypothetical edge cases. Each one was deliberately deferred, not missed; check `khameleon-decisions-log.md` (search the date noted) for the full reasoning behind each decision if you want it before deciding whether to accept the gap or close it first.

- **No fully-separate-tenant isolation on one instance.** Multi-user accounts (see above) separate each person's own provider connections/API keys/Vault secrets, but the task/project workspace stays common to everyone on the instance. If you need tenants with no data in common at all, that's separate instances (one per person/org), not an account setting on a shared one.
- **The encryption key lives in a plain environment variable** (`KHAMELEON_ENCRYPTION_KEY`), not a dedicated secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.). Everything it protects (API keys, OAuth tokens, Vault secrets) is genuinely encrypted — this gap is specifically about where that one key itself is stored.
- **No AI-provider spend/budget tracking.** Khameleon shows real cost and query-count data, and (for Anthropic/OpenAI) a real per-minute rate-limit snapshot in Settings → API Keys — but nothing warns you before you hit your actual monthly spending cap, because neither provider exposes that over API.
- **A Khameleon-operated managed/convenience tier** — someone else running the instance *for* you, rather than you running this Docker setup yourself — doesn't exist. This document only covers the self-hosted, single-tenant-per-install default; a managed convenience tier is a separate, larger product decision (pricing, support, who operates it) that hasn't been made.
