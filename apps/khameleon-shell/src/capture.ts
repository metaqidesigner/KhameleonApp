import { app, desktopCapturer, shell, systemPreferences } from "electron";
import * as path from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { windowManager } from "node-window-manager";
import { frontWindowTitle, needsTitleFallback } from "./windowTitle";
import { extractDocumentText } from "@khameleon/integrations";
import type { Bounds } from "khameleon-window-agent";
import { startRecorder, type CapturedAction } from "./inputHelper";

/**
 * Capture (docs/build-review.md, Build 4): records the task the user does so
 * Khameleon can turn it into a skill. While recording it notes which app and
 * window the user moves through and, when the Mac's Screen Recording
 * permission is allowed, takes a snapshot of each window and reads its text
 * (on this computer). Snapshots stay in a temporary folder and are deleted
 * once the skill is saved or the capture is discarded. Khameleon's own
 * windows are ignored.
 */

export interface CaptureStep {
  at: number;
  app: string;
  title: string;
  /** Full recording: the clicks and typing done in this window (by element name, never positions). */
  actions?: CapturedAction[];
  /** Text read from the window's snapshot, if snapshots are allowed. */
  text?: string;
  note?: string;
}

export interface CaptureStatus {
  state: "idle" | "recording" | "paused" | "processing";
  steps: number;
  currentApp?: string;
  currentTitle?: string;
  snapshotsAllowed: boolean;
  /** Clicks and typing are being recorded too (not just windows). */
  fullRecording: boolean;
  /** Why clicks/typing aren't being recorded, if they aren't. */
  fullRecordingNote?: string;
}

const POLL_MS = 1000;
const RESNAP_MS = 10_000; // re-snapshot the same window this often while it changes
const MAX_STEPS = 60;

function appName(p: string): string {
  const base = (p || "").split(/[\\/]/).filter(Boolean).find((seg) => /\.app$|\.exe$/i.test(seg)) ?? (p || "").split(/[\\/]/).pop() ?? "";
  return base.replace(/\.(app|exe)$/i, "");
}

function isOwnWindow(p: string): boolean {
  return /Electron\.app|Khameleon(\.app|\.exe)?/i.test(p || "") || p === process.execPath;
}

export class CaptureSession {
  private state: CaptureStatus["state"] = "idle";
  private steps: CaptureStep[] = [];
  private snapshots: { step: number; file: string }[] = [];
  private timer: NodeJS.Timeout | null = null;
  private dir = "";
  private last: { app: string; title: string; snappedAt: number } | null = null;
  private stopRecorder: (() => void) | null = null;
  private fullNote: string | undefined;

  constructor(
    private onUpdate: (status: CaptureStatus) => void,
    /** Draws the light-blue "Recording" glow around the window being recorded. */
    private glow: { show: (bounds: Bounds) => void; hide: () => void },
  ) {}

  snapshotsAllowed(): boolean {
    return process.platform !== "darwin" || systemPreferences.getMediaAccessStatus("screen") === "granted";
  }

  /** Opens the Mac setting where Screen Recording is allowed. */
  openSnapshotSettings(): void {
    if (process.platform === "darwin") void shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
  }

  status(): CaptureStatus {
    return {
      state: this.state,
      steps: this.steps.length,
      currentApp: this.last?.app,
      currentTitle: this.last?.title,
      snapshotsAllowed: this.snapshotsAllowed(),
      fullRecording: !!this.stopRecorder && !this.fullNote,
      fullRecordingNote: this.fullNote,
    };
  }

  /** Opens the Mac setting where clicks/typing recording is allowed. */
  openInputSettings(): void {
    if (process.platform === "darwin") void shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent");
  }

  /** A click/typing step from the recorder: attached to the window step it happened in. */
  private onAction(a: CapturedAction): void {
    if (this.state !== "recording") return; // paused: nothing recorded
    let step = this.steps[this.steps.length - 1];
    if (!step || (a.app && step.app !== a.app)) {
      if (this.steps.length >= MAX_STEPS) return;
      step = { at: Date.now(), app: a.app, title: a.window };
      this.steps.push(step);
      this.last = { app: a.app, title: a.window, snappedAt: 0 };
    }
    (step.actions ??= []).push(a);
    if (step.actions.length > 200) step.actions.shift();
    this.emit();
  }

