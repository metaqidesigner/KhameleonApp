import { Router } from "express";
import { engineStatuses } from "../engines/index.js";

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

export default router;
