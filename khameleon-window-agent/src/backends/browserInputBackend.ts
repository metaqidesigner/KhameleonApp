import type { WebContents } from "electron";
import { ClickTarget, InputBackend, WindowHandle } from "../types";

/**
 * Real click/type for Khameleon's own spawned browser windows (widgets),
 * via Chrome DevTools Protocol - Electron ships this built in
 * (webContents.debugger), so no new native dependency is needed at all.
 * Deliberately scoped to windows Khameleon itself opened, not the user's
 * own already-running Chrome: a real third-party browser only exposes CDP
 * if launched with --remote-debugging-port, which the user's everyday
 * browser almost never is, and relaunching it to add that flag would lose
 * their open tabs/session - a real platform constraint, not an oversight
 * (Cross-App Control Phase 2, khameleon-decisions-log.md, 2026-10-03).
 */
export class BrowserInputBackend implements InputBackend {
  constructor(private getWebContents: (handle: WindowHandle) => WebContents) {}

  async click(handle: WindowHandle, target: ClickTarget): Promise<void> {
    const wc = this.attached(handle);
    const point = target.point ?? (target.selector ? await this.resolveSelectorCenter(wc, target.selector) : null);
    if (!point) throw new Error("No click target: pass a point or a selector that resolves to an element.");

    for (const type of ["mousePressed", "mouseReleased"] as const) {
      await wc.debugger.sendCommand("Input.dispatchMouseEvent", {
        type,
        x: point.x,
        y: point.y,
        button: "left",
        clickCount: 1,
      });
    }
  }

  async type(handle: WindowHandle, target: ClickTarget | null, text: string): Promise<void> {
    if (target) await this.click(handle, target);
    const wc = this.attached(handle);
    for (const char of text) {
      await wc.debugger.sendCommand("Input.dispatchKeyEvent", { type: "char", text: char });
    }
  }

  async readText(handle: WindowHandle, selector: string): Promise<string> {
    const wc = this.getWebContents(handle);
    // Form fields keep typed text in .value, not as rendered innerText -
    // found this the hard way testing a real <input> (Cross-App Control
    // Phase 2, khameleon-decisions-log.md, 2026-10-03).
    return wc.executeJavaScript(`
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return "";
        if ("value" in el) return el.value;
        return el.innerText ?? "";
      })()
    `);
  }

  private attached(handle: WindowHandle): WebContents {
    const wc = this.getWebContents(handle);
    if (!wc.debugger.isAttached()) wc.debugger.attach("1.3");
    return wc;
  }

  private async resolveSelectorCenter(
    wc: WebContents,
    selector: string
  ): Promise<{ x: number; y: number } | null> {
    return wc.executeJavaScript(`
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()
    `);
  }
}
