import { Router } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db, customIntegrationsTable } from "@workspace/db";
import { searchDirectory, probeIntegration } from "../lib/mcpRegistry.js";
import { startMcpSignIn, finishMcpSignIn } from "../lib/mcpAuth.js";
import { getCurrentUserId } from "../lib/requestContext.js";

/**
 * Get integrations (docs/build-review.md, Build 16): search the public MCP
 * directory and check an integration before connecting. Connecting itself
 * uses the existing custom-integrations route (token stored encrypted).
 */
const router = Router();

router.get("/search", async (req, res) => {
  try {
    res.json(await searchDirectory(String(req.query.q ?? "")));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Directory unavailable" });
  }
});

router.post("/probe", async (req, res) => {
  const { url, token } = req.body as { url?: string; token?: string };
  if (!url || !/^https?:\/\//.test(url)) return res.status(400).json({ error: "Add the integration's web address." });
  return res.json(await probeIntegration(url, token?.trim() || undefined));
});

function callbackUrl(req: import("express").Request): string {
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:4001");
  const proto = String(req.headers["x-forwarded-proto"] ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https"));
  return `${proto}://${host}/api/integration-sources/oauth/callback`;
}

async function saveIntegration(name: string, url: string): Promise<void> {
  const userId = getCurrentUserId() ?? null;
  const existing = await db.select({ id: customIntegrationsTable.id }).from(customIntegrationsTable)
    .where(and(eq(customIntegrationsTable.sourceUrl, url), userId === null ? isNull(customIntegrationsTable.userId) : eq(customIntegrationsTable.userId, userId)))
    .limit(1);
  if (existing.length) return;
  await db.insert(customIntegrationsTable).values({ userId, name, sourceType: "mcp", sourceUrl: url, encryptedAuthToken: null });
}

/** Starts signing in to an integration; the app opens the returned page. */
router.post("/signin", async (req, res) => {
  const { url, name } = req.body as { url?: string; name?: string };
  if (!url || !/^https:\/\//.test(url) || !name?.trim()) return res.status(400).json({ error: "An https address and a name are required." });
  try {
    const r = await startMcpSignIn(url, name.trim(), callbackUrl(req));
    if ("connected" in r) { await saveIntegration(name.trim(), url); return res.json({ connected: true }); }
    return res.json(r);
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : "Couldn't start the sign-in." });
  }
});

/** Where the service sends the user back after they click "Allow". */
router.get("/oauth/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string | undefined>;
  const page = (title: string, text: string) => `<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="font-family:system-ui,sans-serif;background:#0b1220;color:#d6efee;display:grid;place-items:center;height:100vh;margin:0">
<div style="max-width:420px;text-align:center"><h2>${title}</h2><p>${text}</p></div></body>`;
  if (error || !code || !state) return res.status(400).send(page("Sign-in cancelled", "Nothing was connected. You can close this window."));
  try {
    const { serverUrl, name } = await finishMcpSignIn(state, code);
    await saveIntegration(name, serverUrl);
    return res.send(page("Connected", `${name.replace(/[<>&]/g, "")} is now connected to Khameleon. You can close this window and go back to Khameleon.`));
  } catch (err) {
    return res.status(400).send(page("Couldn't connect", (err instanceof Error ? err.message : "The sign-in didn't complete.").replace(/[<>&]/g, "")));
  }
});

export default router;
