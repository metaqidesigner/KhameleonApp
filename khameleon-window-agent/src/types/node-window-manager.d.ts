/**
 * Ambient type declaration for `node-window-manager`.
 *
 * The real package ships native bindings (Windows/macOS only) and can't
 * install in a Linux CI/sandbox environment. This stub lets the rest of
 * the codebase typecheck anywhere; on the actual target machine (macOS),
 * `npm install` pulls in the real package and its real types, which this
 * declaration matches.
 */
declare module "node-window-manager" {
  export interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  export class Window {
    id: number;
    getTitle(): string;
    getBounds(): Bounds;
    setBounds(bounds: Partial<Bounds>): void;
  }

  export const windowManager: {
    getWindows(): Window[];
    requestAccessibility?(): void;
  };
}
