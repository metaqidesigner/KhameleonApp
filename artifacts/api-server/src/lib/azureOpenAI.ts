/**
 * Azure OpenAI (docs/khami-design.md, step 5): many organisations that use
 * Microsoft 365 Copilot also run OpenAI models in their own Azure account.
 * An admin enters the resource address, the model deployment's name and a
 * key in Settings > AI; stored encrypted (settings table). Khameleon then
 * offers it as an outside AI, after Copilot.
 */
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { encrypt, decrypt } from "./crypto.js";

const KEY = "azure_openai";
export const DEFAULT_AZURE_API_VERSION = "2024-10-21";

export interface AzureConfig { endpoint: string; deployment: string; apiKey: string; apiVersion: string }

export async function getAzureConfig(): Promise<AzureConfig | null> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, KEY)).limit(1).catch(() => [] as never[]);
  if (!row) return null;
  try {
    const c = JSON.parse(decrypt(row.value)) as AzureConfig;
    return c.endpoint && c.deployment && c.apiKey ? { ...c, apiVersion: c.apiVersion || DEFAULT_AZURE_API_VERSION } : null;
  } catch {
    return null;
  }
}

/** Plain-language problem with what was typed, or null. Pure. Returns the cleaned address too. */
export function checkAzureInput(input: { endpoint?: unknown; deployment?: unknown; apiKey?: unknown }): { problem: string | null; endpoint?: string } {
  let url: URL;
  try { url = new URL(String(input.endpoint ?? "").trim()); } catch { return { problem: "Enter the resource address, e.g. https://acme-ai.openai.azure.com" }; }
  if (url.protocol !== "https:" || !/\.(openai\.azure\.com|cognitiveservices\.azure\.com|services\.ai\.azure\.com)$/i.test(url.hostname)) {
    return { problem: "The address should look like https://your-resource.openai.azure.com - find it under Keys and Endpoint in the Azure portal." };
  }
  if (typeof input.deployment !== "string" || !/^[A-Za-z0-9._-]{1,64}$/.test(input.deployment.trim())) {
    return { problem: "Enter the deployment name exactly as it appears in Azure AI Foundry (letters, numbers, dots, dashes)." };
  }
  if (typeof input.apiKey !== "string" || input.apiKey.trim().length < 20) {
    return { problem: "Paste KEY 1 or KEY 2 from Keys and Endpoint." };
  }
  return { problem: null, endpoint: url.origin };
}

export async function saveAzureConfig(c: AzureConfig): Promise<void> {
  const value = encrypt(JSON.stringify(c));
  await db.insert(settingsTable).values({ key: KEY, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
}

export async function clearAzureConfig(): Promise<void> {
  await db.delete(settingsTable).where(eq(settingsTable.key, KEY));
}

/** Plain words for Azure's error replies. Pure. */
export function azureErrorText(status: number, body: string): string {
  if (status === 401) return "Azure didn't accept the key - check KEY 1 or KEY 2 under Keys and Endpoint.";
  if (status === 404) return "Azure couldn't find that deployment at this address - check the deployment name.";
  if (status === 429) return "Azure says the limit for this deployment has been reached - try again shortly.";
  return `Azure didn't answer (HTTP ${status}${body ? `: ${body.slice(0, 120)}` : ""}).`;
}
