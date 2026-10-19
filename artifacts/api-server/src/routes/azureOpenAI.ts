import { Router, type Request, type Response } from "express";
import { db, actionReceiptsTable } from "@workspace/db";
import { getAzureConfig, saveAzureConfig, clearAzureConfig, checkAzureInput, azureErrorText, DEFAULT_AZURE_API_VERSION, type AzureConfig } from "../lib/azureOpenAI.js";
import { isAdminRequest } from "../lib/adminCheck.js";

/** Settings > AI > Azure OpenAI (lib/azureOpenAI.ts). Admin-only changes; the key is never sent back. */
const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const c = await getAzureConfig();
  res.json({ configured: !!c, endpoint: c?.endpoint ?? null, deployment: c?.deployment ?? null, canEdit: await isAdminRequest(req) });
});

async function adminOnly(req: Request, res: Response): Promise<boolean> {
  if (await isAdminRequest(req)) return true;
  res.status(403).json({ error: "Only an admin can change Azure OpenAI." });
  return false;
}

function fromBody(body: Record<string, unknown>): { config?: AzureConfig; problem?: string } {
  const { problem, endpoint } = checkAzureInput(body);
  if (problem) return { problem };
  return { config: { endpoint: endpoint!, deployment: String(body.deployment).trim(), apiKey: String(body.apiKey).trim(), apiVersion: DEFAULT_AZURE_API_VERSION } };
}

/** One tiny request to the deployment - proves address, deployment and key together. */
async function tryAzure(c: AzureConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const r = await fetch(`${c.endpoint}/openai/deployments/${encodeURIComponent(c.deployment)}/chat/completions?api-version=${c.apiVersion}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": c.apiKey },
      body: JSON.stringify({ messages: [{ role: "user", content: "Reply with OK." }], max_tokens: 5 }),
    });
    if (r.ok) return { ok: true, message: "Azure answered - it's ready to use." };
    return { ok: false, message: azureErrorText(r.status, await r.text().catch(() => "")) };
  } catch {
    return { ok: false, message: "Couldn't reach that address - check it, and the internet connection." };
  }
}

router.put("/", async (req: Request, res: Response) => {
  if (!(await adminOnly(req, res))) return;
  const { config, problem } = fromBody(req.body ?? {});
  if (!config) { res.status(400).json({ error: problem }); return; }
  try {
    await saveAzureConfig(config);
    await db.insert(actionReceiptsTable).values({
      description: "Saved Azure OpenAI settings", category: "settings_change", scope: "local", outcome: "success", target: "Azure OpenAI", canUndo: false,
    }).catch(() => undefined);
    res.json({ saved: true });
  } catch (err) {
    req.log.error({ err }, "saving Azure settings failed");
    res.status(500).json({ error: "Couldn't save the settings." });
  }
});

router.delete("/", async (req: Request, res: Response) => {
  if (!(await adminOnly(req, res))) return;
  await clearAzureConfig();
  res.json({ cleared: true });
});

router.post("/test", async (req: Request, res: Response) => {
  if (!(await adminOnly(req, res))) return;
  const body = req.body ?? {};
  let config: AzureConfig | null | undefined;
  if (body.endpoint || body.apiKey) {
    const r = fromBody(body);
    if (!r.config) { res.json({ ok: false, message: r.problem }); return; }
    config = r.config;
  } else {
    config = await getAzureConfig();
  }
  if (!config) { res.json({ ok: false, message: "Nothing to test yet - enter the details first." }); return; }
  res.json(await tryAzure(config));
});

export default router;
