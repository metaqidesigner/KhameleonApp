/**
 * Weather — a "lifestyle utility" (2026-08-27 decision: lifestyle utilities
 * are in scope for Khameleon).
 *
 * Deliberately uses Open-Meteo (https://open-meteo.com), which needs no API
 * key and no OAuth — unlike Spotify, there's no connector to "connect" here,
 * it just works as soon as a location is known. `isConnected`-style gating
 * doesn't apply; the only thing that can be missing is a location.
 */

import { Router, type Request, type Response } from "express";
import { db, settingsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router = Router();

const KEY_LAT   = "weather.defaultLat";
const KEY_LON   = "weather.defaultLon";
const KEY_LABEL = "weather.defaultLabel";

// WMO weather interpretation codes (Open-Meteo uses this standard set).
const WMO_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Depositing rime fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
  80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
  95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
};

export function describeCode(code: number): string {
  return WMO_DESCRIPTIONS[code] ?? `Unknown conditions (code ${code})`;
}

export function parseCoord(raw: unknown, min: number, max: number): number | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

async function loadDefaultLocation(): Promise<{ lat: number; lon: number; label: string | null } | null> {
  const rows = await db.select().from(settingsTable).where(inArray(settingsTable.key, [KEY_LAT, KEY_LON, KEY_LABEL]));
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  if (map[KEY_LAT] === undefined || map[KEY_LON] === undefined) return null;
  return { lat: Number(map[KEY_LAT]), lon: Number(map[KEY_LON]), label: map[KEY_LABEL] ?? null };
}

// ── GET /api/weather — current conditions ─────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  try {
    let lat = parseCoord(req.query.lat, -90, 90);
    let lon = parseCoord(req.query.lon, -180, 180);
    let label: string | null = null;

    if (lat === null || lon === null) {
      const saved = await loadDefaultLocation();
      if (!saved) {
        res.status(400).json({
          error: "No location provided and no default location saved. Pass ?lat=&lon= or set one via PUT /api/weather/default.",
        });
        return;
      }
      lat = saved.lat; lon = saved.lon; label = saved.label;
    }

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("current", "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m");
    url.searchParams.set("temperature_unit", "celsius");
    url.searchParams.set("wind_speed_unit", "kmh");

    const upstream = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!upstream.ok) {
      res.status(502).json({ error: `Weather provider error: ${upstream.status}` });
      return;
    }

    const json = await upstream.json() as {
      current: {
        time: string;
        temperature_2m: number;
        apparent_temperature: number;
        relative_humidity_2m: number;
        precipitation: number;
        weather_code: number;
        wind_speed_10m: number;
      };
    };

    res.json({
      label,
      lat, lon,
      observedAt:    json.current.time,
      temperatureC:  json.current.temperature_2m,
      feelsLikeC:    json.current.apparent_temperature,
      humidityPct:   json.current.relative_humidity_2m,
      precipitationMm: json.current.precipitation,
      windSpeedKmh:  json.current.wind_speed_10m,
      conditions:    describeCode(json.current.weather_code),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching weather");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/weather/default ───────────────────────────────────────────────────
router.get("/default", async (req: Request, res: Response) => {
  try {
    const saved = await loadDefaultLocation();
    res.json(saved ?? { lat: null, lon: null, label: null });
  } catch (err) {
    req.log.error({ err }, "Error reading default weather location");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/weather/default — save a default location ────────────────────────
router.put("/default", async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const lat = parseCoord(String(body.lat ?? ""), -90, 90);
    const lon = parseCoord(String(body.lon ?? ""), -180, 180);
    if (lat === null || lon === null) {
      res.status(400).json({ error: "`lat` (-90..90) and `lon` (-180..180) are required numbers." });
      return;
    }
    const label = typeof body.label === "string" ? body.label.slice(0, 120) : null;

    await db.transaction(async (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => {
      for (const [key, value] of [
        [KEY_LAT, String(lat)],
        [KEY_LON, String(lon)],
        ...(label !== null ? [[KEY_LABEL, label]] as const : []),
      ] as const) {
        await tx.insert(settingsTable).values({ key, value })
          .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
      }
    });

    res.json({ lat, lon, label });
  } catch (err) {
    logger.error({ err }, "Error saving default weather location");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
