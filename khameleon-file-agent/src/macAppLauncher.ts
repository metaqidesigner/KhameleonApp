import { exec } from "child_process";
import { promisify } from "util";
import { AppLauncher } from "./types";

const run = promisify(exec);

/**
 * Real macOS implementation: `open -a` to launch, `osascript ... quit`
 * for a clean quit (not a kill -9), `pgrep` to check state. This is the
 * only file in the module that assumes an OS — everything upstream of
 * it (command parsing, decisions about what to do) is tested against
 * the AppLauncher interface, not this concrete class.
 */
export class MacAppLauncher implements AppLauncher {
  async open(appName: string): Promise<void> {
    await run(`open -a ${shellQuote(appName)}`);
  }

  async quit(appName: string): Promise<void> {
    const script = `tell application ${appleScriptQuote(appName)} to quit`;
    await run(`osascript -e ${shellQuote(script)}`);
  }

  async isRunning(appName: string): Promise<boolean> {
    try {
      await run(`pgrep -x ${shellQuote(appName)}`);
      return true;
    } catch {
      // pgrep exits non-zero when nothing matches — that's "not running", not an error.
      return false;
    }
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function appleScriptQuote(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}
