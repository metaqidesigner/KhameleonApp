import { app, desktopCapturer, systemPreferences } from "electron";
import * as path from "node:path";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { windowManager } from "node-window-manager";
import { findRepeats, isExcluded, describePattern, type SwitchEntry, type Bounds, type IndicatorState } from "khameleon-window-agent";
import { extractDocumentText } from "@khameleon/integrations";
import { frontWindowTitle, needsTitleFallback } from "./windowTitle";

/**
 * Automatic task detection (docs/build-review.md, Build 6) - desktop side.
 * Off by default. Layer 1: a private log, on this computer only, of app and
 * window switches (no typing, snapshots or clicks), kept 30 days; repeats are
 * spotted by plain code and offered once. Layer 2 (ranking against skills and
 * procedures) happens on the server. Layer 3, content watching, has its own
 * switch: when the user stays on a window ~20 s (at most once a minute) its
 * title and visible text are read here and checked by Khami. Only ever offers.
 */

export interface DetectionPrefs { enabled: boolean; watchContent: boolean; historyDays: number; defaultExclusions: boolean; excluded: string[] }
export const DEFAULT_DETECTION: DetectionPrefs = { enabled: false, watchContent: false, historyDays: 30, defaultExclusions: true, excluded: [] };

type Offer = (kind: "repeat" | "watch", payload: Record<string, unknown>) => Promise<void>;

const isOwn = (p: string) => /Electron\.app|Khameleon(\.app|\.exe)?/i.test(p || "") || p === process.execPath;
function appName(p: string): string {
  const base = (p || "").split(/[\\/]/).filter(Boolean).find(seg => /\.app$|\.exe$/i.test(seg)) ?? (p || "").split(/[\\/]/).pop() ?? "";
  return base.replace(/\.(app|exe)$/i, "");
}

export class DetectionService {
  private log: SwitchEntry[] = [];
  private silenced = new Set<string>();
  private offered = new Set<string>();
  private poll: NodeJS.Timeout | null = null;
  private scan: NodeJS.Timeout | null = null;
  private last: { app: string; title: string; since: number } | null = null;
  private lastRead = 0;
  private readTitles = new Map<string, number>();
  private dirty = false;
  paused = false;

  constructor(private prefs: () => DetectionPrefs, private offer: Offer, private glow: { show: (b: Bounds, s: IndicatorState) => void; hide: () => void }, private onChange: () => void) {
    this.load();
  }

  private file(name: string) { return path.join(app.getPath("userData"), name); }
  private load() {
    try { this.log = JSON.parse(readFileSync(this.file("activity-log.json"), "utf8")); } catch { this.log = []; }
    try { this.silenced = new Set(JSON.parse(readFileSync(this.file("detection-silenced.json"), "utf8"))); } catch { /* none */ }
    try { this.offered = new Set(JSON.parse(readFileSync(this.file("detection-offered.json"), "utf8"))); } catch { /* none */ }
    this.prune();
  }
  private save() {
    if (!this.dirty) return;
    this.dirty = false;
    writeFileSync(this.file("activity-log.json"), JSON.stringify(this.log), { mode: 0o600 });
    writeFileSync(this.file("detection-silenced.json"), JSON.stringify([...this.silenced]), { mode: 0o600 });
    writeFileSync(this.file("detection-offered.json"), JSON.stringify([...this.offered]), { mode: 0o600 });
  }
  private prune() {
    const keep = Date.now() - this.prefs().historyDays * 86_400_000;
    const before = this.log.length;
    this.log = this.log.filter(e => e.at >= keep);
    if (this.log.length !== before) this.dirty = true;
  }

  status() {
    const p = this.prefs();
    return { enabled: p.enabled, watching: p.enabled && p.watchContent && !this.paused, paused: this.paused, logged: this.log.length, historyDays: p.historyDays };
  }

  /** "Not this one": never offer this pattern again. */
  silence(id: string) { this.silenced.add(id); this.dirty = true; this.save(); }

