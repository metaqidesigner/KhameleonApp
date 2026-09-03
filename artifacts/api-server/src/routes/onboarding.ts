/**
 * Onboarding/setup — a single place the frontend can check "what's still
 * needed from the user" and let them enter it, rather than requiring the
 * server operator to set environment variables on their behalf.
 *
 * Covers two different kinds of credential:
 *  - OAuth connectors (Google/Microsoft/Spotify) — status comes from
 *    oauthTokens.ts; the user "enters details" by clicking Connect, which
 *    redirects to the provider's consent screen. Nothing to type in here.
 *  - Model-provider API keys (Anthropic/OpenAI/Gemini/OpenRouter/Minimax) —
 *    the user actually types a key in; that's what this route's
 *    PUT/DELETE endpoints are for.
 */

import { Router, type Request, type Response } from "express";
import { isConnected } from "../lib/oauthTokens.js";
import { API_KEY_PROVIDERS, listApiKeyStatus, setApiKey, clearApiKey } from "../lib/apiKeys.js";
import { isEncryptionConfigured } from "../lib/crypto.js";

const router = Router();

const OAUTH_PROVIDERS = ["google", "microsoft", "spotify"] as const;

// ── GET /api/onboarding/status — everything the setup screen needs ────────────
router.get("/status", async (req: Request, res: Response) => {
  try {
    const [apiKeys, oauthEntries] = await Promise.all([
      listApiKeyStatus(),
      Promise.all(OAUTH_PROVIDERS.map(async (p) => [p, await isConnected(p)] as const)),
    ]);

    res.json({
      apiKeys,
      oauth: Object.fromEntries(oauthEntries),
      encryptionConfigured: isEncryptionConfigured(),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching onboarding status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/onboarding/api-keys — just the API key booleans ──────────────────
router.get("/api-keys", async (req: Request, res: Response) => {
  try {
    res.json(await listApiKeyStatus());
  } catch (err) {
    req.log.error({ err }, "Error fetching API key status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/onboarding/api-key — save a provider's API key ───────────────────
router.put("/api-key", async (req: Request, res: Response) => {
  try {
    const { provider, apiKey } = req.body as { provider?: string; apiKey?: string };
    if (typeof provider !== "string" || !provider.trim()) {
      res.status(400).json({ error: "`provider` is required." });
      return;
    }
    if (typeof apiKey !== "string" || !apiKey.trim()) {
      res.status(400).json({ error: "`apiKey` is required." });
      return;
    }
    await setApiKey(provider, apiKey);
    res.json({ ok: true, provider });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const isBadInput = message.startsWith("Unknown API key provider") || message === "API key cannot be empty.";
    req.log.error({ err }, "Error saving API key");
    res.status(isBadInput ? 400 : 500).json({ error: message });
  }
});

// ── DELETE /api/onboarding/api-key/:provider ───────────────────────────────────
router.delete("/api-key/:provider", async (req: Request, res: Response) => {
  try {
    await clearApiKey(String(req.params.provider));
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const isBadInput = message.startsWith("Unknown API key provider");
    req.log.error({ err }, "Error clearing API key");
    res.status(isBadInput ? 400 : 500).json({ error: message });
  }
});

// ── GET /api/onboarding/providers — static list the frontend can render ───────
router.get("/providers", (_req: Request, res: Response) => {
  res.json({ apiKeyProviders: API_KEY_PROVIDERS, oauthProviders: OAUTH_PROVIDERS });
});

export default router;
