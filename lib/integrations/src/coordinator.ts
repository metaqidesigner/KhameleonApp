import { CommandRunner as FileCommandRunner } from "khameleon-file-agent";
import { CommandRunner as MemoryCommandRunner } from "khameleon-memory";
import { CommandRunner as WindowCommandRunner } from "khameleon-window-agent";
import type { Intent, IntentResolver, IntegrationResult } from "./types";

export interface Runners {
  window: WindowCommandRunner;
  file: FileCommandRunner;
  memory: MemoryCommandRunner;
}

export class KhameleonCoordinator {
  constructor(private resolver: IntentResolver, private runners: Runners) {}

  async run(text: string): Promise<IntegrationResult> {
    const intent = await this.resolver.resolve(text);
    const message = await this.execute(intent);
    return { intent, message };
  }

  private execute(intent: Intent): Promise<string> {
    switch (intent.kind) {
      case "window":
        if (intent.command === "open") return this.runners.window.run(`open youtube ${intent.label}`);
        if (intent.command === "teleport") return this.runners.window.run(`${intent.preset === "enlarged" ? "enlarge" : `move ${intent.preset}`}`);
        return this.runners.window.run("close it");
      case "file":
        if (intent.command === "create-folder") return this.runners.file.run(`create folder ${intent.value}`);
        if (intent.command === "move-file") return this.runners.file.run(`move ${intent.value} to ${intent.destination ?? "."}`);
        if (intent.command === "trash-file") return this.runners.file.run(`trash ${intent.value}`);
        if (intent.command === "sort-folder") return this.runners.file.run(`sort ${intent.value}`);
        return this.runners.file.run(`${intent.command === "open-app" ? "open" : "quit"} ${intent.value}`);
      case "memory":
        if (intent.command === "remember") return this.runners.memory.run(`remember ${intent.key ?? ""} is ${intent.value ?? ""}`);
        if (intent.command === "recall") return this.runners.memory.run(`what is my ${intent.key ?? ""}`);
        if (intent.command === "save-note") return this.runners.memory.run(`note: ${intent.value ?? ""}`);
        return this.runners.memory.run(`find notes about ${intent.value ?? intent.key ?? ""}`);
    }
  }
}
