import { app } from "electron";
import * as path from "node:path";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

/**
 * The desktop app's side of the link with the Khameleon server (Build 7;
 * server: artifacts/api-server/src/lib/desktopLink.ts). The chat's AI runs
 * on the server; when it needs to work in the user's apps or files - or type
 * a saved login - the server queues a job, this asks for it, runs it here
 * and posts the result back. Paired by a secret code kept in this app's own
 * data folder; the signed-in Khameleon window registers it with the server.
 */

export type DesktopJobHandler = (action: string, input: Record<string, unknown>) => Promise<string>;

function codePath() {
  return path.join(app.getPath("userData"), "khameleon-desktop-code");
}

/** This install's pairing code (created once, readable only by this user). */
export function desktopCode(): string {
  try {
    const c = readFileSync(codePath(), "utf8").trim();
    if (c.length >= 32) return c;
  } catch { /* first run */ }
  const c = randomBytes(32).toString("hex");
  writeFileSync(codePath(), c, { mode: 0o600 });
  return c;
}

/** The server's API address: KHAMELEON_API_URL, or worked out from the app's address. */
export function apiBase(appUrl: string): string {
  if (process.env.KHAMELEON_API_URL) return process.env.KHAMELEON_API_URL.replace(/\/$/, "");
  const u = new URL(appUrl);
  if (u.port === "5173") return `${u.protocol}//${u.hostname}:4001/api`; // development: Vite app, API on 4001
  return `${u.origin}/api`;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Asks the server for work until the app quits. */
export function startDesktopLink(base: string, handle: DesktopJobHandler): void {
  const code = desktopCode();
  const headers = { "x-khameleon-desktop": code, "Content-Type": "application/json" };
  let stopped = false;
  app.on("will-quit", () => { stopped = true; });
  void (async () => {
    while (!stopped) {
      try {
        const res = await fetch(`${base}/desktop/next?wait=25`, { headers });
        if (res.status === 204) continue;
        if (res.status === 403) { await sleep(10_000); continue; } // not paired yet - the Khameleon window pairs it
        if (!res.ok) { await sleep(5_000); continue; }
        const job = (await res.json()) as { id: string; action: string; input: Record<string, unknown> };
        let ok = true, result = "";
        try { result = await handle(job.action, job.input ?? {}); }
        catch (err) { ok = false; result = err instanceof Error ? err.message : String(err); }
        await fetch(`${base}/desktop/result/${encodeURIComponent(job.id)}`, { method: "POST", headers, body: JSON.stringify({ ok, result }) }).catch(() => undefined);
      } catch {
        await sleep(5_000); // server not reachable yet
      }
    }
  })();
}
