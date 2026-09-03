import { app, BrowserWindow, ipcMain, screen } from "electron";
import * as path from "node:path";
import { FileOps, CommandRunner as FileCommandRunner, MacAppLauncher } from "khameleon-file-agent";
import { JsonFileStorage, MemoryStore, CommandRunner as MemoryCommandRunner } from "khameleon-memory";
import { WindowController, CommandRunner as WindowCommandRunner, type Bounds } from "khameleon-window-agent";
import { ElectronWidgetBackend } from "khameleon-window-agent/src/backends/electronWidgetBackend";
import { ExternalWindowBackend } from "khameleon-window-agent/src/backends/externalWindowBackend";
import { LocalAgentRunner } from "@khameleon/integrations";

let controlPanel: BrowserWindow | null = null;

function currentScreenArea(): Bounds {
  return screen.getPrimaryDisplay().workArea;
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
  // requiring two separate commands.
  const localAgent = new LocalAgentRunner({
    window: new WindowCommandRunner(windowController),
    file: new FileCommandRunner(new FileOps(fileRoot), new MacAppLauncher()),
    memory: new MemoryCommandRunner(memory),
  });

  controlPanel = new BrowserWindow({
    width: 520,
    height: 220,
    alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true },
  });
  controlPanel.loadFile(path.join(__dirname, "control-panel.html"));

  ipcMain.handle("khameleon:command", async (_event, text: unknown) => {
    if (typeof text !== "string" || !text.trim()) throw new Error("A non-empty command is required.");
    return localAgent.run(text);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
