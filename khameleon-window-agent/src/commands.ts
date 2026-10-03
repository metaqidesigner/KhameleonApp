import { WindowController } from "./windowController";
import { IndicatorState, WindowHandle } from "./types";

/**
 * A minimal, explicit intent parser for v1. This is deliberately NOT an
 * LLM call — it's the narrow, testable seam between "what the user asked
 * for" and "what the window controller does." Once Khameleon's agent
 * brain is wired in, it can replace parseCommand() with a model call that
 * still emits these same Command objects, so windowController/tests below
 * don't have to change.
 */
export type Command =
  | { type: "open-widget"; label: string; url: string }
  | { type: "teleport-last"; preset: "docked-right" | "docked-left" | "corner" | "enlarged" }
  | { type: "close-last" }
  | { type: "observe-external"; query: string; state: IndicatorState }
  | { type: "stop-observing-last" };

const YOUTUBE_SEARCH = (query: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

export function parseCommand(text: string): Command | null {
  const t = text.trim().toLowerCase();

  const bringUp = t.match(/(?:bring up|open|play|show me)\s+(?:a\s+)?youtube(?:\s+video)?(?:\s+(?:of|about|for)\s+(.+))?/);
  if (bringUp) {
    const query = bringUp[1]?.trim() || "";
    return {
      type: "open-widget",
      label: "YouTube",
      url: query ? YOUTUBE_SEARCH(query) : "https://www.youtube.com",
    };
  }

  if (/(move|push|shrink).*(aside|to the side|to one side|right)/.test(t)) {
    return { type: "teleport-last", preset: "docked-right" };
  }
  if (/(move|push|shrink).*(left)/.test(t)) {
    return { type: "teleport-last", preset: "docked-left" };
  }
  if (/(minimi[sz]e|tuck away|corner)/.test(t)) {
    return { type: "teleport-last", preset: "corner" };
  }
  if (/(enlarge|make.*bigger|expand|full size|center)/.test(t)) {
    return { type: "teleport-last", preset: "enlarged" };
  }
  if (/(close|dismiss|get rid of)/.test(t)) {
    return { type: "close-last" };
  }

  const control = t.match(/(?:take control of|control)\s+(.+)/);
  if (control) {
    return { type: "observe-external", query: control[1].trim(), state: "controlling" };
  }

  const observe = t.match(/(?:observe|watch|keep an eye on)\s+(.+)/);
  if (observe) {
    return { type: "observe-external", query: observe[1].trim(), state: "observing" };
  }

  if (/stop (observing|watching|controlling)|let go/.test(t)) {
    return { type: "stop-observing-last" };
  }

  return null;
}

/**
 * Tracks "the last widget I opened" so follow-up commands like "move it
 * aside" don't need to name the window again — matches how the user
 * actually talks to it in the original example.
 */
/** Shows the "Khameleon would like to observe/control X — Allow?" prompt
 * and resolves to the user's choice. Injected (not called directly by
 * WindowController) so this stays testable without real UI - the real
 * implementation is Electron-specific, wired in apps/khameleon-shell. */
export type PermissionPrompt = (appLabel: string, state: IndicatorState) => Promise<boolean>;

export class CommandRunner {
  private lastWidget: WindowHandle | null = null;
  private lastObserved: WindowHandle | null = null;

  constructor(
    private controller: WindowController,
    private requestPermission: PermissionPrompt = async () => true
  ) {}

  async run(text: string): Promise<string> {
    const cmd = parseCommand(text);
    if (!cmd) return `Didn't understand: "${text}"`;

    switch (cmd.type) {
      case "open-widget": {
        this.lastWidget = await this.controller.createWidget(
          { url: cmd.url, label: cmd.label, alwaysOnTop: true },
          "enlarged"
        );
        return `Opened ${cmd.label}, enlarged.`;
      }

      case "teleport-last": {
        if (!this.lastWidget) return "Nothing open to move yet.";
        await this.controller.teleport(this.lastWidget, cmd.preset);
        return `Moved ${this.lastWidget.label ?? "window"} to ${cmd.preset}.`;
      }

      case "close-last": {
        if (!this.lastWidget) return "Nothing open to close.";
        await this.controller.closeWidget(this.lastWidget);
        const closed = this.lastWidget;
        this.lastWidget = null;
        return `Closed ${closed.label ?? "window"}.`;
      }

      case "observe-external": {
        const handle = await this.controller.findExternal(cmd.query);
        if (!handle) return `Couldn't find a window matching "${cmd.query}".`;

        // Already observing this exact window - just change its state
        // (e.g. observing → controlling) without re-prompting.
        if (this.lastObserved?.id === handle.id && this.controller.isObserving(handle)) {
          this.controller.setObserveState(handle, cmd.state);
          return `Now ${cmd.state} ${handle.label ?? cmd.query}.`;
        }

        const allowed = await this.requestPermission(handle.label ?? cmd.query, cmd.state);
        if (!allowed) return `Not allowed to ${cmd.state === "controlling" ? "control" : "observe"} ${handle.label ?? cmd.query}.`;

        await this.controller.observe(handle, cmd.state);
        this.lastObserved = handle;
        return `Now ${cmd.state} ${handle.label ?? cmd.query}.`;
      }

      case "stop-observing-last": {
        if (!this.lastObserved) return "Not observing or controlling anything.";
        this.controller.stopObserving(this.lastObserved);
        const stopped = this.lastObserved;
        this.lastObserved = null;
        return `Stopped watching ${stopped.label ?? "window"}.`;
      }
    }
  }
}
