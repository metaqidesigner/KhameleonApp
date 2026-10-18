import { Router, type Request, type Response } from "express";
import { db, actionReceiptsTable } from "@workspace/db";
import { getMicrosoftApp, saveMicrosoftApp, clearMicrosoftApp, checkMicrosoftAppInput, testMicrosoftApp } from "../lib/microsoftApp.js";
import { isAdminRequest } from "../lib/adminCheck.js";
import { getRedirectUri } from "./auth.js";

/**
 * Settings > Microsoft sign-in (lib/microsoftApp.ts). Anyone can see
 * whether it's set up; only an admin can change or test it. The secret is
 * never sent back.
 */
const router = Router();

const mask = (id: string) => `${id.slice(0, 8)}…${id.slice(-4)}`;

router.get("/", async (req: Request, res: Response) => {
  const app = await getMicrosoftApp();
  res.json({
    configured: !!app,
    source: app?.source ?? null,
    clientId: app ? mask(app.clientId) : null,
    tenantId: app?.tenantId ? mask(app.tenantId) : null,
    redirectUri: getRedirectUri(req),
    canEdit: await isAdminRequest(req),
  });
});

async function adminOnly(req: Request, res: Response): Promise<boolean> {
  if (await isAdminRequest(req)) return true;
  res.status(403).json({ error: "Only an admin can change the Microsoft sign-in." });
  return false;
}

router.put("/", async (req: Request, res: Response) => {
  if (!(await adminOnly(req, res))) return;
  const problem = checkMicrosoftAppInput(req.body ?? {});
  if (problem) { res.status(400).json({ error: problem }); return; }
  const { clientId, clientSecret, tenantId } = req.body as { clientId: string; clientSecret: string; tenantId?: string };
  try {
    await saveMicrosoftApp({ clientId, clientSecret, tenantId });
    await db.insert(actionReceiptsTable).values({
      description: "Saved the Microsoft sign-in app details", category: "settings_change", scope: "local", outcome: "success", target: "Microsoft sign-in", canUndo: false,
    }).catch(() => undefined);
    res.json({ saved: true });
  } catch (err) {
    req.log.error({ err }, "saving Microsoft app failed");
    res.status(500).json({ error: err instanceof Error && /encrypt/i.test(err.message) ? "Khameleon's encryption key isn't set on the server, so the secret can't be stored safely." : "Couldn't save the details." });
  }
});

router.delete("/", async (req: Request, res: Response) => {
  if (!(await adminOnly(req, res))) return;
  await clearMicrosoftApp();
  res.json({ cleared: true });
});

/** Tests the details typed in (before saving), or the saved ones. */
router.post("/test", async (req: Request, res: Response) => {
  if (!(await adminOnly(req, res))) return;
  const body = req.body ?? {};
  let app = await getMicrosoftApp();
  if (body.clientId || body.clientSecret) {
    const problem = checkMicrosoftAppInput(body);
    if (problem) { res.json({ ok: false, message: problem }); return; }
    app = { clientId: body.clientId, clientSecret: body.clientSecret, tenantId: body.tenantId || undefined, source: "settings" };
  }
  if (!app) { res.json({ ok: false, message: "Nothing to test yet - enter the app details first." }); return; }
  try {
    res.json(await testMicrosoftApp(app));
  } catch {
    res.json({ ok: false, message: "Couldn't reach Microsoft - check the internet connection." });
  }
});

export default router;
