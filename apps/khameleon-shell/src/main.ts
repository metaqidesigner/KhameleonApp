import { app, BrowserWindow, ipcMain, screen } from "electron";
import * as path from "node:path";
import { FileOps, CommandRunner as FileCommandRunner, MacAppLauncher } from "khameleon-file-agent";
import { JsonFileStorage, MemoryStore, CommandRunner as MemoryCommandRunner } from "khameleon-memory";
import {
  WindowController,
  CommandRunner as WindowCommandRunner,
  ElectronWidgetBackend,
  ExternalWindowBackend,
  ElectronOverlayBackend,
  BrowserInputBackend,
  MacNativeInputBackend,
  WindowsNativeInputBackend,
  type Bounds,
  type IndicatorState,
} from "khameleon-window-agent";
import { LocalAgentRunner, LocalDocumentAgent, extractDocumentText } from "@khameleon/integrations";

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

let permissionRequestSeq = 0;

/**
 * "Khameleon would like to observe/control [App] — Allow?" (Newton's own
 * description, Cross-App Control Phase 1). A small, fully Khameleon-
 * controlled modal (never loads remote/user content), so relaxing
 * sandboxing just for it to talk back over IPC is a contained trade-off,
 * not a general precedent - every other window in this app stays sandboxed.
 */
function requestObservePermission(appLabel: string, state: IndicatorState): Promise<boolean> {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const verb = state === "controlling" ? "control" : "observe";
  const channel = `khameleon:permission-reply:${permissionRequestSeq++}`;

  return new Promise((resolve) => {
    const modal = new BrowserWindow({
      width: 380,
      height: 180,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false },
    });

    let settled = false;
    const finish = (allowed: boolean) => {
      if (settled) return;
      settled = true;
      ipcMain.removeHandler(channel);
      if (!modal.isDestroyed()) modal.close();
      resolve(allowed);
    };

    ipcMain.handle(channel, (_event, allowed: boolean) => finish(allowed));
    modal.on("closed", () => finish(false));

    modal.loadURL(`data:text/html,${encodeURIComponent(`<!doctype html>
<html><body style="margin:0;background:rgba(8,14,24,0.98);color:#e6e6e6;font-family:-apple-system,sans-serif;height:100vh;box-sizing:border-box;padding:20px;display:flex;flex-direction:column;justify-content:space-between;">
  <div>
    <div style="font-size:14px;font-weight:600;">Khameleon would like to ${verb}:</div>
    <div style="font-size:15px;margin-top:6px;color:#6FE6BD;">${escape(appLabel)}</div>
  </div>
  <div style="display:flex;gap:10px;justify-content:flex-end;">
    <button onclick="require('electron').ipcRenderer.invoke('${channel}', false)"
      style="padding:8px 16px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:none;color:#e6e6e6;cursor:pointer;">Deny</button>
    <button onclick="require('electron').ipcRenderer.invoke('${channel}', true)"
      style="padding:8px 16px;border-radius:6px;border:none;background:#6FE6BD;color:#06110c;font-weight:600;cursor:pointer;">Allow</button>
  </div>
</body></html>`)}`);
  });
}

function failureHtml(url: string, reason: string): string {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<!doctype html><html><body style="background:#0b0f14;color:#e6e6e6;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:24px;box-sizing:border-box;">
    <div><h2>Can't reach Khameleon</h2><p>Tried to load <code>${escape(url)}</code> and got: ${escape(reason)}</p>
    <p>Make sure your Khameleon instance (e.g. the Docker container from SELF_HOSTING.md) is running, then reload.</p></div>
  </body></html>`;
}

app.whenReady().then(() => {
  const externalBackend = new ExternalWindowBackend();
  // Triggers the real macOS Accessibility permission dialog on first run if
  // needed; a no-op on Windows (ExternalWindowBackend's own doc comment).
  externalBackend.requestAccessibility();

  const widgetBackend = new ElectronWidgetBackend();
  // "Simulate a user" (Phase 2): one browser backend (CDP, for Khameleon's
  // own spawned widget windows) and one native backend chosen by platform
  // (AppleScript on macOS, PowerShell on Windows, for third-party windows).
  const nativeInputBackend = process.platform === "win32" ? new WindowsNativeInputBackend() : new MacNativeInputBackend();

  const windowController = new WindowController(
    { widget: widgetBackend, external: externalBackend },
    currentScreenArea,
    new ElectronOverlayBackend(),
    {
      browser: new BrowserInputBackend((handle) => widgetBackend.getWebContents(handle)),
      native: nativeInputBackend,
    },
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
  const localAgent = new LocalAgentRunner(
    {
      window: new WindowCommandRunner(windowController, requestObservePermission),
      file: new FileCommandRunner(new FileOps(fileRoot), new MacAppLauncher()),
      memory: new MemoryCommandRunner(memory),
    },
    undefined,
    undefined,
    undefined,
    // read_document tool's real implementation - reuses the same
    // extraction LocalDocumentAgent uses. Fine for non-sensitive documents:
    // its result goes to Claude's cloud API like any other tool_result,
    // which is exactly why LocalDocumentAgent stays a separate channel for
    // anything flagged sensitive (Cross-App Control Phase 4,
    // khameleon-decisions-log.md, 2026-10-04).
    async (filePath) => (await extractDocumentText(filePath)).text,
  );

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

  // Deliberately a SEPARATE channel, not a tool LocalAgentRunner can call
  // (Cross-App Control Phase 3, khameleon-decisions-log.md, 2026-10-03).
  // LocalAgentRunner's loop sends every tool result back to Anthropic's
  // cloud API on the next iteration - routing a sensitive document through
  // it as a "tool" would send the extracted content (or a close paraphrase
  // of it) to the cloud anyway, exactly what local/sensitive mode exists to
  // prevent. This channel never touches localAgent or the Anthropic SDK at
  // all; the renderer calls it directly when the user has flagged a
  // document as sensitive, bypassing cloud Claude entirely for that
  // interaction.
  const localDocumentAgent = new LocalDocumentAgent();
  ipcMain.handle("khameleon:read-document-locally", async (_event, filePath: unknown, question: unknown) => {
    if (typeof filePath !== "string" || !filePath.trim()) throw new Error("A non-empty file path is required.");
    if (typeof question !== "string" || !question.trim()) throw new Error("A non-empty question is required.");
    return localDocumentAgent.answerAboutDocument(filePath, question);
  });

  // Same separate-from-cloud-Claude channel family as above. Structured,
  // not free-text, for tax/accounting use - a JSON-schema grammar
  // constrains the local model's output so it's always valid, not just
  // plausible-looking (Cross-App Control, khameleon-decisions-log.md,
  // 2026-10-03, added the same day once a scanned-receipt gap turned out
  // to block something Newton considers critical).
  ipcMain.handle("khameleon:extract-receipt-locally", async (_event, filePath: unknown) => {
    if (typeof filePath !== "string" || !filePath.trim()) throw new Error("A non-empty file path is required.");
    return localDocumentAgent.extractReceiptDetails(filePath);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
