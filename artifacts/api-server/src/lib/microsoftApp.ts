/**
 * Khameleon's Microsoft app details (docs/build-review.md, Settings panel,
 * option 1 - Newton, 2026-10-18). Each organisation registers Khameleon as
 * an app with Microsoft once; its admin types the app's ID and secret into
 * Settings > Microsoft sign-in, where they're stored encrypted (the
 * settings table, like API keys). The server's environment variables
 * (MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET) still work as a fallback.
 * Used by the Outlook and Microsoft 365 Copilot sign-ins.
 */
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { encrypt, decrypt } from "./crypto.js";

const KEY = "microsoft_app";

export interface MicrosoftApp {
  clientId: string;
  clientSecret: string;
  /** Directory (tenant) ID - optional; lets "Test" check the secret too. */
  tenantId?: string;
  source: "settings" | "server";
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const looksLikeMicrosoftId = (v: string) => GUID.test(v.trim());

export async function getMicrosoftApp(): Promise<MicrosoftApp | null> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, KEY)).limit(1).catch(() => [] as never[]);
  if (row) {
    try {
      const s = JSON.parse(decrypt(row.value)) as Omit<MicrosoftApp, "source">;
      if (s.clientId && s.clientSecret) return { ...s, source: "settings" };
    } catch { /* unreadable - fall back to the server's own settings */ }
  }
  const id = process.env.MICROSOFT_CLIENT_ID;
  const secret = process.env.MICROSOFT_CLIENT_SECRET;
  return id && secret ? { clientId: id, clientSecret: secret, tenantId: process.env.MICROSOFT_TENANT_ID, source: "server" } : null;
}

/** Checks what was typed before saving. Returns a plain-language problem, or null. Pure. */
export function checkMicrosoftAppInput(input: { clientId?: unknown; clientSecret?: unknown; tenantId?: unknown }): string | null {
  if (typeof input.clientId !== "string" || !looksLikeMicrosoftId(input.clientId)) {
    return "The Application (client) ID should look like 1a2b3c4d-1234-5678-9abc-1234567890ab - copy it from the app's Overview page.";
  }
  if (typeof input.clientSecret !== "string" || input.clientSecret.trim().length < 10) {
    return "Paste the client secret's Value (not its ID) from Certificates & secrets.";
  }
  if (input.tenantId !== undefined && input.tenantId !== "" && (typeof input.tenantId !== "string" || !looksLikeMicrosoftId(input.tenantId))) {
    return "The Directory (tenant) ID should look like 1a2b3c4d-1234-5678-9abc-1234567890ab - or leave it empty.";
  }
  return null;
}

export async function saveMicrosoftApp(input: { clientId: string; clientSecret: string; tenantId?: string }): Promise<void> {
  const value = encrypt(JSON.stringify({ clientId: input.clientId.trim(), clientSecret: input.clientSecret.trim(), tenantId: input.tenantId?.trim() || undefined }));
  await db.insert(settingsTable).values({ key: KEY, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
}

export async function clearMicrosoftApp(): Promise<void> {
  await db.delete(settingsTable).where(eq(settingsTable.key, KEY));
}

/**
 * With a Directory ID, asks Microsoft for an app token - which only works
 * when the ID and secret are right. Without one, only the format can be
 * checked; the first sign-in confirms the rest.
 */
export async function testMicrosoftApp(app: MicrosoftApp, fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; message: string }> {
  if (!app.tenantId) {
    return { ok: true, message: "The details look right. Add the Directory (tenant) ID to check the secret too - otherwise the first sign-in will confirm it." };
  }
  const res = await fetchImpl(`https://login.microsoftonline.com/${encodeURIComponent(app.tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: app.clientId, client_secret: app.clientSecret, grant_type: "client_credentials", scope: "https://graph.microsoft.com/.default" }),
  });
  if (res.ok) return { ok: true, message: "Microsoft accepted these details." };
  const body = await res.json().catch(() => ({})) as { error?: string; error_codes?: number[] };
  const codes = body.error_codes ?? [];
  if (codes.includes(7000215) || codes.includes(7000222)) return { ok: false, message: "Microsoft says the client secret is wrong or has expired - create a new one and paste its Value." };
  if (codes.includes(700016)) return { ok: false, message: "Microsoft can't find an app with that Application (client) ID in this directory." };
  if (codes.includes(90002) || codes.includes(900023)) return { ok: false, message: "Microsoft can't find that Directory (tenant) ID." };
  return { ok: false, message: `Microsoft didn't accept these details (${body.error ?? `HTTP ${res.status}`}).` };
}
