import app from "./app";
import { logger } from "./lib/logger";
import { initScheduler } from "./scheduler";
import { migrateLegacyTaskValues } from "./migrate-legacy-values";
import { ensureSettingsTable } from "./ensure-settings-table";
import { seedSkillSetsData } from "./seed-skill-sets-data";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Bootstrap: run all initialisation before accepting traffic.
// Failure here aborts startup so stale data is never served.
async function bootstrap() {
  // 1. Idempotent data migrations
  await migrateLegacyTaskValues();

  // 2. Ensure the settings table exists (DDL is idempotent — safe on every boot,
  //    including fresh deployments where drizzle-kit push has not been run).
  await ensureSettingsTable();

  // 3. Load persisted scheduler config from DB and arm the timer.
  //    Must happen before we accept traffic so GET /api/scheduler/status
  //    always reflects the saved digest time from the very first request.
  await initScheduler();

  // 4. Seed default Work Domains / Integrations directory metadata /
  //    starter Skill Sets catalog (design-spec.md §15-17), idempotent.
  await seedSkillSetsData();

  // 5. Start accepting HTTP requests only after all initialisation is complete.
  await new Promise<void>((resolve, reject) => {
    app.listen(port, (err?: Error) => {
      if (err) {
        reject(err);
        return;
      }
      logger.info({ port }, "Server listening");
      resolve();
    });
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, "Fatal startup error — exiting");
  process.exit(1);
});
