import { app, BrowserWindow, ipcMain, screen } from "electron";
import * as path from "node:path";
import { FileOps, CommandRunner as FileCommandRunner, MacAppLauncher } from "khameleon-file-agent";
import { JsonFileStorage, MemoryStore, CommandRunner as MemoryCommandRunner } from "khameleon-memory";
import {
  WindowController,
  CommandRunner as WindowCommandRunner,
  ElectronWidgetBackend,
  ExternalWindowBackend,
  type Bounds,
} from "khameleon-window-agent";
import { LocalAgentRunner } from "@khameleon/integrations";

// The real product UI, not a side scaffold (khameleon-decisions-log.md,
// 2026-10-03, Cross-App Control Phase 0). Khameleon is already a working
// web app serving itself and its API from one origin (SELF_HOSTING.md) -
// session cookies, accounts, and everything built in hosted/managed mode
// already depend on that same-origin shape. Rather than re-host the built
// frontend inside Electron (which would mean re-solving cookie/session
// behavior from scratch), this shell is real app chrome around the real,
// already-running instance: point a BrowserWindow at it, same as any
// desktop wrapper (Slack, Linear) does for its own web app.
const DEFAULT_APP_URL = "http://localhost:4001";

let mainWindow: BrowserWindow | null = null;

function currentScreenArea(): Bounds {
  return screen.getPrimaryDisplay().workArea;
}

function failureHtml(url: string, reason: string): string {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<!doctype html><html><body style="background:#0b0f14;color:#e6e6e6;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:24px;box-sizing:border-box;">
    <div><h2>Can't reach Khameleon</h2><p>Tried to load <code>${escape(url)}</code> and got: ${escape(reason)}</p>
    <p>Make sure your Khameleon instance (e.g. the Docker container from SELF_HOSTING.md) is running, then reload.</p></div>
  </body></html>`;
}

app.whenReady().then(() => {
  const windowController = new WindowController(
    { widget: new ElectronWidgetBackend(), external: new ExternalWindowBackend() },
    currentScreenArea,
  );
  const fileRoot = process.env.KHAMELEON_FILE_ROOT ?? app.getPath("documents");
  const memory = new MemoryStore(new JsonFileStorage(path.join(app.getPath("userData"), "memory.json")));
  // LocalAgentRunner replaces the earlier single-shot KhameleonCoordinator
  // router: it lets Claude call window/file/memory tools multiple times in
  // one turn, so a single instruction like "open a YouTube video enlarged,
  // then move it aside" actually executes as two real actions instead of
  // requiring two separate commands. Kept wired here (not used by the real
  // frontend yet) as the foundation Phase 2-4's new window-control tools
  // plug into.
  const localAgent = new LocalAgentRunner({
    window: new WindowCommandRunner(windowController),
    file: new FileCommandRunner(new FileOps(fileRoot), new MacAppLauncher()),
    memory: new MemoryCommandRunner(memory),
  });

  const appUrl = process.env.KHAMELEON_APP_URL ?? DEFAULT_APP_URL;

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    title: "Khameleon",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true },
  });
  mainWindow.loadURL(appUrl);
  mainWindow.webContents.on("did-fail-load", (_event, _code, description) => {
    mainWindow?.loadURL(`data:text/html,${encodeURIComponent(failureHtml(appUrl, description))}`);
  });

  ipcMain.handle("khameleon:command", async (_event, text: unknown) => {
    if (typeof text !== "string" || !text.trim()) throw new Error("A non-empty command is required.");
    return localAgent.run(text);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
