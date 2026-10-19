import { execFile } from "child_process";
import { promisify } from "util";
import { AppLauncher } from "./types";

const run = promisify(execFile);

/** Everyday app names → the program Windows knows them by. */
const PROGRAMS: Record<string, string> = {
  excel: "excel", word: "winword", outlook: "outlook", powerpoint: "powerpnt", onenote: "onenote",
  teams: "ms-teams", "microsoft teams": "ms-teams", edge: "msedge", "microsoft edge": "msedge",
  chrome: "chrome", "google chrome": "chrome", firefox: "firefox", notepad: "notepad",
  calculator: "calc", calc: "calc", "file explorer": "explorer", explorer: "explorer", paint: "mspaint",
};

/** "Microsoft Excel" / "Excel" / "excel.exe" → "excel". Pure. */
export function windowsProgram(appName: string): string {
  const name = appName.trim().toLowerCase().replace(/\.exe$/, "");
  return PROGRAMS[name] ?? PROGRAMS[name.replace(/^microsoft\s+/, "")] ?? name;
}

/** Calculator and new Teams are Store apps: their running process has a different name. */
const PROCESS: Record<string, string> = { calc: "CalculatorApp", "ms-teams": "ms-teams" };

/**
 * Real Windows implementation: Start-Process to launch (finds Office and
 * other installed apps by their registered name), CloseMainWindow for a
 * clean quit (like choosing Close - the app can still ask to save), and
 * Get-Process to check state. The app name is passed to PowerShell in an
 * environment variable, never inside the command text.
 */
export class WindowsAppLauncher implements AppLauncher {
  async open(appName: string): Promise<void> {
    await ps("Start-Process -FilePath $env:KHAMELEON_APP", windowsProgram(appName));
  }

  async quit(appName: string): Promise<void> {
    const p = windowsProgram(appName);
    await ps("Get-Process -Name $env:KHAMELEON_APP -ErrorAction Stop | ForEach-Object { [void]$_.CloseMainWindow() }", PROCESS[p] ?? p);
  }

  async isRunning(appName: string): Promise<boolean> {
    const p = windowsProgram(appName);
    try {
      await ps("Get-Process -Name $env:KHAMELEON_APP -ErrorAction Stop | Out-Null", PROCESS[p] ?? p);
      return true;
    } catch {
      return false;
    }
  }
}

async function ps(command: string, app: string): Promise<void> {
  await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { env: { ...process.env, KHAMELEON_APP: app }, windowsHide: true });
}
