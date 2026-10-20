import { defineConfig } from "drizzle-kit";
import path from "path";

// `generate` (the all-in-one app's table set-up, ./migrations) needs no database;
// `push` (shared servers) does.
if (!process.env.DATABASE_URL && process.argv.includes("push")) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: path.join(__dirname, "./migrations"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
