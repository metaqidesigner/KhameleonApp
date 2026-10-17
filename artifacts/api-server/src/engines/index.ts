import type { EngineStatus } from "./types.js";
import { khamiStatus } from "./khami.js";
import { getApiKey } from "../lib/apiKeys.js";
import { getToken } from "../lib/oauthTokens.js";

export * from "./types.js";
export { askKhami, khamiStatus } from "./khami.js";

/**
 * Which engines this Khameleon can use right now (docs/khami-design.md).
 * Khami first - it's the main AI; the others only count once a key exists.
 */
const CLOUD: { id: EngineStatus["id"]; name: string; envKeys: string[] }[] = [
  { id: "anthropic", name: "Claude (Anthropic)", envKeys: ["AI_INTEGRATIONS_ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY"] },
  { id: "openai", name: "GPT (OpenAI)", envKeys: ["AI_INTEGRATIONS_OPENAI_API_KEY", "OPENAI_API_KEY"] },
  { id: "google", name: "Gemini (Google)", envKeys: ["GEMINI_API_KEY"] },
];

export async function engineStatuses(): Promise<EngineStatus[]> {
  const cloud = await Promise.all(CLOUD.map(async c => {
    const hasKey = !!(await getApiKey(c.id).catch(() => null)) || c.envKeys.some(k => !!process.env[k]);
    return { id: c.id, name: c.name, available: hasKey, note: hasKey ? undefined : "No API key added", onThisComputer: false };
  }));
  const copilotConnected = !!(await getToken("copilot").catch(() => null));
  const copilot: EngineStatus = {
    id: "copilot", name: "Microsoft 365 Copilot", available: copilotConnected,
    note: copilotConnected ? undefined : "Not connected - needs a work account with a Copilot licence", onThisComputer: false,
  };
  // Khami first (Khameleon's own AI); Copilot leads the outside AIs.
  return [await khamiStatus(), copilot, ...cloud];
}
