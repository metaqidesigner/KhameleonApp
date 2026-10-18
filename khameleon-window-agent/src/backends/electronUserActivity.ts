import { powerMonitor, screen } from "electron";
import type { UserActivityMonitor } from "../types";

/**
 * Is the user using the mouse or keyboard right now? Khameleon pauses its
 * own clicking/typing while they are (docs/build-review.md, Build 4
 * answers). Uses what the OS reports without any keyboard hooks: the mouse
 * position, and the system's "time since last input". Input Khameleon
 * causes itself is ignored for the time it says it's acting.
 */
const BUSY_WINDOW_MS = 1500;
const POLL_MS = 150;

export class ElectronUserActivity implements UserActivityMonitor {
  private lastUserInputAt = 0;
  private ignoreUntil = 0;
  private lastPos = screen.getCursorScreenPoint();
  private timer: NodeJS.Timeout;

  constructor() {
    this.timer = setInterval(() => this.sample(), POLL_MS);
    this.timer.unref();
  }

  private sample(): void {
    const now = Date.now();
    const pos = screen.getCursorScreenPoint();
    const moved = pos.x !== this.lastPos.x || pos.y !== this.lastPos.y;
    this.lastPos = pos;
    if (now < this.ignoreUntil) return; // Khameleon's own input
    // Seconds since any keyboard/mouse input, system-wide.
    const idleSecs = powerMonitor.getSystemIdleTime();
    if (moved || idleSecs === 0) this.lastUserInputAt = now;
  }

  isUserBusy(): boolean {
    return Date.now() - this.lastUserInputAt < BUSY_WINDOW_MS;
  }

  ignoreOwnInputFor(ms: number): void {
    this.ignoreUntil = Math.max(this.ignoreUntil, Date.now() + ms);
  }

  dispose(): void {
    clearInterval(this.timer);
  }
}
