/**
 * Who may talk to this Khameleon (pre-launch security review, 2026-10-20).
 *
 * 1. Websites: only Khameleon's own pages may call the API from a browser.
 *    Other sites get no CORS permission, and their attempts to change things
 *    are refused (cross-site request forgery). Previously any website could.
 * 2. DNS rebinding: when the server only listens to this computer, requests
 *    must be addressed to localhost - a web page can't pretend to be it.
 * 3. No password = this computer only: without a password or accounts,
 *    requests from other computers are refused (lib/session.ts) unless
 *    KHAMELEON_ALLOW_NO_PASSWORD=true says the network is protected another way.
 */
import type { Request, Response, NextFunction } from "express";

const DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

export function isLoopback(addr: string | undefined): boolean {
  if (!addr) return false;
  const a = addr.replace(/^::ffff:/, "");
  return a === "::1" || a.startsWith("127.");
}

/** Where the server listens: this computer only, unless KHAMELEON_HOST says otherwise (Docker sets 0.0.0.0). */
export function listenHost(): string {
  return process.env.KHAMELEON_HOST || "127.0.0.1";
}
export const listensOnLoopbackOnly = () => ["127.0.0.1", "localhost", "::1"].includes(listenHost());

export function allowedOrigins(): Set<string> {
  const extra = (process.env.KHAMELEON_ALLOWED_ORIGINS ?? "").split(",").map(s => s.trim().replace(/\/$/, "")).filter(Boolean);
  return new Set([...DEV_ORIGINS, ...extra]);
}

/** Same site as the server itself, or on the allowed list. Pure. */
export function originAllowed(origin: string, host: string | undefined, allowed: Set<string>): boolean {
  if (allowed.has(origin.replace(/\/$/, ""))) return true;
  try { return !!host && new URL(origin).host === host; } catch { return false; }
}

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

export function originGuard(req: Request, res: Response, next: NextFunction): void {
  const origin = req.get("origin");
  if (!origin) return next(); // not from a browser page (the desktop app, scripts) - other checks apply
  const host = (req.get("x-forwarded-host") ?? req.get("host")) || undefined;
  if (originAllowed(origin, host, allowedOrigins())) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", req.get("access-control-request-headers") ?? "Content-Type");
      res.status(204).end();
      return;
    }
    return next();
  }
  if (req.method === "OPTIONS") { res.status(204).end(); return; } // no permission given - the browser blocks it
  if (!SAFE.has(req.method)) { res.status(403).json({ error: "Requests from other websites aren't allowed." }); return; }
  next(); // a plain read: answered, but without permission for the other site to see it
}

export function hostGuard(req: Request, res: Response, next: NextFunction): void {
  if (!listensOnLoopbackOnly()) return next();
  const host = (req.get("host") ?? "").replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  if (["localhost", "127.0.0.1", "::1"].includes(host)) return next();
  res.status(421).json({ error: "This Khameleon only answers requests addressed to this computer (localhost)." });
}
