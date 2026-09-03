export interface FileEntry {
  path: string;
  name: string;
  isDirectory: boolean;
}

/** A rule for "smart drop zone" auto-sorting: files matching `match` move to `destination`. */
export interface DropZoneRule {
  /** Human label, e.g. "Screenshots" */
  label: string;
  /** Matches against the filename (case-insensitive). */
  match: RegExp;
  /** Destination folder, relative to the watched drop zone root. */
  destination: string;
}

export interface SortPlanEntry {
  file: FileEntry;
  rule: DropZoneRule | null; // null = no rule matched, left in place
  destinationPath: string | null;
}

/** Something that can launch/quit a named application. Kept behind an
 * interface so the decision logic (command parsing) is testable without
 * actually spawning processes. */
export interface AppLauncher {
  open(appName: string): Promise<void>;
  quit(appName: string): Promise<void>;
  isRunning(appName: string): Promise<boolean>;
}

/** Raised when an operation would touch a path outside the configured
 * safe root, or would be a permanent delete without explicit confirmation. */
export class SafetyError extends Error {}
