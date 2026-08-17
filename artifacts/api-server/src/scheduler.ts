import { findAgent } from './agents/defaults.js';
import { askAgent } from './agents/gateway.js';
import { logger } from './lib/logger.js';

/**
 * Returns milliseconds until the next occurrence of 7:00 AM local time.
 */
function msUntilNextSevenAM(): number {
  const now  = new Date();
  const next = new Date(now);
  next.setHours(7, 0, 0, 0);
  // If 7 AM has already passed today, schedule for tomorrow
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

async function runMorningDigest(): Promise<void> {
  const agent = findAgent('morning_digest');
  if (!agent) {
    logger.warn('Scheduler: morning_digest agent not found in roster');
    return;
  }

  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  logger.info({ today }, 'Scheduler: starting morning digest');

  const result = await askAgent(agent, [
    {
      role: 'user',
      content:
        `Good morning! Please generate today's morning digest for ${today}. ` +
        `Review existing tasks using list_tasks, then create a balanced, categorised daily plan with create_task. ` +
        `Cover all six time buckets: Start of Day, Core Work, Meetings, Communication, Administrative, and End of Day.`,
    },
  ]);

  if (result.error) {
    logger.error({ error: result.error }, 'Scheduler: morning digest returned an error');
  } else {
    logger.info(
      { tokens: result.tokens, latencyMs: result.latencyMs, toolCalls: result.toolCalls?.length ?? 0 },
      'Scheduler: morning digest complete',
    );
  }
}

/**
 * Start the daily morning-digest scheduler.
 * Fires at 7:00 AM every day (server local time) and repeats every 24 h.
 */
export function startScheduler(): void {
  const msFirst = msUntilNextSevenAM();
  const hh = Math.floor(msFirst / 3_600_000);
  const mm = Math.floor((msFirst % 3_600_000) / 60_000);

  logger.info({ nextRunIn: `${hh}h ${mm}m` }, 'Scheduler: morning digest scheduled for 7:00 AM daily');

  const tick = () => {
    runMorningDigest().catch((err) =>
      logger.error({ err }, 'Scheduler: unhandled error in morning digest'),
    );
    // Schedule the next run exactly 24 hours after this one fires
    setTimeout(tick, 24 * 60 * 60 * 1000);
  };

  setTimeout(tick, msFirst);
}
