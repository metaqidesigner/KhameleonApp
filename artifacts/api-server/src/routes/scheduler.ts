import { Router, type Request, type Response } from 'express';
import { logger } from '../lib/logger.js';
import { getSchedulerStatus, updateSchedulerConfig } from '../scheduler.js';

const router = Router();

/**
 * The scheduler admin key is read from environment at startup. Unset by
 * default in a single-user deployment - PUT /config is then open to the
 * app's one user, same trust level as every other personal-preference
 * endpoint. Set SCHEDULER_ADMIN_KEY as a Replit Secret only if this
 * server is ever hosted for more than one person.
 */
const ADMIN_KEY = process.env.SCHEDULER_ADMIN_KEY ?? '';

if (ADMIN_KEY) {
  logger.info('Scheduler: SCHEDULER_ADMIN_KEY is set — PUT /api/scheduler/config now requires it.');
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Pure decision function behind requireAdminKey, split out so it's
 * unit-testable without needing two separate module imports for the
 * "key set" / "key unset" cases (ADMIN_KEY is captured once at import
 * time from process.env).
 */
export function isSchedulerRequestAuthorized(configuredKey: string, authHeader: string): boolean {
  if (!configuredKey) return true;
  const [scheme, token = ''] = authHeader.split(' ');
  return scheme === 'Bearer' && safeCompare(token, configuredKey);
}

/**
 * Middleware: require Authorization: Bearer <SCHEDULER_ADMIN_KEY> - but only
 * when an operator has actually configured one. This was originally
 * "disabled until configured", which in a single-user app meant the
 * user's own digest-time preference required setting a special admin
 * secret as BOTH a server and frontend env var before it was even
 * reachable - worse than having no time picker at all. Every other
 * personal-preference endpoint in this app (weather location, voice
 * settings, appearance) is open to the app's one user by default; this
 * now matches that, while still gating access the moment an operator
 * deliberately sets SCHEDULER_ADMIN_KEY (future hosted/org use).
 */
export function requireAdminKey(req: Request, res: Response, next: () => void): void {
  if (!isSchedulerRequestAuthorized(ADMIN_KEY, req.headers.authorization ?? '')) {
    res.status(401).json({ error: 'Unauthorized: valid Bearer token required' });
    return;
  }

  next();
}

/**
 * GET /api/scheduler/status
 * Read-only — returns the current scheduler config and next/last run times.
 */
router.get('/status', (_req: Request, res: Response) => {
  res.json(getSchedulerStatus());
});

/**
 * PUT /api/scheduler/config
 * Body: { enabled?: boolean, digestHour?: number, digestMinute?: number }
 *
 * Protected by SCHEDULER_ADMIN_KEY (set as a Replit Secret).
 * Strictly validates all fields — returns 400 for any out-of-range or wrong-type value.
 * Writes through to the database before responding so config survives restarts.
 */
router.put('/config', requireAdminKey, async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const patch: Parameters<typeof updateSchedulerConfig>[0] = {};

  // Validate `enabled`
  if ('enabled' in body) {
    if (typeof body.enabled !== 'boolean') {
      res.status(400).json({ error: '`enabled` must be a boolean' });
      return;
    }
    patch.enabled = body.enabled;
  }

  // Validate `digestHour`
  if ('digestHour' in body) {
    const h = body.digestHour;
    if (typeof h !== 'number' || !Number.isInteger(h) || h < 0 || h > 23) {
      res.status(400).json({ error: '`digestHour` must be an integer in 0–23' });
      return;
    }
    patch.digestHour = h;
  }

  // Validate `digestMinute`
  if ('digestMinute' in body) {
    const m = body.digestMinute;
    if (typeof m !== 'number' || !Number.isInteger(m) || m < 0 || m > 59) {
      res.status(400).json({ error: '`digestMinute` must be an integer in 0–59' });
      return;
    }
    patch.digestMinute = m;
  }

  try {
    const status = await updateSchedulerConfig(patch);
    res.json(status);
  } catch (err) {
    logger.error({ err }, 'Scheduler route: failed to update config');
    res.status(500).json({ error: 'Internal server error while saving scheduler config' });
  }
});

export default router;
