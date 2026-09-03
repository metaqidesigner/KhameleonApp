/**
 * Spotify playback control — a "lifestyle utility" (2026-08-27 decision:
 * lifestyle utilities are in scope for Khameleon; users at work may
 * reasonably want this alongside their work tools).
 *
 * All endpoints require a connected Spotify account (see /api/auth/oauth/spotify/start).
 * If not connected, every endpoint returns 409 with a clear "connect first" message
 * rather than a confusing downstream error.
 */

import { Router, type Request, type Response } from "express";
import { getFreshToken, isConnected } from "../lib/oauthTokens.js";

const router = Router();

// `Response` here refers to Express's Response type (imported above), which
// shadows the global fetch Response — alias it explicitly for spotifyFetch's
// return type so the two don't get confused.
type FetchResponse = globalThis.Response;

async function spotifyFetch(path: string, init: RequestInit = {}): Promise<FetchResponse> {
  const token = await getFreshToken("spotify");
  return fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  });
}

function requireConnected(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try {
      if (!(await isConnected("spotify"))) {
        res.status(409).json({ error: "Spotify is not connected. Connect it at /api/auth/oauth/spotify/start." });
        return;
      }
      await handler(req, res);
    } catch (err) {
      req.log.error({ err }, "Spotify route error");
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

// ── GET /now-playing ─────────────────────────────────────────────────────────
router.get("/now-playing", requireConnected(async (_req, res) => {
  const spRes = await spotifyFetch("/me/player/currently-playing");

  if (spRes.status === 204) {
    res.json({ playing: false });
    return;
  }
  if (!spRes.ok) {
    res.status(spRes.status).json({ error: `Spotify API error: ${spRes.status}` });
    return;
  }

  const json = await spRes.json() as {
    is_playing: boolean;
    progress_ms: number | null;
    item: {
      name: string;
      duration_ms: number;
      artists: { name: string }[];
      album: { name: string; images: { url: string }[] };
      external_urls: { spotify: string };
    } | null;
  };

  if (!json.item) {
    res.json({ playing: false });
    return;
  }

  res.json({
    playing:    json.is_playing,
    track:      json.item.name,
    artists:    json.item.artists.map((a) => a.name),
    album:      json.item.album.name,
    albumArt:   json.item.album.images[0]?.url ?? null,
    progressMs: json.progress_ms,
    durationMs: json.item.duration_ms,
    url:        json.item.external_urls.spotify,
  });
}));

// ── Playback controls ─────────────────────────────────────────────────────────
router.post("/play",     requireConnected(async (_req, res) => { await spotifyFetch("/me/player/play",  { method: "PUT" });  res.json({ ok: true }); }));
router.post("/pause",    requireConnected(async (_req, res) => { await spotifyFetch("/me/player/pause", { method: "PUT" });  res.json({ ok: true }); }));
router.post("/next",     requireConnected(async (_req, res) => { await spotifyFetch("/me/player/next",     { method: "POST" }); res.json({ ok: true }); }));
router.post("/previous", requireConnected(async (_req, res) => { await spotifyFetch("/me/player/previous", { method: "POST" }); res.json({ ok: true }); }));

export default router;
