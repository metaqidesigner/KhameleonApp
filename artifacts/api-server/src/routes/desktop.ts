import { Router, type Request, type Response, type NextFunction } from "express";
import { checkDesktopCode, nextRequest, finishRequest, desktopOnline, unpairDesktop, pairDesktop } from "../lib/desktopLink.js";
import { isAdminRequest } from "../lib/adminCheck.js";

/** The desktop app's side of the link (lib/desktopLink.ts). */
const router = Router();

async function desktopOnly(req: Request, res: Response, next: NextFunction) {
  if (await checkDesktopCode(req.get("x-khameleon-desktop"))) return next();
  res.status(403).json({ error: "This Khameleon is paired with a different desktop app." });
}

router.get("/status", (_req, res) => { res.json({ online: desktopOnline() }); });

/** A signed-in Khameleon window registers its desktop app's code (behind the normal sign-in). */
router.post("/pair", async (req, res) => {
  const code = (req.body ?? {}).code;
  if (typeof code !== "string" || code.length < 32) { res.status(400).json({ error: "Invalid code." }); return; }
  await pairDesktop(code);
  res.json({ paired: true });
});

router.get("/next", desktopOnly, async (req, res) => {
  const wait = Math.min(30_000, Math.max(1_000, Number(req.query.wait ?? 25) * 1000));
  const r = await nextRequest(wait);
  if (!r) { res.status(204).end(); return; }
  res.json(r);
});

router.post("/result/:id", desktopOnly, (req, res) => {
  const { ok, result } = req.body as { ok?: boolean; result?: string };
  res.json({ accepted: finishRequest(String(req.params.id), !!ok, String(result ?? "")) });
});

/** Settings: forget the paired desktop app (admin). */
router.delete("/pairing", async (req, res) => {
  if (!(await isAdminRequest(req))) { res.status(403).json({ error: "Only an admin can do that." }); return; }
  await unpairDesktop();
  res.json({ unpaired: true });
});

export default router;
