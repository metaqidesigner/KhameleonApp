import { execFile } from "node:child_process";

/**
 * The front window's real title. Without the Mac's Screen Recording
 * permission, macOS hides other apps' window titles (only the app name comes
 * back); the Accessibility permission - which Khameleon already needs - can
 * still read it. Used by Capture and the email assistant. Windows always
 * gives the real title, so this is Mac-only.
 */
export function needsTitleFallback(appLabel: string, title: string): boolean {
  return process.platform === "darwin" && (!title || title === appLabel);
}

export function frontWindowTitle(): Promise<string> {
  return new Promise((resolve) => {
    execFile("osascript", ["-e", 'tell application "System Events" to tell (first process whose frontmost is true) to if (count of windows) > 0 then get name of front window'],
      { timeout: 3000 }, (err, stdout) => resolve(err ? "" : stdout.replace(/\n$/, "")));
  });
}
