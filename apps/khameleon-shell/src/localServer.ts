/**
 * The all-in-one app (download decisions, 2026-10-20): Khameleon's server runs
 * inside the desktop app as a hidden helper (an Electron utility process), with
 * its built-in database and everything else in Khameleon's own folder. No
 * Docker, no separate database program, no Khameleon-run servers.
 *
 * The encryption key (it locks saved logins, outside AI keys and sign-ins) is
 * made on first run and kept locked by the computer's own keychain (Electron
 * safeStorage: the Mac Keychain / Windows' protected storage). The user can
 * show or save it as a recovery key, and enter it on a new computer.
 */
import { app, safeStorage, utilityProcess, type UtilityProcess } from "electron";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const FIRST_PORT = 4319;

/** Khameleon's own folder - everything the all-in-one app keeps lives here. */
export function khameleonHome(): string {
  return app.getPath("userData");
}

const keyFile = () => path.join(khameleonHome(), "encryption-key.locked");
const serverDataDir = () => path.join(khameleonHome(), "server");
const serverPrefsFile = () => path.join(khameleonHome(), "server.json");

// ── The encryption key ───────────────────────────────────────────────────────

/** A recovery key is the encryption key itself, shown in groups so it's easier to copy. */
export function formatRecoveryKey(key: string): string {
  return Buffer.from(key, "base64").toString("hex").toUpperCase().match(/.{1,8}/g)!.join("-");
}

/** Accepts a recovery key as shown (any spacing, dashes or case). Returns the key, or null if it isn't one. Pure. */
export function parseRecoveryKey(text: string): string | null {
  const hex = text.replace(/[^0-9a-f]/gi, "");
  return /^[0-9a-f]{64}$/i.test(hex) ? Buffer.from(hex, "hex").toString("base64") : null;
}

function writeKey(key: string): void {
  fs.mkdirSync(khameleonHome(), { recursive: true });
  // Without keychain support (some Linux set-ups) the key is still only readable by this user.
  const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(key) : Buffer.from(`plain:${key}`);
  fs.writeFileSync(keyFile(), data, { mode: 0o600 });
}

function readKey(): string | null {
  if (!fs.existsSync(keyFile())) return null;
  const data = fs.readFileSync(keyFile());
  if (data.subarray(0, 6).toString() === "plain:") return data.subarray(6).toString();
  return safeStorage.decryptString(data);
}

/** Is there data from before but no key (e.g. restored onto a new computer)? Then ask for the recovery key. */
export function needsRecoveryKey(): boolean {
  return !fs.existsSync(keyFile()) && fs.existsSync(path.join(serverDataDir(), "database"));
}

/** The key, made on first run. */
export function encryptionKey(): string {
  const existing = readKey();
  if (existing) return existing;
  const key = crypto.randomBytes(32).toString("base64");
  writeKey(key);
  return key;
}

/** Shown in Settings → Security → Recovery key. */
export function recoveryKey(): string {
  return formatRecoveryKey(encryptionKey());
}

/** Use a recovery key from another computer. Returns false if the text isn't a recovery key. */
export function useRecoveryKey(text: string): boolean {
  const key = parseRecoveryKey(text);
  if (!key) return false;
  writeKey(key);
  return true;
}

// ── The server ───────────────────────────────────────────────────────────────

function portIsFree(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.listen(port, "127.0.0.1", () => s.close(() => resolve(true)));
  });
}

/** The same port every time (the app's saved layout is tied to its address), unless something else took it. */
async function choosePort(): Promise<number> {
  let saved: number | undefined;
  try { saved = JSON.parse(fs.readFileSync(serverPrefsFile(), "utf8")).port; } catch { /* first run */ }
  for (const p of [saved ?? FIRST_PORT, ...Array.from({ length: 20 }, (_, i) => FIRST_PORT + i)]) {
    if (await portIsFree(p)) {
      if (p !== saved) fs.writeFileSync(serverPrefsFile(), JSON.stringify({ port: p }, null, 2));
      return p;
    }
  }
  throw new Error("Khameleon couldn't find a free connection on this computer.");
}

let server: UtilityProcess | null = null;
let stopping = false;

/** Where the packaged server, screens and table set-up live (copied in by build.mjs). */
const bundled = (name: string) => path.join(__dirname, name);

async function waitUntilReady(url: string, timeoutMs: number): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const r = await fetch(`${url}/api/healthz`);
      if (r.ok) return;
    } catch { /* not yet */ }
    if (!server) throw new Error("Khameleon's server stopped while starting.");
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error("Khameleon's server took too long to start.");
}

/** Starts the built-in server and resolves with its address once it answers. */
export async function startLocalServer(): Promise<string> {
  const port = await choosePort();
  const logDir = path.join(khameleonHome(), "logs");
  fs.mkdirSync(logDir, { recursive: true });
  fs.mkdirSync(serverDataDir(), { recursive: true });
  const log = fs.createWriteStream(path.join(logDir, "server.log"), { flags: "a" });

  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    NODE_ENV: "production",
    PORT: String(port),
    KHAMELEON_HOST: "127.0.0.1",
    KHAMELEON_DATA_DIR: serverDataDir(),
    KHAMELEON_HOME: khameleonHome(),
    KHAMELEON_MIGRATIONS_DIR: bundled("migrations"),
    WEB_DIST_PATH: bundled("web"),
    KHAMELEON_ENCRYPTION_KEY: encryptionKey(),
  };
  delete env.DATABASE_URL; // always the built-in database

  server = utilityProcess.fork(bundled("server/index.mjs"), [], { env, stdio: "pipe", serviceName: "Khameleon server" });
  server.stdout?.pipe(log);
  server.stderr?.pipe(log);
  server.on("exit", code => {
    log.write(`\n[desktop app] server exited (${code})\n`);
    server = null;
    if (!stopping) console.error(`Khameleon's server stopped unexpectedly (${code}) - see ${path.join(logDir, "server.log")}`);
  });

  const url = `http://localhost:${port}`;
  await waitUntilReady(url, 90_000);
  return url;
}

/** Asks the server to close its database cleanly, then makes sure it has stopped. */
export function stopLocalServer(): Promise<void> {
  const s = server;
  if (!s) return Promise.resolve();
  stopping = true;
  return new Promise(resolve => {
    const done = () => { clearTimeout(t); resolve(); };
    const t = setTimeout(() => { s.kill(); resolve(); }, 4000);
    s.once("exit", done);
    s.postMessage({ type: "shutdown" });
  });
}

/** Restarts the server (e.g. after a recovery key was entered). */
export async function restartLocalServer(): Promise<string> {
  await stopLocalServer();
  stopping = false;
  return startLocalServer();
}

/** Settings → "Remove all my Khameleon data": deletes Khameleon's folder (the app quits first). */
export function removeAllData(): void {
  fs.rmSync(khameleonHome(), { recursive: true, force: true });
}
