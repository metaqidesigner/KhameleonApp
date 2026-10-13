/**
 * seed-skill-sets-data.ts — idempotent (insert-if-missing) seed data for
 * design-spec.md §15-17: the 6 illustrative Work Domains named in §17.1,
 * directory metadata for every connector already listed in
 * routes/connectors.ts's ALL_CONNECTORS, and the starter skills in
 * starterSkills.ts. Follows the same "idempotent, safe on every boot"
 * pattern as migrate-legacy-values.ts / ensure-settings-table.ts, run
 * once from index.ts's bootstrap() before the server accepts traffic.
 *
 * Directory metadata is written honestly, not aspirationally: only
 * Outlook (routes/outlookSkills.ts etc.), Spotify (routes/spotify.ts),
 * and Weather (routes/weather.ts, no auth) have real functionality
 * built on top of their connection today. Google's OAuth connects but
 * nothing calls the Gmail/Calendar/Drive/Contacts APIs yet. GitHub,
 * Slack, Notion, and Dropbox are checked by isConnected() but have no
 * /oauth/:provider/start route in auth.ts at all - they can never
 * actually become connected yet. Everything else has no OAuth mapping
 * whatsoever. This mirrors the "NOT AVAILABLE" honesty already applied
 * to communications.tsx's Channels panel - the same rule, applied here
 * at the data layer instead of a frontend label.
 */

import { db } from "@workspace/db";
import { workDomainsTable, integrationDirectoryTable, skillSetsTable, entityWorkDomainsTable } from "@workspace/db";
import { STARTER_SKILLS, missingStarters } from "./starterSkills";
import { eq } from "drizzle-orm";
import { logger } from "./lib/logger.js";

const DEFAULT_WORK_DOMAINS: { name: string; description: string }[] = [
  { name: "Business as Usual", description: "Recurring operational work — the day-to-day." },
  { name: "People", description: "Hiring, team management, one-on-ones, culture." },
  { name: "Governance", description: "Compliance, policy, risk, and oversight." },
  { name: "Change", description: "Projects that shift how things are done." },
  { name: "Administration", description: "Paperwork, scheduling, and upkeep." },
  { name: "Strategic", description: "Longer-horizon planning and direction-setting." },
];

interface DirectorySeed {
  id: string; name: string; dataScope: string; actionScope: string;
  reversible: boolean; providerId: string | null;
}

const NOT_YET_CONNECTABLE = "Not yet connectable — listed for future work, no OAuth flow exists yet.";

const DIRECTORY_SEED: DirectorySeed[] = [
  { id: "outlook", name: "Outlook", dataScope: "Read and search your Outlook inbox and threads.", actionScope: "Draft, summarize, triage, and send email — sending requires your confirmation.", reversible: false, providerId: "microsoft" },
  { id: "spotify", name: "Spotify", dataScope: "See what's currently playing.", actionScope: "Control playback: play, pause, skip, previous.", reversible: true, providerId: "spotify" },
  { id: "weather", name: "Weather", dataScope: "Current weather for your saved location.", actionScope: "None — read-only, no account needed.", reversible: true, providerId: null },
  { id: "gmail", name: "Gmail", dataScope: "OAuth connects via your Google account, but nothing reads or writes Gmail data yet.", actionScope: "Not yet built on top of the connection.", reversible: true, providerId: "google" },
  { id: "gcal", name: "Google Calendar", dataScope: "OAuth connects via your Google account, but nothing reads or writes calendar data yet.", actionScope: "Not yet built on top of the connection.", reversible: true, providerId: "google" },
  { id: "gdrive", name: "Google Drive", dataScope: "OAuth connects via your Google account, but nothing reads or writes Drive data yet.", actionScope: "Not yet built on top of the connection.", reversible: true, providerId: "google" },
  { id: "gcontacts", name: "Google Contacts", dataScope: "OAuth connects via your Google account, but nothing reads contacts yet.", actionScope: "Not yet built on top of the connection.", reversible: true, providerId: "google" },
  { id: "github", name: "GitHub", dataScope: NOT_YET_CONNECTABLE, actionScope: NOT_YET_CONNECTABLE, reversible: true, providerId: "github" },
  { id: "slack", name: "Slack", dataScope: NOT_YET_CONNECTABLE, actionScope: NOT_YET_CONNECTABLE, reversible: true, providerId: "slack" },
  { id: "notion", name: "Notion", dataScope: NOT_YET_CONNECTABLE, actionScope: NOT_YET_CONNECTABLE, reversible: true, providerId: "notion" },
  { id: "dropbox", name: "Dropbox", dataScope: NOT_YET_CONNECTABLE, actionScope: NOT_YET_CONNECTABLE, reversible: true, providerId: "dropbox" },
  { id: "obsidian", name: "Obsidian", dataScope: NOT_YET_CONNECTABLE, actionScope: NOT_YET_CONNECTABLE, reversible: true, providerId: null },
  { id: "strava", name: "Strava", dataScope: NOT_YET_CONNECTABLE, actionScope: NOT_YET_CONNECTABLE, reversible: true, providerId: null },
  { id: "oura", name: "Oura", dataScope: NOT_YET_CONNECTABLE, actionScope: NOT_YET_CONNECTABLE, reversible: true, providerId: null },
  { id: "apple_health", name: "Apple Health", dataScope: NOT_YET_CONNECTABLE, actionScope: NOT_YET_CONNECTABLE, reversible: true, providerId: null },
  { id: "apple_notes", name: "Apple Notes", dataScope: NOT_YET_CONNECTABLE, actionScope: NOT_YET_CONNECTABLE, reversible: true, providerId: null },
  { id: "hn", name: "HackerNews", dataScope: NOT_YET_CONNECTABLE, actionScope: NOT_YET_CONNECTABLE, reversible: true, providerId: null },
  { id: "ticktick", name: "TickTick", dataScope: NOT_YET_CONNECTABLE, actionScope: NOT_YET_CONNECTABLE, reversible: true, providerId: null },
  { id: "whatsapp", name: "WhatsApp", dataScope: NOT_YET_CONNECTABLE, actionScope: NOT_YET_CONNECTABLE, reversible: true, providerId: null },
  { id: "newsrss", name: "News RSS", dataScope: NOT_YET_CONNECTABLE, actionScope: NOT_YET_CONNECTABLE, reversible: true, providerId: null },
  { id: "granola", name: "Granola", dataScope: NOT_YET_CONNECTABLE, actionScope: NOT_YET_CONNECTABLE, reversible: true, providerId: null },
];

