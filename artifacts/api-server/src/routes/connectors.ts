import { Router } from "express";

const router = Router();

// Static list of known connectors — all offline until OAuth integrations are wired
const CONNECTORS = [
  { id: "gmail",        name: "Gmail",            connected: false },
  { id: "gcal",         name: "Google Calendar",  connected: false },
  { id: "gdrive",       name: "Google Drive",     connected: false },
  { id: "gcontacts",    name: "Google Contacts",  connected: false },
  { id: "notion",       name: "Notion",           connected: false },
  { id: "slack",        name: "Slack",            connected: false },
  { id: "obsidian",     name: "Obsidian",         connected: false },
  { id: "github",       name: "GitHub",           connected: false },
  { id: "spotify",      name: "Spotify",          connected: false },
  { id: "strava",       name: "Strava",           connected: false },
  { id: "oura",         name: "Oura",             connected: false },
  { id: "apple_health", name: "Apple Health",     connected: false },
  { id: "apple_notes",  name: "Apple Notes",      connected: false },
  { id: "hn",           name: "HackerNews",       connected: false },
  { id: "outlook",      name: "Outlook",          connected: false },
  { id: "weather",      name: "Weather",          connected: false },
  { id: "dropbox",      name: "Dropbox",          connected: false },
  { id: "ticktick",     name: "TickTick",         connected: false },
  { id: "whatsapp",     name: "WhatsApp",         connected: false },
  { id: "newsrss",      name: "News RSS",         connected: false },
  { id: "granola",      name: "Granola",          connected: false },
];

router.get("/", (_req, res) => {
  res.json(CONNECTORS);
});

export default router;
