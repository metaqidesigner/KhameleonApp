/**
 * Get integrations (docs/build-review.md, Build 16): search the public
 * directory of MCP integrations (registry.modelcontextprotocol.io) and
 * check one before connecting. Only integrations Khameleon can reach over
 * the internet are listed - ones that would need a program installed on the
 * computer are left out (Khameleon never runs outside programs).
 *
 * What Khameleon can honestly say about who's behind a listing: the
 * directory proves a publisher owns its reverse-domain name (com.notion =
 * notion.com). If the integration's address is on that domain, the publisher
 * is verified as its owner - which says who runs it, not that they're the
 * company whose service it connects to. Listings published under a GitHub
 * account, or hosted on a shared platform under someone's username
 * ("/@user/..."), are never marked verified. The app shows who published it
 * and where it runs, so the user can judge.
 */
import { listMcpTools } from "./mcpClient.js";

const REGISTRY = "https://registry.modelcontextprotocol.io/v0/servers";

export interface RegistryRemote { type: string; url: string; headers?: { name: string; isRequired?: boolean; isSecret?: boolean; description?: string }[] }
export interface RegistryServer { name: string; title?: string; description?: string; version?: string; remotes?: RegistryRemote[]; websiteUrl?: string }

export interface DirectoryIntegration {
  id: string;
  title: string;
  description: string;
  url: string;
  /** Publisher proved they own the domain the integration runs on. */
  verified: boolean;
  /** Who published it, in plain words: "notion.com" or "GitHub user upstash". */
  publisher: string;
  /** A key/token the user must paste (from the service) before connecting. */
  needsKey: boolean;
  keyHint?: string;
}

/** Who published a listing, from its directory name. Pure. */
export function publisherOf(name: string): string {
  const ns = name.split("/")[0];
  if (ns.toLowerCase().startsWith("io.github.")) return `GitHub user ${ns.slice("io.github.".length)}`;
  return ns.includes(".") ? ns.split(".").reverse().join(".") : ns;
}

/** Did the publisher prove they own the domain the integration runs on? Pure. */
export function isVerifiedPublisher(name: string, url: string): boolean {
  const ns = name.split("/")[0].toLowerCase(); // e.g. "com.notion"
  if (!ns.includes(".") || ns.startsWith("io.github.")) return false;
  const domain = ns.split(".").reverse().join("."); // "notion.com"
  let parsed: URL;
  try { parsed = new URL(url); } catch { return false; }
  if (/\/@[^/]+\//.test(parsed.pathname)) return false; // someone's copy on a shared platform
  const host = parsed.hostname.toLowerCase();
  return host === domain || host.endsWith(`.${domain}`);
}

/** One directory listing -> what Khameleon shows, or null if it can't be reached remotely. Pure. */
export function toDirectoryIntegration(s: RegistryServer): DirectoryIntegration | null {
  const remote = (s.remotes ?? []).find(r => r.type === "streamable-http" || r.type === "sse");
  if (!remote || !/^https:\/\//.test(remote.url) || /\{[^}]+\}/.test(remote.url)) return null;
  const keyHeader = (remote.headers ?? []).find(h => h.isRequired);
  // Generic directory names ("com.notion/mcp") read better as the company ("Notion").
  const last = s.name.split("/").pop()!.replace(/[-_]/g, " ");
  const brand = s.name.split("/")[0].split(".").slice(1, 2)[0] ?? last;
  const generic = /^(mcp|server|mcp server|api|remote|remote mcp)$/i.test(last.trim());
  const title = s.title?.trim() || (generic ? brand.charAt(0).toUpperCase() + brand.slice(1) : last);
  return {
    id: s.name,
    title,
    description: (s.description ?? "").slice(0, 300),
    url: remote.url,
    verified: isVerifiedPublisher(s.name, remote.url),
    publisher: publisherOf(s.name),
    needsKey: !!keyHeader,
    keyHint: keyHeader?.description,
  };
}

export async function searchDirectory(query: string): Promise<DirectoryIntegration[]> {
  const url = `${REGISTRY}?version=latest&limit=50${query.trim() ? `&search=${encodeURIComponent(query.trim())}` : ""}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("The integrations directory isn't responding right now - try again shortly.");
  const data = await res.json() as { servers?: { server: RegistryServer }[] };
  const list = (data.servers ?? []).map(x => toDirectoryIntegration(x.server)).filter((x): x is DirectoryIntegration => x !== null);
  // Verified publishers first, then alphabetical.
  return list.sort((a, b) => Number(b.verified) - Number(a.verified) || a.title.localeCompare(b.title));
}

export type ProbeResult =
  | { ok: true; tools: { name: string; description?: string }[] }
  | { ok: false; needsSignIn: boolean; message: string };

/** Connects briefly to list what the integration can do, without saving anything. */
export async function probeIntegration(url: string, token?: string): Promise<ProbeResult> {
  try {
    const tools = await listMcpTools({ url, token });
    return { ok: true, tools: tools.map(t => ({ name: t.name, description: t.description })) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/401|unauthori[sz]ed|invalid_token|authentication/i.test(msg)) {
      return { ok: false, needsSignIn: true, message: token ? "That key wasn't accepted." : "This integration needs you to sign in or provide a key." };
    }
    return { ok: false, needsSignIn: false, message: "Couldn't reach this integration. Check the address and your internet connection." };
  }
}
