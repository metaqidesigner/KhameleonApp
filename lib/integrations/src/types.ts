export type Intent =
  | { kind: "window"; command: "open"; label: string; url: string }
  | { kind: "window"; command: "teleport"; preset: "enlarged" | "docked-right" | "docked-left" | "corner" }
  | { kind: "window"; command: "close" }
  | { kind: "file"; command: "create-folder" | "move-file" | "trash-file" | "sort-folder" | "open-app" | "quit-app"; value: string; destination?: string }
  | { kind: "memory"; command: "remember" | "recall" | "save-note" | "search-notes"; key?: string; value?: string };

export interface IntentResolver {
  resolve(text: string): Promise<Intent>;
}

export interface IntegrationResult {
  intent: Intent;
  message: string;
}
