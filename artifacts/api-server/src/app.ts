import path from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { appAuthGate } from "./lib/session.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Shared-password gate (account isolation, Option A) - a no-op unless an
// operator sets KHAMELEON_APP_PASSWORD. See lib/session.ts.
app.use("/api", appAuthGate, router);

// Self-hosted single-container deployments (see /Dockerfile, /docker-compose.yml)
// serve the built frontend from this same process instead of running a
// separate Vite dev server - a no-op for every existing dev/prod-non-Docker
// workflow, since WEB_DIST_PATH is never set outside that container image.
const webDistPath = process.env.WEB_DIST_PATH;
if (webDistPath) {
  app.use(express.static(webDistPath));
  // SPA fallback for any non-API GET route - after the static + /api handlers above,
  // so a real 404 from either of those still wins.
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(webDistPath, "index.html"));
  });
}

export default app;
