/**
 * Carries "which account, if any, made this request" through the whole
 * async call chain (DB queries, fetch calls, nested skill/graph functions)
 * without threading a userId parameter through every intermediate function
 * - hosted/managed mode Phase 2 (khameleon-decisions-log.md, 2026-10-03).
 *
 * Deliberately a separate, minimal mechanism rather than explicit parameter
 * threading: oauthTokens.ts alone has ~10 call sites across 16 files
 * (outlookGraph.ts, gmailApi.ts, every OAuth-backed route), each several
 * layers deep from the Express request. AsyncLocalStorage is the standard
 * Node answer to exactly this cross-cutting "current request identity"
 * problem - one middleware sets it, any function anywhere in that request's
 * call chain can read it, and every existing call site needs zero changes.
 *
 * With no middleware run (a scheduled job like scheduler.ts's morning
 * digest, which has no HTTP request at all) or on a single-user instance
 * that's never created an account, getCurrentUserId() returns undefined -
 * exactly today's single global/admin connection, unchanged behavior by
 * construction, not by a conditional someone could forget.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, Response } from "express";
import { currentUserId } from "./session.js";

interface RequestContext {
  userId?: number;
}

const als = new AsyncLocalStorage<RequestContext>();

/** Mounted once in app.ts, after appAuthGate. Cheap - just reads the already-looked-up in-memory session. */
export function withRequestContext(req: Request, _res: Response, next: NextFunction): void {
  als.run({ userId: currentUserId(req) }, next);
}

/** The current request's logged-in user id, if any - undefined for a no-accounts instance, an Option-A-only session, or no active request at all (e.g. a scheduled job). */
export function getCurrentUserId(): number | undefined {
  return als.getStore()?.userId;
}