export async function seedSkillSetsData(): Promise<void> {
  const [domainCount] = await db.select().from(workDomainsTable).limit(1);
  if (!domainCount) {
    await db.insert(workDomainsTable).values(DEFAULT_WORK_DOMAINS.map((d) => ({ ...d, isBuiltIn: true })));
    logger.info({ count: DEFAULT_WORK_DOMAINS.length }, "Seeded default Work Domains");
  }

  const [directoryCount] = await db.select().from(integrationDirectoryTable).limit(1);
  if (!directoryCount) {
    await db.insert(integrationDirectoryTable).values(DIRECTORY_SEED);
    logger.info({ count: DIRECTORY_SEED.length }, "Seeded Integrations directory");
  }

  // Add any starter skill missing by name - not only on an empty table -
  // so existing installs pick up new starters (starterSkills.ts). A starter
  // the user uninstalled still has its row, so it is never re-added.
  const existing = await db.select({ name: skillSetsTable.name }).from(skillSetsTable);
  const toAdd = missingStarters(existing.map((r) => r.name), STARTER_SKILLS);
  if (toAdd.length) {
    await db.insert(skillSetsTable).values(
      toAdd.map((s) => ({
        name: s.name, description: s.description, content: s.content,
        sourceType: "authored", requestedTools: [], requestedIntegrationIds: [],
        status: "available" as const,
      })),
    );
    logger.info({ count: toAdd.length }, "Added starter skills");
  }

  // Give untouched starters (still "available", no domain yet) their
  // domain, so they land in the right group in the Skills panel. Starters
  // the user has installed or re-tagged are left alone.
  const [starterRows, domains, tagged] = await Promise.all([
    db.select({ id: skillSetsTable.id, name: skillSetsTable.name, status: skillSetsTable.status }).from(skillSetsTable),
    db.select({ id: workDomainsTable.id, name: workDomainsTable.name }).from(workDomainsTable),
    db.select({ entityId: entityWorkDomainsTable.entityId }).from(entityWorkDomainsTable)
      .where(eq(entityWorkDomainsTable.entityType, "skill_set")),
  ]);
  const taggedIds = new Set(tagged.map((t) => t.entityId));
  const domainId = new Map(domains.map((d) => [d.name, d.id]));
  const starterDomain = new Map(STARTER_SKILLS.map((s) => [s.name, s.domain]));
  const tags = starterRows.flatMap((row) => {
    if (row.status !== "available" || taggedIds.has(String(row.id))) return [];
    const id = domainId.get(starterDomain.get(row.name) ?? "");
    return id ? [{ entityType: "skill_set", entityId: String(row.id), workDomainId: id }] : [];
  });
  if (tags.length) {
    await db.insert(entityWorkDomainsTable).values(tags);
    logger.info({ count: tags.length }, "Tagged starter skills with their domains");
  }
}
