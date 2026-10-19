import { Router } from "express";
import { activeSuggestions, dismissSuggestion, markOpened } from "../lib/suggestions.js";
import { getPrepSettings, setPrepSettings } from "../lib/meetingPrepService.js";
import { getAlertSettings, setAlertSettings, type AlertSettings } from "../lib/urgentAlerts.js";

/** The suggestion slot and meeting-prep settings (Builds 10-11). */
const router = Router();

router.get("/suggestions", async (_req, res) => { res.json(await activeSuggestions()); });
router.post("/suggestions/:id/dismiss", async (req, res) => { await dismissSuggestion(Number(req.params.id)); res.json({ ok: true }); });
router.post("/suggestions/:id/opened", async (req, res) => { await markOpened(Number(req.params.id)); res.json({ ok: true }); });

router.get("/meeting-prep/settings", async (_req, res) => { res.json(await getPrepSettings()); });
router.put("/meeting-prep/settings", async (req, res) => {
  const { enabled, leadMinutes } = (req.body ?? {}) as { enabled?: boolean; leadMinutes?: number };
  res.json(await setPrepSettings({ ...(typeof enabled === "boolean" ? { enabled } : {}), ...(leadMinutes !== undefined ? { leadMinutes: Number(leadMinutes) } : {}) }));
});

router.get("/urgent-alerts/settings", async (_req, res) => { res.json(await getAlertSettings()); });
router.put("/urgent-alerts/settings", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (body.mode === "push") { res.status(400).json({ error: "Instant alerts need Khameleon to be reachable from the internet (hosted mode), which isn't set up." }); return; }
  res.json(await setAlertSettings(body as Partial<AlertSettings>));
});

export default router;
