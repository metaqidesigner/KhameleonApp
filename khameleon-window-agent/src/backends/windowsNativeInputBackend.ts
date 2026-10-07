import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ClickTarget, InputBackend, WindowHandle } from "../types";

const run = promisify(execFile);

/**
 * Real click/type for third-party (external) windows on Windows, via
 * PowerShell's built-in .NET automation primitives (System.Windows.Forms
 * cursor/SendKeys, user32.dll mouse_event via P/Invoke) - the direct
 * Windows equivalent of macNativeInputBackend.ts's AppleScript approach,
 * same "shell out to the OS's own scripting layer" strategy, no new
 * native addon (Cross-App Control Phase 2, khameleon-decisions-log.md,
 * 2026-10-03). `execFile` (not a shell string) so arbitrary typed text
 * can't be interpreted as a command.
 */
export class WindowsNativeInputBackend implements InputBackend {
  async click(_handle: WindowHandle, target: ClickTarget): Promise<void> {
    if (!target.point) {
      throw new Error("Windows native click needs absolute screen coordinates (a CSS selector only works for browser windows).");
    }
    const x = Math.round(target.point.x);
    const y = Math.round(target.point.y);
    await this.powershell(`
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})
      Add-Type @"
using System;
using System.Runtime.InteropServices;
public class KhameleonMouse {
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
}
"@
      [KhameleonMouse]::mouse_event(0x0002, 0, 0, 0, 0) # MOUSEEVENTF_LEFTDOWN
      [KhameleonMouse]::mouse_event(0x0004, 0, 0, 0, 0) # MOUSEEVENTF_LEFTUP
    `);
  }

  async type(handle: WindowHandle, target: ClickTarget | null, text: string): Promise<void> {
    if (target) await this.click(handle, target);
    await this.powershell(`
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.SendKeys]::SendWait(${powerShellQuote(sendKeysEscape(text))})
    `);
  }

  private async powershell(script: string): Promise<void> {
    await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]);
  }
}

/** SendKeys treats + ^ % ~ ( ) { } [ ] as special - wrap each in braces to send it literally. */
function sendKeysEscape(value: string): string {
  return value.replace(/[+^%~(){}[\]]/g, (ch) => `{${ch}}`);
}

/** PowerShell single-quoted string literal: only ' itself needs escaping (doubled). */
function powerShellQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
