/**
 * design-spec.md §18 (Provider Access Model) - "provider abstraction must
 * resolve to whichever providers *this* user has connected, not a fixed
 * global set." Before this file existed, six call sites each built an
 * Anthropic client straight from server env vars - task-executor.ts,
 * researchAgent.ts, skillSetSuggester.ts, and all three Outlook skills -
 * completely ignoring a key the user saved via onboarding (apiKeys.ts,
 * 2026-08-27). Only agents/gateway.ts (the Multi-Agent Roster) ever
 * actually read it.
 *
 * Same priority order as gateway.ts's own resolveKey() for the anthropic
 * case: the user's own saved key first, the server's env var as a
 * deployment-wide fallback. gateway.ts is left as is - it already
 * resolves five providers correctly, not just this one.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getApiKey } from "./apiKeys.js";
import { trackingFetch } from "./providerQuota.js";

export async function getAnthropicClient(): Promise<Anthropic> {
  const stored = await getApiKey("anthropic").catch(() => null);
  return new Anthropic({
    apiKey: stored ?? process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL ?? undefined,
    fetch: trackingFetch("anthropic"),
  });
}
