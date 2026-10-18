import { execFile } from "node:child_process";
import { windowManager } from "node-window-manager";
import { frontWindowTitle, needsTitleFallback } from "./windowTitle";
import { emailFromWindow, type Bounds, type IndicatorState, type MailClient } from "khameleon-window-agent";

/**
 * Email assistant, desktop side (docs/build-review.md, Build 4 answers +
 * Build 9 open-email detection). Notices when a mail window is in front and
 * which email is open in it, and tells the page so it can offer help beside
 * that window. Draws the email window's glow when the page asks.
 *
 * Which email: from the window title where it says (webmail, and emails
 * opened in their own window); on a Mac, Apple Mail and Outlook are asked
 * which message is selected (the Mac asks the user once to allow this).
 * Nothing is read until the page asks for it, and only the selected email.
 */

export interface OpenEmail {
  client: MailClient;
  app: string;
  /** The window, in the overlay's own coordinates. */
  bounds: Bounds;
  subject: string | null;
  sender?: string;
  unread?: boolean;
  receivedAt?: string;
}

const POLL_MS = 1500;
const SELECTION_MS = 3000;

function appName(p: string): string {
  const base = (p || "").split(/[\\/]/).filter(Boolean).find((seg) => /\.app$|\.exe$/i.test(seg)) ?? (p || "").split(/[\\/]/).pop() ?? "";
  return base.replace(/\.(app|exe)$/i, "");
}

function isOwnWindow(p: string): boolean {
  return /Electron\.app|Khameleon(\.app|\.exe)?/i.test(p || "") || p === process.execPath;
}

function osascript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("osascript", ["-e", script], { timeout: 8000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => (err ? reject(err) : resolve(stdout)));
  });
}

const SEP = "\u001f"; // between fields, so subjects with line breaks or commas survive

function selectionScript(client: "mail" | "outlook", withBody: boolean): string {
  if (client === "mail") {
    return `tell application "Mail"
  set sel to selection
  if (count of sel) is 0 then return ""
  set m to item 1 of sel
  set ago to ((current date) - (date received of m)) as integer
  set out to (subject of m) & "${SEP}" & (sender of m) & "${SEP}" & ((read status of m) as string) & "${SEP}" & (ago as string)
  ${withBody ? `set out to out & "${SEP}" & (content of m)` : ""}
  return out
end tell`;
  }
  return `tell application "Microsoft Outlook"
  set sel to selected objects
  if (count of sel) is 0 then return ""
  set m to item 1 of sel
  set s to sender of m
  set out to (subject of m) & "${SEP}" & (name of s) & " <" & (address of s) & ">" & "${SEP}" & ((is read of m) as string) & "${SEP}" & ""
  ${withBody ? `set out to out & "${SEP}" & (plain text content of m)` : ""}
  return out
end tell`;
}

interface Selected { subject: string; sender: string; unread: boolean; receivedAt?: string; body?: string }

async function readSelection(client: "mail" | "outlook", withBody: boolean): Promise<Selected | null> {
  const out = (await osascript(selectionScript(client, withBody))).replace(/\n$/, "");
  if (!out) return null;
  const [subject, sender, read, secondsAgo, ...rest] = out.split(SEP);
  const ago = secondsAgo ? Number(secondsAgo) : NaN;
  return {
    subject: subject ?? "", sender: sender ?? "", unread: read !== "true",
    receivedAt: Number.isFinite(ago) && ago >= 0 ? new Date(Date.now() - ago * 1000).toISOString() : undefined,
    body: withBody ? rest.join(SEP) : undefined,
  };
}

export class EmailWatcher {
  private timer: NodeJS.Timeout | null = null;
  private current: OpenEmail | null = null;
  private lastKey = "";
  private lastSelectionAt = 0;
  private selection: Selected | null = null;
  private selectionFailed = false;
  private glowState: IndicatorState | null = null;
  private glowShown = false;
  private screenBounds: Bounds | null = null;

