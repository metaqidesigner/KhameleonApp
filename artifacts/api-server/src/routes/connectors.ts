import { Router } from "express";
import { isConnected } from "../lib/oauthTokens.js";

const router = Router();

/**
 * Provider map: connector id → which OAuth provider token covers it.
 * Multiple connectors can share one provider row (Gmail + GCal both use "google").
 */
export const PROVIDER_MAP: Record<string, string> = {
  gmail:     "google",
  gcal:      "google",
  gdrive:    "google",
  gcontacts: "google",
  github:    "github",
  slack:     "slack",
  notion:    "notion",
  dropbox:   "dropbox",
  outlook:   "microsoft",
  spotify:   "spotify",
};

/**
 * Connectors that need no OAuth/API key at all — they just work.
 * Weather (Open-Meteo) is the first of these: added 2026-08-27 when
 * lifestyle utilities were brought into scope.
 */
export const NO_AUTH_CONNECTORS = new Set(["weather"]);

export const ALL_CONNECTORS: { id: string; name: string }[] = [
  { id: "gmail",        name: "Gmail" },
  { id: "gcal",         name: "Google Calendar" },
  { id: "gdrive",       name: "Google Drive" },
  { id: "gcontacts",    name: "Google Contacts" },
  { id: "notion",       name: "Notion" },
  { id: "slack",        name: "Slack" },
  { id: "obsidian",     name: "Obsidian" },
  { id: "github",       name: "GitHub" },
  { id: "spotify",      name: "Spotify" },
  { id: "strava",       name: "Strava" },
  { id: "oura",         name: "Oura" },
  { id: "apple_health", name: "Apple Health" },
  { id: "apple_notes",  name: "Apple Notes" },
  { id: "hn",           name: "HackerNews" },
  { id: "outlook",      name: "Outlook" },
  { id: "weather",      name: "Weather" },
  { id: "dropbox",      name: "Dropbox" },
  { id: "ticktick",     name: "TickTick" },
  { id: "whatsapp",     name: "WhatsApp" },
  { id: "newsrss",      name: "News RSS" },
  { id: "granola",      name: "Granola" },
];

/**
 * Real connected/not-connected status per connector id, checked against
 * live OAuth tokens (or NO_AUTH_CONNECTORS for ones that need none).
 * Exported so routes/integrations.ts can join this against directory
 * metadata without re-deriving connection status itself — one source
 * of truth for "is this connected" (the oauth_tokens table), not two.
 */
export async function getConnectorStatusMap(): Promise<Record<string, boolean>> {
  const providerIds = [...new Set(Object.values(PROVIDER_MAP))];
  const statusMap: Record<string, boolean> = {};
  await Promise.all(
    providerIds.map(async (p) => {
      statusMap[p] = await isConnected(p);
    })
  );
  const result: Record<string, boolean> = {};
  for (const c of ALL_CONNECTORS) {
    if (NO_AUTH_CONNECTORS.has(c.id)) { result[c.id] = true; continue; }
    const provider = PROVIDER_MAP[c.id];
    result[c.id] = provider ? (statusMap[provider] ?? false) : false;
  }
  return result;
}

router.get("/", async (req, res) => {
  try {
    const statusMap = await getConnectorStatusMap();
    res.json(ALL_CONNECTORS.map((c) => ({ ...c, connected: statusMap[c.id] ?? false })));
  } catch (err) {
    req.log.error({ err }, "Error fetching connectors");
    // Fall back to all-offline (except no-auth connectors, which never depend on token state)
    res.json(ALL_CONNECTORS.map((c) => ({ ...c, connected: NO_AUTH_CONNECTORS.has(c.id) })));
  }
});

export default router;
