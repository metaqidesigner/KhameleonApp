import { Router, type Request, type Response } from 'express';
import { logger } from '../lib/logger.js';
import { getSchedulerStatus, updateSchedulerConfig } from '../scheduler.js';

const router = Router();

/**
 * The scheduler admin key is read from environment at startup.
 * If not set, the mutation endpoint is disabled (503).
 * Set SCHEDULER_ADMIN_KEY as a Replit Secret to enable remote configuration.
 */
const ADMIN_KEY = process.env.SCHEDULER_ADMIN_KEY ?? '';

if (!ADMIN_KEY) {
  logger.warn(
    'Scheduler: SCHEDULER_ADMIN_KEY env var is not set — ' +
    'PUT /api/scheduler/config will be disabled until it is configured.',
  );
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
 * Middleware: require Authorization: Bearer <SCHEDULER_ADMIN_KEY>.
 */
function requireAdminKey(req: Request, res: Response, next: () => void): void {
  if (!ADMIN_KEY) {
    res.status(503).json({
      error:
        'Scheduler configuration is disabled: set the SCHEDULER_ADMIN_KEY ' +
        'Replit Secret (and VITE_SCHEDULER_ADMIN_KEY for the frontend) to enable it.',
    });
    return;
  }

  const authHeader = req.headers.authorization ?? '';
  const [scheme, token = ''] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !safeCompare(token, ADMIN_KEY)) {
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