  /** Delete my history. */
  deleteHistory() {
    this.log = []; this.readTitles.clear();
    for (const f of ["activity-log.json"]) { const p = this.file(f); if (existsSync(p)) unlinkSync(p); }
    this.onChange();
  }

  setPaused(p: boolean) { this.paused = p; this.onChange(); }

  apply() {
    const on = this.prefs().enabled;
    if (on && !this.poll) {
      let busy = false;
      this.poll = setInterval(() => { if (busy) return; busy = true; void this.tick().finally(() => { busy = false; }); }, 2000);
      this.scan = setInterval(() => void this.findAndOffer(), 15 * 60_000);
      setTimeout(() => void this.findAndOffer(), 60_000);
    } else if (!on && this.poll) {
      clearInterval(this.poll); this.poll = null;
      if (this.scan) clearInterval(this.scan); this.scan = null;
      this.save();
    }
    this.onChange();
  }

  private async tick() {
    let win;
    try { win = windowManager.getActiveWindow(); } catch { return; }
    if (!win || isOwn(win.path)) return;
    const a = appName(win.path);
    let title = win.getTitle() || "";
    if (needsTitleFallback(a, title)) title = (await frontWindowTitle()) || title;
    const p = this.prefs();
    if (isExcluded(a, title, { defaults: p.defaultExclusions, custom: p.excluded })) { this.last = null; return; }
    const now = Date.now();
    if (!this.last || this.last.app !== a || this.last.title !== title) {
      this.last = { app: a, title, since: now };
      this.log.push({ at: now, app: a, title });
      this.dirty = true;
      if (this.log.length % 20 === 0) { this.prune(); this.save(); }
      return;
    }
    // Layer 3: the user has stayed on this window a while.
    if (p.watchContent && !this.paused && now - this.last.since >= 20_000 && now - this.lastRead >= 60_000) {
      const key = `${a}|${title}`;
      if (now - (this.readTitles.get(key) ?? 0) < 10 * 60_000) return;
      this.lastRead = now;
      this.readTitles.set(key, now);
      await this.watch(win, a, title).catch(() => undefined);
    }
  }

  private async watch(win: ReturnType<typeof windowManager.getActiveWindow>, a: string, title: string) {
    if (!win) return;
    let text = "";
    if (process.platform !== "darwin" || systemPreferences.getMediaAccessStatus("screen") === "granted") {
      this.glow.show(win.getBounds() as Bounds, "observing"); // visible while Khameleon reads it
      try {
        const sources = await desktopCapturer.getSources({ types: ["window"], thumbnailSize: { width: 1400, height: 900 } });
        const src = sources.find(s => s.name === title) ?? sources.find(s => title && s.name.includes(title.slice(0, 30)));
        if (src && !src.thumbnail.isEmpty()) {
          const dir = await mkdtemp(path.join(tmpdir(), "khameleon-watch-"));
          try {
            const f = path.join(dir, "w.png");
            await writeFile(f, src.thumbnail.toPNG());
            text = (await extractDocumentText(f)).text.replace(/\s+/g, " ").trim().slice(0, 2500);
          } finally { await rm(dir, { recursive: true, force: true }); }
        }
      } finally { setTimeout(() => this.glow.hide(), 1200); }
    }
    await this.offer("watch", { app: a, title, text });
  }

  async findAndOffer() {
    this.prune(); this.save();
    if (!this.prefs().enabled) return;
    const patterns = findRepeats(this.log, Date.now(), { minLen: 3, maxLen: 6, minDays: 3, windowDays: 14 });
    for (const pt of patterns) {
      if (this.silenced.has(pt.id) || this.offered.has(pt.id)) continue;
      this.offered.add(pt.id); this.dirty = true; this.save();
      await this.offer("repeat", { id: pt.id, description: describePattern(pt), days: pt.days.length, steps: pt.example.map(e => ({ app: e.app, title: e.title })) });
      break; // one offer at a time
    }
  }
}
