import { app, BrowserWindow, ipcMain, screen } from "electron";
import * as path from "path";
import { ElectronWidgetBackend } from "./backends/electronWidgetBackend";
import { ExternalWindowBackend } from "./backends/externalWindowBackend";
import { WindowController } from "./windowController";
import { CommandRunner } from "./commands";
import { Bounds } from "./types";

function currentScreenArea(): Bounds {
  return screen.getPrimaryDisplay().workArea;
}

let controlPanel: BrowserWindow | null = null;

app.whenReady().then(() => {
  const widgetBackend = new ElectronWidgetBackend();
  const externalBackend = new ExternalWindowBackend();
  externalBackend.requestAccessibility();

  const controller = new WindowController(
    { widget: widgetBackend, external: externalBackend },
    currentScreenArea
  );
  const runner = new CommandRunner(controller);

  // Small always-on-top control panel so you can type commands like
  // "bring up a youtube video" / "move it aside" during development,
  // before this is wired to Khameleon's actual voice/agent input.
  controlPanel = new BrowserWindow({
    width: 420,
    height: 160,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
    },
  });
  controlPanel.loadFile(path.join(__dirname, "..", "src", "widget", "control-panel.html"));

  ipcMain.handle("khameleon:command", async (_event, text: string) => {
    return runner.run(text);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
