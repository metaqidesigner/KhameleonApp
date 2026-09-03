import { Router } from "express";
import { isConnected } from "../lib/oauthTokens.js";

const router = Router();

/**
 * Provider map: connector id → which OAuth provider token covers it.
 * Multiple connectors can share one provider row (Gmail + GCal both use "google").
 */
const PROVIDER_MAP: Record<string, string> = {
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
const NO_AUTH_CONNECTORS = new Set(["weather"]);

const ALL_CONNECTORS: { id: string; name: string }[] = [
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

router.get("/", async (req, res) => {
  try {
    // Batch-check which providers have live tokens (deduplicated)
    const providerIds = [...new Set(Object.values(PROVIDER_MAP))];
    const statusMap: Record<string, boolean> = {};
    await Promise.all(
      providerIds.map(async (p) => {
        statusMap[p] = await isConnected(p);
      })
    );

    const connectors = ALL_CONNECTORS.map((c) => {
      if (NO_AUTH_CONNECTORS.has(c.id)) return { ...c, connected: true };
      const provider = PROVIDER_MAP[c.id];
      return {
        ...c,
        connected: provider ? (statusMap[provider] ?? false) : false,
      };
    });

    res.json(connectors);
  } catch (err) {
    req.log.error({ err }, "Error fetching connectors");
    // Fall back to all-offline (except no-auth connectors, which never depend on token state)
    res.json(ALL_CONNECTORS.map((c) => ({ ...c, connected: NO_AUTH_CONNECTORS.has(c.id) })));
  }
});

export default router;
