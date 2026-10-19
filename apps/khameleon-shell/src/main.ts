import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, screen, shell, type WebContents } from "electron";
import * as path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { FileOps, CommandRunner as FileCommandRunner, MacAppLauncher, WindowsAppLauncher } from "khameleon-file-agent";
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
  ElectronPointerBackend,
  ElectronUserActivity,
  type Bounds,
  type IndicatorState,
} from "khameleon-window-agent";
import { LocalDocumentAgent, extractDocumentText, dispatchLocalTool } from "@khameleon/integrations";
import { apiBase, desktopCode, startDesktopLink } from "./desktopLink";
import { typeSavedLogin } from "./signIn";
import { replayStep, type CapturedAction } from "./inputHelper";
import { DetectionService, DEFAULT_DETECTION, type DetectionPrefs } from "./detection";
import { CaptureSession } from "./capture";
import { EmailWatcher } from "./emailWatch";

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

// Two layouts, one app (docs/build-review.md, Builds 0-2). The desktop app
// defaults to Overlay: a full-screen, see-through, always-on-top window that
// lets clicks through everywhere except Khameleon's own controls. Classic
// (the dashboard) opens in a normal window on demand. Which layout starts is
// a saved choice (DesktopPrefs below); KHAMELEON_LAYOUT=classic still forces
// Classic for a single run.
const OVERLAY_TOGGLE_SHORTCUT = "CommandOrControl+Shift+K";

// Multiple screens (docs/build-review.md, Build 2 addendum): the overlay
// follows the user to whichever screen the pointer settles on. "Settles" =
// stays on the other screen this long, so passing through on the way to a
// far corner doesn't drag Khameleon along. Pinning to the main screen is a
// saved choice; KHAMELEON_OVERLAY_DISPLAY=primary forces it for a single run.
const FOLLOW_POLL_MS = 400;
const FOLLOW_SETTLE_MS = 1200;

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;

/**
 * Choices the shell itself must know before any page loads. Saved in the
 * app's own data folder, read/written by the page over IPC (preload.ts ->
 * khameleon.prefs). Look choices (palette, icons...) live in the page.
 */
interface DesktopPrefs {
  layout: "overlay" | "classic";
  screen: "follow" | "primary";
  /** The small words on each window glow ("Reading", "Working"...). */
  glowLabels: boolean;
  /** Offer help beside an open email (docs/build-review.md, Build 4 answers). */
  emailAssistant: boolean;
  /** Automatic task detection (Build 6) - off by default. */
  detection: DetectionPrefs;
}
const DEFAULT_PREFS: DesktopPrefs = { layout: "overlay", screen: "follow", glowLabels: true, emailAssistant: true, detection: { ...DEFAULT_DETECTION } };

/** Keeps detection settings sensible (history 30 days by default; 7-90 allowed). */
function cleanDetection(d: Partial<DetectionPrefs> | undefined): DetectionPrefs {
  const x = { ...DEFAULT_DETECTION, ...(d ?? {}) };
  return {
    enabled: x.enabled === true, watchContent: x.watchContent === true,
    historyDays: Math.min(90, Math.max(7, Number(x.historyDays) || 30)),
    defaultExclusions: x.defaultExclusions !== false,
    excluded: Array.isArray(x.excluded) ? x.excluded.filter((s): s is string => typeof s === "string" && !!s.trim()).slice(0, 50) : [],
  };
}

function prefsPath() {
  return path.join(app.getPath("userData"), "khameleon-prefs.json");
}

