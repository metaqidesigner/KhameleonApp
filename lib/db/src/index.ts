import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import * as schema from "./schema";

/**
 * Two ways to store Khameleon's data:
 * - DATABASE_URL: a full PostgreSQL server (shared company servers, Docker, development).
 * - KHAMELEON_DATA_DIR: the all-in-one desktop app - a built-in PostgreSQL
 *   (PGlite) running inside Khameleon itself, kept in that folder. No separate
 *   program and no network connection.
 */
const databaseUrl = process.env.DATABASE_URL;
const dataDir = process.env.KHAMELEON_DATA_DIR;

if (!databaseUrl && !dataDir) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const builtIn = !databaseUrl ? new PGlite(path.join(dataDir!, "database")) : null;

/** True when Khameleon is using its built-in database (the all-in-one app). */
export const usingBuiltInDatabase = builtIn !== null;

// Both are PostgreSQL; queries are written once against the node-postgres type.
export const db: NodePgDatabase<typeof schema> = builtIn
  ? (drizzlePglite(builtIn, { schema }) as unknown as NodePgDatabase<typeof schema>)
  : drizzle(new pg.Pool({ connectionString: databaseUrl }), { schema });

/**
 * Creates or updates the built-in database's tables (lib/db/migrations,
 * generated from the schema with `pnpm --filter @workspace/db generate`).
 * Shared servers keep using `drizzle-kit push`, so this does nothing for them.
 */
export async function prepareBuiltInDatabase(migrationsFolder: string): Promise<void> {
  if (!builtIn) return;
  await migratePglite(drizzlePglite(builtIn, { schema }), { migrationsFolder });
}

/** Closes the built-in database cleanly (so nothing is half-written when the app quits). */
export async function closeBuiltInDatabase(): Promise<void> {
  if (builtIn && !builtIn.closed) await builtIn.close();
}

export * from "./schema";
