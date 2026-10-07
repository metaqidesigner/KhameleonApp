/**
 * Quota tracking, scoped build (khameleon-decisions-log.md, 2026-10-01):
 * surfaces the real per-minute rate-limit headers Anthropic and OpenAI
 * already return on every API response - not a fabricated "typical limit"
 * guess (providers' real limits vary per account/tier), and not a
 * dedicated quota-polling endpoint (neither provider exposes overall
 * spend/budget via API - only these per-request rate-limit headers do
 * exist). This is "requests/tokens left in the current short-term
 * rate-limit window," not "how much of your monthly budget is left" -
 * the latter genuinely isn't available via either provider's API.
 *
 * Deliberately doesn't parse/show a reset time: Anthropic and OpenAI
 * format it differently (an RFC3339 timestamp vs. a short duration string
 * like "6m0s"), and neither could be verified against a live call in this
 * environment - shown as capturedAt (when Khameleon itself last saw a
 * response) instead of guessing at a parse that might be wrong.
 *
 * Google/OpenRouter/Minimax/Ollama go through the same OpenAI-compatible
 * client code path (agents/gateway.ts's askOpenAI) but aren't tracked
 * here - nothing confirms they send the same x-ratelimit-* headers OpenAI
 * does, so they're honestly omitted rather than guessed at.
 */

export type TrackedProvider = "anthropic" | "openai";

export interface QuotaSnapshot {
  requestsLimit?: number;
  requestsRemaining?: number;
  tokensLimit?: number;
  tokensRemaining?: number;
  capturedAt: string;
}

const snapshots = new Map<TrackedProvider, QuotaSnapshot>();

function num(headers: Headers, name: string): number | undefined {
  const raw = headers.get(name);
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function recordAnthropicHeaders(headers: Headers): void {
  snapshots.set("anthropic", {
    requestsLimit: num(headers, "anthropic-ratelimit-requests-limit"),
    requestsRemaining: num(headers, "anthropic-ratelimit-requests-remaining"),
    tokensLimit: num(headers, "anthropic-ratelimit-tokens-limit"),
    tokensRemaining: num(headers, "anthropic-ratelimit-tokens-remaining"),
    capturedAt: new Date().toISOString(),
  });
}

export function recordOpenAIHeaders(headers: Headers): void {
  snapshots.set("openai", {
    requestsLimit: num(headers, "x-ratelimit-limit-requests"),
    requestsRemaining: num(headers, "x-ratelimit-remaining-requests"),
    tokensLimit: num(headers, "x-ratelimit-limit-tokens"),
    tokensRemaining: num(headers, "x-ratelimit-remaining-tokens"),
    capturedAt: new Date().toISOString(),
  });
}

export function getQuotaSnapshots(): Partial<Record<TrackedProvider, QuotaSnapshot>> {
  return {
    anthropic: snapshots.get("anthropic"),
    openai: snapshots.get("openai"),
  };
}

/**
 * Wraps a provider SDK's fetch so every real response is inspected for
 * rate-limit headers, without altering the response itself. Passed as the
 * `fetch` client option both SDKs already support - no per-call-site
 * changes needed anywhere Anthropic/OpenAI are actually called.
 */
export function trackingFetch(provider: TrackedProvider): (...args: Parameters<typeof fetch>) => Promise<Response> {
  const record = provider === "anthropic" ? recordAnthropicHeaders : recordOpenAIHeaders;
  return async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const res = await fetch(...args);
    try {
      record(res.headers);
    } catch {
      // Best-effort only - never let header parsing affect the real request.
    }
    return res;
  };
}