function loadPrefs(): DesktopPrefs {
  try {
    const saved = JSON.parse(readFileSync(prefsPath(), "utf8")) as Partial<DesktopPrefs>;
    return {
      layout: saved.layout === "classic" ? "classic" : "overlay",
      screen: saved.screen === "primary" ? "primary" : "follow",
      glowLabels: saved.glowLabels !== false,
      emailAssistant: saved.emailAssistant !== false,
      detection: cleanDetection(saved.detection),
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

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
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const verb = state === "working" ? "work in" : "observe";
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

/**
 * Khameleon's windows have special abilities (preload.ts: Capture, the open
 * email, the desktop pairing code), so only Khameleon's own pages may load in
 * them. Links to anywhere else open in the user's normal browser; navigation
 * to other sites is refused (pre-launch security review, 2026-10-20).
 */
function lockToKhameleon(contents: WebContents, trustedOrigins: string[]): void {
  const trusted = (url: string) => { try { return trustedOrigins.includes(new URL(url).origin); } catch { return false; } };
  const openOutside = (url: string) => { if (/^https?:\/\//i.test(url)) void shell.openExternal(url); };
  contents.setWindowOpenHandler(({ url }) => { openOutside(url); return { action: "deny" }; });
  contents.on("will-navigate", (event, url) => { if (!trusted(url)) { event.preventDefault(); openOutside(url); } });
  contents.on("will-redirect", (event, url) => { if (!trusted(url)) { event.preventDefault(); openOutside(url); } });
}

function failureHtml(url: string, reason: string): string {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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

  // Every window glow (Khameleon working, Capture recording, the open email)
  // follows the "labels on glows" choice.
  const glowBackends = [new ElectronOverlayBackend(), new ElectronOverlayBackend(), new ElectronOverlayBackend()];
  const [controlGlowBackend, captureGlowBackend, emailGlowBackend] = glowBackends;
  const windowController = new WindowController(
    { widget: widgetBackend, external: externalBackend },
    currentScreenArea,
    controlGlowBackend,
    {
      browser: new BrowserInputBackend((handle) => widgetBackend.getWebContents(handle)),
      native: nativeInputBackend,
    },
    // The Khameleon pointer, and pausing while the user is using the mouse
    // or keyboard (docs/build-review.md, Build 4 answers).
    { pointer: new ElectronPointerBackend(), activity: new ElectronUserActivity() },
  );
  const fileRoot = process.env.KHAMELEON_FILE_ROOT ?? app.getPath("documents");
  const memory = new MemoryStore(new JsonFileStorage(path.join(app.getPath("userData"), "memory.json")));
  // The tested window/file/memory runners. The chat's AI (Khami first, on
  // the server) reaches them through the desktop link below (Build 7).
  const runners = {
    window: new WindowCommandRunner(windowController, requestObservePermission),
    file: new FileCommandRunner(new FileOps(fileRoot), process.platform === "win32" ? new WindowsAppLauncher() : new MacAppLauncher()),
    memory: new MemoryCommandRunner(memory),
  };

  const appUrl = process.env.KHAMELEON_APP_URL ?? DEFAULT_APP_URL;
  // Khameleon's own page and its server (they differ in development).
  const trustedOrigins = [...new Set([new URL(appUrl).origin, new URL(apiBase(appUrl)).origin])];

  const preload = path.join(__dirname, "preload.js");

  const openClassicWindow = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      return;
    }
    mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      title: "Khameleon",
      webPreferences: { preload, contextIsolation: true, sandbox: true },
    });
    lockToKhameleon(mainWindow.webContents, trustedOrigins);
    mainWindow.loadURL(appUrl);
    mainWindow.webContents.on("did-fail-load", (_event, _code, description) => {
      mainWindow?.loadURL(`data:text/html,${encodeURIComponent(failureHtml(appUrl, description))}`);
    });
    mainWindow.on("closed", () => { mainWindow = null; });
  };

  const prefs = loadPrefs();
  if (process.env.KHAMELEON_LAYOUT === "classic") prefs.layout = "classic";
  if (process.env.KHAMELEON_OVERLAY_DISPLAY === "primary") prefs.screen = "primary";
  let overlayDisplayId = screen.getPrimaryDisplay().id;

  const displayArea = (id: number): Bounds =>
    (screen.getAllDisplays().find(d => d.id === id) ?? screen.getPrimaryDisplay()).workArea;

  const fitOverlayToScreen = () => {
    if (!screen.getAllDisplays().some(d => d.id === overlayDisplayId)) {
      overlayDisplayId = screen.getPrimaryDisplay().id; // its screen was unplugged
    }
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.setBounds(displayArea(overlayDisplayId));
  };

  let followTimer: NodeJS.Timeout | null = null;
  const startFollowingPointer = () => {
    if (followTimer) return;
    let candidateId: number | null = null;
    let candidateSince = 0;
    followTimer = setInterval(() => {
      if (prefs.screen === "primary") return;
      if (!overlayWindow || overlayWindow.isDestroyed() || !overlayWindow.isVisible()) return;
      if (screen.getAllDisplays().length < 2) return;
      const under = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).id;
      if (under === overlayDisplayId) { candidateId = null; return; }
      const now = Date.now();
      if (under !== candidateId) { candidateId = under; candidateSince = now; return; }
      if (now - candidateSince >= FOLLOW_SETTLE_MS) {
        overlayDisplayId = under;
        candidateId = null;
        fitOverlayToScreen();
      }
    }, FOLLOW_POLL_MS);
  };

  const createOverlayWindow = () => {
    const overlay = new BrowserWindow({
      ...displayArea(overlayDisplayId),
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      hasShadow: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      title: "Khameleon Overlay",
      webPreferences: { preload, contextIsolation: true, sandbox: true },
    });
    overlayWindow = overlay;
    // "floating" sits above normal app windows without covering system UI
    // like the screen-saver level would; also follow the user across Spaces
    // and into full-screen apps.
    overlay.setAlwaysOnTop(true, "floating");
    overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    // Click-through by default; the page flips this while the pointer is
    // over its own controls (useClickThrough.ts). forward:true keeps mouse
    // movement flowing to the page so it can tell when that happens.
    overlay.setIgnoreMouseEvents(true, { forward: true });
    lockToKhameleon(overlay.webContents, trustedOrigins);
    overlay.loadURL(new URL("/overlay", appUrl).toString());
    // An unreachable server can't be shown in a click-through window -
    // fall back to the Classic window, which shows the "can't reach" page.
    overlay.webContents.on("did-fail-load", (_event, _code, _description, _url, isMainFrame) => {
      if (!isMainFrame) return;
      overlay.hide();
      openClassicWindow();
    });
    overlay.on("closed", () => { overlayWindow = null; });
  };

  const toggleOverlay = () => {
    if (prefs.layout !== "overlay") return;
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      createOverlayWindow();
      return;
    }
    if (overlayWindow.isVisible()) overlayWindow.hide();
    else overlayWindow.showInactive();
  };

  const isFromOverlay = (event: Electron.IpcMainEvent) =>
    !!overlayWindow && !overlayWindow.isDestroyed() && event.sender === overlayWindow.webContents;

  ipcMain.on("khameleon:overlay:set-interactive", (event, interactive: unknown) => {
    if (!isFromOverlay(event)) return;
    overlayWindow!.setIgnoreMouseEvents(interactive !== true, { forward: true });
  });
  ipcMain.on("khameleon:overlay:open-classic", () => openClassicWindow());
  ipcMain.on("khameleon:overlay:hide", (event) => {
    if (isFromOverlay(event)) overlayWindow!.hide();
  });

  const applyLayout = () => {
    if (prefs.layout === "classic") {
      if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close();
      openClassicWindow();
    } else if (!overlayWindow || overlayWindow.isDestroyed()) {
      createOverlayWindow();
    } else {
      overlayWindow.showInactive();
    }
  };

  const applyScreen = () => {
    if (prefs.screen === "primary") {
      overlayDisplayId = screen.getPrimaryDisplay().id;
      fitOverlayToScreen();
    }
  };

  ipcMain.handle("khameleon:prefs:get", () => ({ ...prefs }));
  ipcMain.handle("khameleon:prefs:set", (_event, patch: unknown) => {
    const p = (patch ?? {}) as Partial<DesktopPrefs>;
    const layoutChanged = (p.layout === "overlay" || p.layout === "classic") && p.layout !== prefs.layout;
    const screenChanged = (p.screen === "follow" || p.screen === "primary") && p.screen !== prefs.screen;
    if (layoutChanged) prefs.layout = p.layout!;
    if (screenChanged) prefs.screen = p.screen!;
    if (typeof p.glowLabels === "boolean" && p.glowLabels !== prefs.glowLabels) {
      prefs.glowLabels = p.glowLabels;
      for (const g of glowBackends) g.setShowLabels(p.glowLabels);
    }
    if (p.detection && typeof p.detection === "object") {
      prefs.detection = cleanDetection({ ...prefs.detection, ...p.detection });
      detection.apply();
    }
    if (typeof p.emailAssistant === "boolean" && p.emailAssistant !== prefs.emailAssistant) {
      prefs.emailAssistant = p.emailAssistant;
      if (p.emailAssistant) emailWatcher.start(); else emailWatcher.stop();
    }
    try {
      writeFileSync(prefsPath(), JSON.stringify(prefs, null, 2));
    } catch (err) {
      console.error("Couldn't save desktop preferences:", err);
    }
    if (screenChanged) applyScreen();
    // Let the reply reach the page before its own window might close.
    if (layoutChanged) setTimeout(applyLayout, 50);
    return { ...prefs };
  });

  applyLayout();
  globalShortcut.register(OVERLAY_TOGGLE_SHORTCUT, toggleOverlay);
  screen.on("display-metrics-changed", fitOverlayToScreen);
  screen.on("display-added", fitOverlayToScreen);
  screen.on("display-removed", fitOverlayToScreen);
  startFollowingPointer();

  // Clicking the dock icon (macOS) opens the Classic window - the overlay
  // itself has no dock/taskbar presence.
  app.on("activate", () => openClassicWindow());

  // ── Capture (src/capture.ts; docs/build-review.md, Build 4) ─────────────
  const captureHandle = { id: "capture", backend: "external" as const, label: "Recording" };
  let captureGlowShown = false;
  const captureGlow = {
    show: (bounds: Bounds) => {
      if (captureGlowShown) captureGlowBackend.updateBounds(captureHandle, bounds);
      else { captureGlowBackend.show(captureHandle, bounds, "recording"); captureGlowShown = true; }
    },
    hide: () => { captureGlowBackend.hide(captureHandle); captureGlowShown = false; },
  };
  const capture = new CaptureSession((status) => {
    for (const w of [overlayWindow, mainWindow]) {
      if (w && !w.isDestroyed()) w.webContents.send("khameleon:capture:update", status);
    }
  }, captureGlow);
  ipcMain.handle("khameleon:capture:status", () => capture.status());
  ipcMain.handle("khameleon:capture:start", () => capture.start());
  ipcMain.handle("khameleon:capture:pause", () => capture.pause());
  ipcMain.handle("khameleon:capture:resume", () => capture.resume());
  ipcMain.handle("khameleon:capture:note", (_e, note: unknown) => capture.addNote(typeof note === "string" ? note : ""));
  ipcMain.handle("khameleon:capture:stop", () => capture.stop());
  ipcMain.handle("khameleon:capture:discard", () => capture.discard());
  ipcMain.handle("khameleon:capture:open-settings", () => capture.openSnapshotSettings());
  ipcMain.handle("khameleon:capture:open-input-settings", () => capture.openInputSettings());

  // ── Email assistant (src/emailWatch.ts; docs/build-review.md, Build 4 answers) ──
  const emailHandle = { id: "email", backend: "external" as const, label: "Email" };
  const emailWatcher = new EmailWatcher(
    (email) => { if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send("khameleon:email:update", email); },
    () => (overlayWindow && !overlayWindow.isDestroyed() ? overlayWindow.getBounds() : { x: 0, y: 0 }),
    {
      show: (b, state) => emailGlowBackend.show(emailHandle, b, state),
      update: (b) => emailGlowBackend.updateBounds(emailHandle, b),
      setState: (state) => emailGlowBackend.updateState(emailHandle, state),
      hide: () => emailGlowBackend.hide(emailHandle),
    },
  );
  ipcMain.handle("khameleon:email:get", () => emailWatcher.get());
  ipcMain.handle("khameleon:email:glow", (_e, state: unknown) => {
    const ok: IndicatorState[] = ["visible", "reading", "observing", "working", "needs-you"];
    emailWatcher.setGlow(ok.includes(state as IndicatorState) ? (state as IndicatorState) : null);
  });
  ipcMain.handle("khameleon:email:read", () => emailWatcher.readOpenEmail());
  ipcMain.handle("khameleon:clipboard:write", (_e, text: unknown) => { if (typeof text === "string") clipboard.writeText(text); });
  for (const g of glowBackends) g.setShowLabels(prefs.glowLabels);
  if (prefs.emailAssistant) emailWatcher.start();

  // The dev control panel's command box: asks Khami on the server, which uses
  // the desktop tools through the link (no direct cloud AI call here any more).
  ipcMain.handle("khameleon:command", async (_event, text: unknown) => {
    if (typeof text !== "string" || !text.trim()) throw new Error("A non-empty command is required.");
    const res = await fetch(`${apiBase(appUrl)}/agents/khami/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: text }] }) });
    const body = (await res.json()) as { content?: string; error?: string };
    return { reply: body.content || body.error || "No answer.", toolCalls: [] };
  });

  // ── Automatic task detection (src/detection.ts; Build 6) ────────────────
  const watchGlowHandle = { id: "watch", backend: "external" as const, label: "Reading" };
  const sendDetection = () => {
    for (const w of [overlayWindow, mainWindow]) if (w && !w.isDestroyed()) w.webContents.send("khameleon:detection:update", detection.status());
  };
  const detection = new DetectionService(
    () => prefs.detection,
    async (kind, payload) => {
      await fetch(`${apiBase(appUrl)}/desktop/offer`, { method: "POST", headers: { "Content-Type": "application/json", "x-khameleon-desktop": desktopCode() }, body: JSON.stringify({ kind, ...payload }) }).catch(() => undefined);
    },
    { show: (b, s) => controlGlowBackend.show(watchGlowHandle, b, s), hide: () => controlGlowBackend.hide(watchGlowHandle) },
    sendDetection,
  );
  detection.apply();
  ipcMain.handle("khameleon:detection:status", () => detection.status());
  ipcMain.handle("khameleon:detection:pause", (_e, paused: unknown) => { detection.setPaused(paused === true); return detection.status(); });
  ipcMain.handle("khameleon:detection:silence", (_e, id: unknown) => { if (typeof id === "string") detection.silence(id); });
  ipcMain.handle("khameleon:detection:delete-history", () => { detection.deleteHistory(); return detection.status(); });

  // ── Desktop link (src/desktopLink.ts; Build 7) ──────────────────────────
  ipcMain.handle("khameleon:desktop:code", () => desktopCode());
  const loginGlowHandle = { id: "signin", backend: "external" as const, label: "Signing in" };
  // Replaying a recorded skill: the Khameleon pointer's caption, and pausing while the user is busy.
  const replayPointer = new ElectronPointerBackend();
  const replayActivity = new ElectronUserActivity();
  startDesktopLink(apiBase(appUrl), async (action, input) => {
    if (action === "window_command" || action === "file_command") return dispatchLocalTool(action, input, runners);
    if (action === "replay_step") {
      const step = input.step as CapturedAction;
      const what = step.type === "click" ? `Clicking "${step.label}" in ${step.app}`
        : step.type === "type" ? `Typing into "${step.label}" in ${step.app}`
        : step.type === "key" ? `Pressing ${step.key} in ${step.app}` : `Working in ${step.app}`;
      // Wait while the user is using the mouse or keyboard (same rule as the pointer elsewhere).
      const started = Date.now();
      while (replayActivity.isUserBusy()) {
        await replayPointer.moveTo(undefined, "Paused - you're using the computer");
        replayPointer.setCaption("Paused - you're using the computer", true);
        if (Date.now() - started > 120_000) { replayPointer.hide(); return "FAILED - paused too long while you were using the computer, so the replay stopped."; }
        await new Promise(r => setTimeout(r, 500));
      }
      await replayPointer.moveTo(undefined, what);
      replayActivity.ignoreOwnInputFor(1500 + (step.type === "type" ? step.text.length * 40 : 0));
      const r = await replayStep(step);
      return r.ok ? `DONE - ${r.message}` : `FAILED - ${r.message}`;
    }
    if (action === "replay_done") { replayPointer.hide(); return "DONE"; }
    if (action === "sign_in") {
      return typeSavedLogin(
        { loginName: String(input.loginName ?? "login"), username: String(input.username ?? ""), secret: String(input.secret ?? ""), app: String(input.app ?? "") },
        { show: (b) => controlGlowBackend.show(loginGlowHandle, b, "working"), hide: () => controlGlowBackend.hide(loginGlowHandle) },
      );
    }
    throw new Error(`The desktop app doesn't know how to "${action}".`);
  });

  // Deliberately a SEPARATE channel, not a chat tool (Cross-App Control
  // Phase 3, khameleon-decisions-log.md, 2026-10-03): a tool's result goes
  // back into the chat's conversation, which may be with an outside AI.
  // The renderer calls this directly when the user has flagged a document
  // as sensitive, so it never leaves the computer.
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

app.on("will-quit", () => globalShortcut.unregisterAll());

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