  async start(): Promise<CaptureStatus> {
    if (this.state === "recording" || this.state === "paused") return this.status();
    await this.discard();
    this.dir = path.join(app.getPath("temp"), `khameleon-capture-${Date.now()}`);
    await mkdir(this.dir, { recursive: true });
    this.state = "recording";
    this.fullNote = undefined;
    this.stopRecorder = startRecorder(a => this.onAction(a), note => { this.fullNote = note; this.emit(); });
    if (!this.stopRecorder) this.fullNote = process.platform === "darwin" ? "The click and typing recorder isn't available - only windows are noted." : "Recording clicks and typing works on a Mac only for now.";
    let sampling = false; // reading a window title or snapshot can take most of a second
    this.timer = setInterval(() => {
      if (sampling) return;
      sampling = true;
      void this.sample().finally(() => { sampling = false; });
    }, POLL_MS);
    this.emit();
    return this.status();
  }

  pause(): CaptureStatus {
    if (this.state === "recording") { this.state = "paused"; this.glow.hide(); }
    this.emit();
    return this.status();
  }

  resume(): CaptureStatus {
    if (this.state === "paused") this.state = "recording";
    this.emit();
    return this.status();
  }

  addNote(note: string): CaptureStatus {
    const text = note.trim();
    if (text) {
      if (this.steps.length) {
        const s = this.steps[this.steps.length - 1];
        s.note = s.note ? `${s.note} ${text}` : text;
      } else {
        this.steps.push({ at: Date.now(), app: "", title: "", note: text });
      }
    }
    this.emit();
    return this.status();
  }

  /** Stops recording and reads the snapshots' text. Returns the steps for writing up. */
  async stop(): Promise<CaptureStep[]> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stopRecorder?.(); this.stopRecorder = null;
    await new Promise(r => setTimeout(r, 300)); // let the last typing arrive
    this.glow.hide();
    this.state = "processing";
    this.emit();
    for (const snap of this.snapshots) {
      try {
        const { text } = await extractDocumentText(snap.file);
        const step = this.steps[snap.step];
        const cleaned = text.replace(/\s+/g, " ").trim().slice(0, 1500);
        if (step && cleaned) step.text = step.text ? `${step.text}\n${cleaned}` : cleaned;
      } catch {
        // A snapshot that can't be read just means less detail for that step.
      }
    }
    const steps = this.steps;
    this.state = "idle";
    this.emit();
    return steps;
  }

  /** Deletes snapshots and forgets the capture. */
  async discard(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stopRecorder?.(); this.stopRecorder = null;
    this.glow.hide();
    if (this.dir) await rm(this.dir, { recursive: true, force: true }).catch(() => undefined);
    this.dir = "";
    this.steps = [];
    this.snapshots = [];
    this.last = null;
    if (this.state !== "idle") { this.state = "idle"; this.emit(); }
  }

  private emit(): void {
    this.onUpdate(this.status());
  }

  private async sample(): Promise<void> {
    if (this.state !== "recording") return;
    let win;
    try { win = windowManager.getActiveWindow(); } catch { return; }
    if (!win || isOwnWindow(win.path)) return;
    const appLabel = appName(win.path);
    let title = win.getTitle() || "";
    if (needsTitleFallback(appLabel, title)) title = (await frontWindowTitle()) || title;
    if (!appLabel && !title) return; // e.g. the desktop itself - nothing worth a step
    const bounds = win.getBounds() as Bounds;
    const now = Date.now();
    const changed = !this.last || this.last.app !== appLabel || this.last.title !== title;
    this.glow.show(bounds);
    if (changed && this.steps.length < MAX_STEPS) {
      this.steps.push({ at: now, app: appLabel, title });
      this.last = { app: appLabel, title, snappedAt: 0 };
      this.emit();
    }
    if (this.last && now - this.last.snappedAt > (changed ? 0 : RESNAP_MS)) {
      this.last.snappedAt = now;
      await this.snapshot(title, this.steps.length - 1);
    }
  }

  private async snapshot(title: string, step: number): Promise<void> {
    if (!this.snapshotsAllowed() || !this.dir) return;
    try {
      const sources = await desktopCapturer.getSources({ types: ["window"], thumbnailSize: { width: 1600, height: 1000 } });
      const src = sources.find((s) => s.name === title) ?? sources.find((s) => title && s.name.includes(title));
      if (!src || src.thumbnail.isEmpty()) return;
      const file = path.join(this.dir, `step-${step}-${Date.now()}.png`);
      await writeFile(file, src.thumbnail.toPNG());
      this.snapshots.push({ step, file });
    } catch {
      // No snapshot this time; the window title and app are still recorded.
    }
  }
}
