// Builds what the all-in-one app carries inside it (build.mjs copies it in):
// Khameleon's server and its screens. Plain Node so it runs the same on Mac and Windows.
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const run = (cmd, cwd, env = {}) => execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, ...env } });

run("pnpm --filter @workspace/api-server run build", repo);
// Same address for the screens and the server (no VITE_API_URL); PORT is only checked by the config.
run("pnpm exec vite build", path.join(repo, "artifacts/khameleon-command"), { PORT: "5199", BASE_PATH: "/", VITE_API_URL: "" });
