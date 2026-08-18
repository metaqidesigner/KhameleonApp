import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./scheduler";
import { migrateLegacyTaskValues } from "./migrate-legacy-values";

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

// Bootstrap: run idempotent migration to completion before accepting traffic.
// Failure here aborts startup so stale data is never served.
async function bootstrap() {
  await migrateLegacyTaskValues();

  await new Promise<void>((resolve, reject) => {
    app.listen(port, (err?: Error) => {
      if (err) {
        reject(err);
        return;
      }
      logger.info({ port }, "Server listening");
      startScheduler();
      resolve();
    });
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, "Fatal startup error — exiting");
  process.exit(1);
});
