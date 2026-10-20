import { app } from "electron";
import * as path from "node:path";
import { existsSync } from "node:fs";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";

/**
 * Talks to Khameleon's own input helper (native/mac/KhameleonInput.swift):
 * records clicks and typing by UI element name, and replays a step by
 * finding the named element again. Mac only for now.
 */
export type CapturedAction =
  | { type: "click"; app: string; window: string; role: string; label: string; at: number }
  | { type: "type"; app: string; window: string; role: string; label: string; text: string; at: number }
  | { type: "key"; app: string; window: string; key: string; at: number }
  | { type: "secure"; app: string; window: string; label: string; at: number };

export function helperPath(): string | null {
  if (process.platform !== "darwin") return null;
  // Next to the compiled app (dist/native) - the app ships as a plain folder, not an archive.
  const p = path.join(__dirname.replace(/app\.asar([\\/])/, "app.asar.unpacked$1"), "native", "khameleon-input");
  return existsSync(p) ? p : null;
}

export function helperCheck(): Promise<{ accessibility: boolean; inputMonitoring: boolean } | null> {
  const p = helperPath();
  if (!p) return Promise.resolve(null);
  return new Promise(resolve => execFile(p, ["check"], { timeout: 5000 }, (err, out) => {
    try { resolve(err ? null : JSON.parse(out)); } catch { resolve(null); }
  }));
}

/** Starts recording; calls onAction for each click/typing step. Returns a stop function. */
export function startRecorder(onAction: (a: CapturedAction) => void, onProblem: (message: string) => void): (() => void) | null {
  const p = helperPath();
  if (!p) return null;
  const child: ChildProcess = spawn(p, ["record"], { stdio: ["ignore", "pipe", "ignore"] });
  const rl = createInterface({ input: child.stdout! });
  rl.on("line", line => {
    try {
      const msg = JSON.parse(line) as { type: string; message?: string; inputMonitoring?: boolean };
      if (msg.type === "error") onProblem(msg.message ?? "Clicks and typing can't be recorded.");
      else if (msg.type === "ready") { if (!msg.inputMonitoring) onProblem("Typing can't be recorded until Input Monitoring is allowed."); }
      else if (["click", "type", "key", "secure"].includes(msg.type)) onAction(msg as CapturedAction);
    } catch { /* ignore partial lines */ }
  });
  child.on("error", () => onProblem("The recorder couldn't start."));
  return () => { try { child.kill("SIGTERM"); } catch { /* already stopped */ } };
}

/** Replays one recorded step by finding its named element. */
export function replayStep(step: CapturedAction): Promise<{ ok: boolean; message: string }> {
  const p = helperPath();
  if (!p) return Promise.resolve({ ok: false, message: "Replaying recorded steps works on a Mac only for now." });
  return new Promise(resolve => execFile(p, ["replay", JSON.stringify(step)], { timeout: 20000 }, (err, out) => {
    try { resolve(JSON.parse(out)); } catch { resolve({ ok: false, message: err ? "The step couldn't be replayed." : "No answer from the replay helper." }); }
  }));
}
