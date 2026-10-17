/**
 * Signing in to integrations (docs/build-review.md, Build 16). Most official
 * integrations (e.g. Notion, Atlassian) ask the user to sign in with the
 * service and click "Allow", using the MCP standard's sign-in (OAuth with
 * automatic app registration). The MCP SDK runs the protocol; this file
 * gives it somewhere to keep each integration's sign-in details -
 * encrypted, in the settings table - and remembers sign-ins in progress.
 */
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { auth, type OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type { OAuthClientInformationMixed, OAuthTokens, OAuthClientMetadata } from "@modelcontextprotocol/sdk/shared/auth.js";
import { db, settingsTable } from "@workspace/db";
import { encrypt, decrypt } from "./crypto.js";

interface Stored {
  redirectUrl?: string;
  client?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  verifier?: string;
  discovery?: unknown;
}

const key = (serverUrl: string) => `mcp_oauth:${serverUrl}`;

async function load(serverUrl: string): Promise<Stored> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key(serverUrl))).limit(1);
  if (!row) return {};
  try { return JSON.parse(decrypt(row.value)) as Stored; } catch { return {}; }
}

async function save(serverUrl: string, patch: Partial<Stored>): Promise<void> {
  const next = { ...(await load(serverUrl)), ...patch };
  const value = encrypt(JSON.stringify(next));
  await db.insert(settingsTable).values({ key: key(serverUrl), value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
}

/** Forgets an integration's sign-in (e.g. when it's removed). */
export async function forgetMcpSignIn(serverUrl: string): Promise<void> {
  await db.delete(settingsTable).where(eq(settingsTable.key, key(serverUrl)));
}

export async function hasMcpSignIn(serverUrl: string): Promise<boolean> {
  return !!(await load(serverUrl)).tokens;
}

/**
 * The provider the SDK uses. `interactive` is true only while a user is
 * signing in; at any other time a request for sign-in means the sign-in has
 * expired, and is reported instead of opening anything.
 */
export function mcpAuthProvider(serverUrl: string, opts: { redirectUrl?: string; state?: string; onRedirect?: (url: URL) => void } = {}): OAuthClientProvider {
  let cachedRedirect = opts.redirectUrl;
  return {
    get redirectUrl() { return cachedRedirect; },
    get clientMetadata(): OAuthClientMetadata {
      return {
        client_name: "Khameleon",
        redirect_uris: cachedRedirect ? [cachedRedirect] : [],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      } as OAuthClientMetadata;
    },
    state: opts.state ? () => opts.state! : undefined,
    clientInformation: async () => {
      const s = await load(serverUrl);
      cachedRedirect ??= s.redirectUrl;
      return s.client;
    },
    saveClientInformation: info => save(serverUrl, { client: info }),
    tokens: async () => (await load(serverUrl)).tokens,
    saveTokens: tokens => save(serverUrl, { tokens }),
    redirectToAuthorization: url => {
      if (!opts.onRedirect) throw new Error("Your sign-in to this integration has expired - connect it again from Get integrations.");
      opts.onRedirect(url);
    },
    saveCodeVerifier: verifier => save(serverUrl, { verifier }),
    codeVerifier: async () => (await load(serverUrl)).verifier ?? "",
    saveDiscoveryState: discovery => save(serverUrl, { discovery }),
    discoveryState: async () => (await load(serverUrl)).discovery as never,
    invalidateCredentials: async scope => {
      if (scope === "all") await forgetMcpSignIn(serverUrl);
      else if (scope === "tokens") await save(serverUrl, { tokens: undefined });
      else if (scope === "client") await save(serverUrl, { client: undefined });
      else if (scope === "verifier") await save(serverUrl, { verifier: undefined });
    },
  };
}

interface Pending { serverUrl: string; name: string; redirectUrl: string; at: number }
const pending = new Map<string, Pending>();

/**
 * Starts a sign-in. Returns the service's sign-in page to open, or
 * "connected" when existing sign-in details already work.
 */
export async function startMcpSignIn(serverUrl: string, name: string, redirectUrl: string): Promise<{ signInUrl: string } | { connected: true }> {
  for (const [k, v] of pending) if (Date.now() - v.at > 10 * 60 * 1000) pending.delete(k);
  const state = crypto.randomBytes(16).toString("hex");
  await save(serverUrl, { redirectUrl });
  let signInUrl: string | null = null;
  const provider = mcpAuthProvider(serverUrl, { redirectUrl, state, onRedirect: url => { signInUrl = url.toString(); } });
  const result = await auth(provider, { serverUrl });
  if (result === "AUTHORIZED") return { connected: true };
  if (!signInUrl) throw new Error("This integration didn't offer a way to sign in.");
  pending.set(state, { serverUrl, name, redirectUrl, at: Date.now() });
  return { signInUrl };
}

/** Finishes a sign-in when the service sends the user back. */
export async function finishMcpSignIn(state: string, code: string): Promise<{ serverUrl: string; name: string }> {
  const p = pending.get(state);
  if (!p) throw new Error("This sign-in has expired - start it again from Get integrations.");
  pending.delete(state);
  const provider = mcpAuthProvider(p.serverUrl, { redirectUrl: p.redirectUrl });
  const result = await auth(provider, { serverUrl: p.serverUrl, authorizationCode: code });
  if (result !== "AUTHORIZED") throw new Error("The sign-in didn't complete.");
  return { serverUrl: p.serverUrl, name: p.name };
}
