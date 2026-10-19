import { desktopCapturer, systemPreferences } from "electron";
import { execFile, spawn } from "node:child_process";
import * as path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { windowManager } from "node-window-manager";
import { extractDocumentText } from "@khameleon/integrations";

/**
 * Typing a saved login (Build 7). The server has already asked the user;
 * this brings the sign-in window to the front, types the user name, Tab,
 * the password, Return - and then looks for a "wrong password" message when
 * it can read the window. The password is typed through the native
 * keyboard (never on a command line other programs could see) and never
 * logged or returned.
 */

export interface SignInJob { loginName: string; username: string; secret: string; app: string }
export interface SignInGlow { show: (b: { x: number; y: number; width: number; height: number }) => void; hide: () => void }

const FAILED_WORDS = /(incorrect|invalid|wrong|unrecogni[sz]ed|didn'?t match|does not match) (password|user ?name|username|email|credentials|login|details)|(password|login|sign[- ]?in) (failed|incorrect|is incorrect)|try again|account (is )?locked|too many attempts/i;

/** Did the window say the sign-in failed? Pure. */
export function signInFailed(text: string): boolean {
  return FAILED_WORDS.test(text);
}

const isOwn = (p: string) => /Electron\.app|Khameleon(\.app|\.exe)?/i.test(p || "") || p === process.execPath;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function findWindow(app: string) {
  const hint = app.trim().toLowerCase();
  const wins = windowManager.getWindows().filter(w => { try { return w.isVisible() && !isOwn(w.path); } catch { return false; } });
  if (hint) {
    const hit = wins.find(w => w.path.toLowerCase().includes(hint) || (w.getTitle() || "").toLowerCase().includes(hint));
    if (hit) return hit;
  }
  const active = windowManager.getActiveWindow();
  return active && !isOwn(active.path) ? active : wins[0];
}

function macKey(code: number): Promise<void> {
  return new Promise((resolve, reject) => execFile("osascript", ["-e", `tell application "System Events" to key code ${code}`], { timeout: 5000 }, err => (err ? reject(err) : resolve())));
}

/** Windows: SendKeys through PowerShell, with the script on standard input (not the command line). Not yet tested on Windows. */
function windowsType(title: string, username: string, secret: string): Promise<void> {
  const esc = (s: string) => s.replace(/[+^%~(){}[\]]/g, "{$&}").replace(/'/g, "''");
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$ws = New-Object -ComObject WScript.Shell",
    title ? `$null = $ws.AppActivate('${title.replace(/'/g, "''")}')` : "",
    "Start-Sleep -Milliseconds 400",
    username ? `[System.Windows.Forms.SendKeys]::SendWait('${esc(username)}{TAB}')` : "",
    `[System.Windows.Forms.SendKeys]::SendWait('${esc(secret)}{ENTER}')`,
  ].filter(Boolean).join("\n");
  return new Promise((resolve, reject) => {
    const ps = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "-"], { stdio: ["pipe", "ignore", "pipe"] });
    ps.on("error", reject);
    ps.on("exit", code => (code === 0 ? resolve() : reject(new Error("The sign-in couldn't be typed."))));
    ps.stdin.end(script);
  });
}

async function readWindowText(title: string): Promise<string | null> {
  if (process.platform === "darwin" && systemPreferences.getMediaAccessStatus("screen") !== "granted") return null;
  const sources = await desktopCapturer.getSources({ types: ["window"], thumbnailSize: { width: 1600, height: 1000 } });
  const src = sources.find(s => s.name === title) ?? sources.find(s => title && s.name.includes(title.slice(0, 30)));
  if (!src || src.thumbnail.isEmpty()) return null;
  const dir = await mkdtemp(path.join(tmpdir(), "khameleon-signin-"));
  try {
    const file = path.join(dir, "window.png");
    await writeFile(file, src.thumbnail.toPNG());
    return (await extractDocumentText(file)).text;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function typeSavedLogin(job: SignInJob, glow: SignInGlow): Promise<string> {
  const win = findWindow(job.app);
  if (!win) return "FAILED - there's no sign-in window open. Open the sign-in page first.";
  const title = win.getTitle() || "";
  const where = title || path.basename(win.path);
  try {
    win.bringToTop();
    glow.show(win.getBounds() as { x: number; y: number; width: number; height: number });
    await sleep(500);
    if (process.platform === "win32") {
      await windowsType(title, job.username, job.secret);
    } else {
      if (job.username) {
        if (!windowManager.simulateTypeText?.(job.username)) return "FAILED - this computer doesn't allow Khameleon to type yet (check the Accessibility permission).";
        await macKey(48); // Tab
      }
      windowManager.simulateTypeText?.(job.secret);
      await macKey(36); // Return
    }
  } finally {
    job.secret = "";
  }
  await sleep(5000);
  glow.hide();
  const after = await readWindowText(win.getTitle() || title).catch(() => null);
  if (after && signInFailed(after)) return `FAILED - the "${job.loginName}" login didn't work in ${where} (the page said the details weren't accepted).`;
  return after
    ? `DONE - signed in to ${where} with your "${job.loginName}" login.`
    : `DONE - typed your "${job.loginName}" login into ${where}. Khameleon couldn't read the page to confirm it worked - if it didn't, the login may need updating in Settings > Credentials.`;
}
