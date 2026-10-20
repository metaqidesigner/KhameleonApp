import { Router, type Request, type Response } from "express";
import { db, actionReceiptsTable } from "@workspace/db";
import { monthSpend, totalOf, spendLimit, setSpendLimit, PAY_PER_USE } from "../lib/aiSpend.js";
import { getApiKey } from "../lib/apiKeys.js";
import { getAzureConfig } from "../lib/azureOpenAI.js";
import { isAdminRequest } from "../lib/adminCheck.js";

/**
 * Settings > AI > Spend (lib/aiSpend.ts): this month's estimate for each
 * pay-per-use AI, and the optional monthly limit. `relevant` says whether to
 * show it at all - only when a pay-per-use AI is set up (people using Khami or
 * their company's Copilot never see it).
 */
const router = Router();

const LABELS: Record<string, string> = { anthropic: "Claude", openai: "OpenAI", google: "Gemini", openrouter: "OpenRouter", minimax: "MiniMax", azure: "Azure OpenAI" };

router.get("/", async (_req: Request, res: Response) => {
  const spend = await monthSpend();
  const keyed = await Promise.all([...PAY_PER_USE].filter(p => p !== "azure").map(async p => ((await getApiKey(p).catch(() => null)) ? p : null)));
  const azure = (await getAzureConfig().catch(() => null)) ? "azure" : null;
  const setUp = [...keyed, azure].filter((p): p is string => !!p);
  const providers = [...new Set([...setUp, ...Object.keys(spend)])].map(p => ({
    provider: p, label: LABELS[p] ?? p, usd: spend[p]?.usd ?? 0, answers: spend[p]?.answers ?? 0,
  }));
  const limitUsd = await spendLimit();
  const totalUsd = totalOf(spend);
  const now = new Date();
  res.json({
    relevant: providers.length > 0,
    month: now.toLocaleDateString("en-AU", { month: "long", year: "numeric" }),
    providers, totalUsd, limitUsd,
    overLimit: limitUsd !== null && totalUsd >= limitUsd,
  });
});

/** { limitUsd: number | null } - null (or 0) removes the limit. */
router.put("/limit", async (req: Request, res: Response) => {
  if (!(await isAdminRequest(req))) { res.status(403).json({ error: "Only an admin can change the spend limit." }); return; }
  const raw = (req.body ?? {}).limitUsd;
  const limit = raw === null || raw === "" || Number(raw) === 0 ? null : Number(raw);
  if (limit !== null && (!Number.isFinite(limit) || limit < 0 || limit > 100_000)) {
    res.status(400).json({ error: "Enter an amount in US dollars, like 20 - or leave it empty for no limit." });
    return;
  }
  await setSpendLimit(limit);
  await db.insert(actionReceiptsTable).values({
    description: limit === null ? "Removed the monthly limit for paid AIs" : `Set the monthly limit for paid AIs to US$${limit.toFixed(2)}`,
    category: "settings_change", scope: "local", outcome: "success", target: "AI spend limit", canUndo: false,
  }).catch(() => undefined);
  res.json({ limitUsd: limit });
});

export default router;