  constructor(
    private onChange: (email: OpenEmail | null) => void,
    private overlayOrigin: () => { x: number; y: number },
    private glow: { show: (b: Bounds, s: IndicatorState) => void; update: (b: Bounds) => void; setState: (s: IndicatorState) => void; hide: () => void },
  ) {}

  start(): void {
    if (this.timer) return;
    let polling = false; // a poll can take most of a second (window title, mail app)
    this.timer = setInterval(() => {
      if (polling) return;
      polling = true;
      void this.poll().finally(() => { polling = false; });
    }, POLL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.set(null);
  }

  get(): OpenEmail | null {
    return this.current;
  }

  /** The page asks for the email's glow (light blue while reading, white while its card is showing). */
  setGlow(state: IndicatorState | null): void {
    this.glowState = state;
    if (!state || !this.screenBounds) {
      if (this.glowShown) this.glow.hide();
      this.glowShown = false;
      return;
    }
    if (this.glowShown) this.glow.setState(state);
    else { this.glow.show(this.screenBounds, state); this.glowShown = true; }
  }

  /** The selected email's text, read from Apple Mail/Outlook on a Mac (when there's no Outlook/Gmail connection to use). */
  async readOpenEmail(): Promise<{ subject: string; from: string; body: string } | null> {
    const c = this.current;
    if (!c || process.platform !== "darwin" || (c.client !== "mail" && c.client !== "outlook")) return null;
    try {
      const s = await readSelection(c.client, true);
      return s?.body ? { subject: s.subject, from: s.sender, body: s.body } : null;
    } catch {
      return null;
    }
  }

  private set(email: OpenEmail | null): void {
    const key = email ? `${email.client}|${email.subject ?? ""}|${email.sender ?? ""}` : "";
    const boundsChanged = !!email && !!this.current && JSON.stringify(email.bounds) !== JSON.stringify(this.current.bounds);
    this.current = email;
    if (!email && this.glowShown) { this.glow.hide(); this.glowShown = false; this.glowState = null; }
    if (key !== this.lastKey) {
      this.lastKey = key;
      if (this.glowShown) { this.glow.hide(); this.glowShown = false; this.glowState = null; } // a different email: the page decides again
      this.onChange(email);
    } else if (boundsChanged) {
      this.onChange(email);
    }
  }

  private async poll(): Promise<void> {
    let win;
    try { win = windowManager.getActiveWindow(); } catch { return; }
    if (!win) return;
    // Clicking Khameleon's own card shouldn't make the email "go away".
    if (isOwnWindow(win.path)) return;
    const app = appName(win.path);
    let title = win.getTitle() || "";
    if (needsTitleFallback(app, title)) title = (await frontWindowTitle()) || title;
    const info = emailFromWindow(app, title);
    if (!info) { this.selection = null; this.set(null); return; }

    const screen = win.getBounds() as Bounds;
    this.screenBounds = screen;
    if (this.glowShown) this.glow.update(screen);
    const o = this.overlayOrigin();
    const bounds = { x: screen.x - o.x, y: screen.y - o.y, width: screen.width, height: screen.height };

    let subject = info.subject;
    let sender: string | undefined;
    let unread: boolean | undefined;
    let receivedAt: string | undefined;
    // The reading pane: ask the Mac mail app which message is selected.
    if (!subject && process.platform === "darwin" && (info.client === "mail" || info.client === "outlook") && !this.selectionFailed) {
      if (Date.now() - this.lastSelectionAt >= SELECTION_MS) {
        this.lastSelectionAt = Date.now();
        try { this.selection = await readSelection(info.client, false); }
        catch { this.selection = null; this.selectionFailed = info.client === "outlook"; } // new Outlook for Mac can't be asked
      }
      if (this.selection) ({ subject, sender, unread, receivedAt } = this.selection);
    }
    this.set({ client: info.client, app, bounds, subject: subject || null, sender, unread, receivedAt });
  }
}
