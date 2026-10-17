import { Router } from "express";
import { engineStatuses } from "../engines/index.js";
import { khamiSetupInfo, startBrainDownload, chooseBrain } from "../engines/khami.js";

const isBrain = (v: unknown): v is "standard" | "better" => v === "standard" || v === "better";

const router = Router();

/** Which AI engines are available - Khami first (docs/khami-design.md). */
router.get("/", async (req, res) => {
  try {
    res.json(await engineStatuses());
  } catch (err) {
    req.log.error({ err }, "Error checking engines");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** Khami setup: brain choices, what's downloaded, memory, download progress. */
router.get("/khami/setup", async (req, res) => {
  try {
    res.json(await khamiSetupInfo());
  } catch (err) {
    req.log.error({ err }, "Error reading Khami setup");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** Start downloading a brain; progress is read back from /khami/setup. */
router.post("/khami/download", (req, res) => {
  const { brain } = req.body as { brain?: unknown };
  if (!isBrain(brain)) return res.status(400).json({ error: "brain must be 'standard' or 'better'" });
  return res.json(startBrainDownload(brain));
});

/** Switch Khami to an already-downloaded brain. */
router.post("/khami/brain", async (req, res) => {
  const { brain } = req.body as { brain?: unknown };
  if (!isBrain(brain)) return res.status(400).json({ error: "brain must be 'standard' or 'better'" });
  try {
    await chooseBrain(brain);
    return res.json(await khamiSetupInfo());
  } catch (err) {
    return res.status(409).json({ error: err instanceof Error ? err.message : "Couldn't switch brain" });
  }
});

export default router;
