# khameleon-file-agent

Khameleon's OS/file-management layer: open/close apps, create/organize
folders, copy/move/delete files, and rule-based "smart drop zone"
auto-sorting. Task **#7** on the Khameleon backlog.

## Design choices worth knowing about

**Every file operation is scoped to one root folder, with no exceptions.**
`FileOps` takes a `root` in its constructor, and every method resolves
its path through `assertWithinRoot()` before touching disk. A command
like "delete ../../../etc/passwd" throws a `SafetyError` before it ever
reaches `fs` — it can't reach outside the folder Khameleon was given
access to, full stop. This is the credential/trust guardrail called out
in the Khameleon scope doc, applied to the filesystem specifically.

**"Delete" is recoverable by default.** Text/voice commands never map to
a permanent delete — `moveToTrash()` relocates the file into a hidden
`.khameleon-trash` folder inside the same root instead of unlinking it.
Genuinely permanent deletion (`deletePermanently`) exists as a method for
higher-trust callers, but requires an explicit `confirm: true` argument
and is not reachable from `parseCommand()` at all. An autonomous agent
should not be able to make an unrecoverable mistake by default.

**"Decide" and "act" are separate steps for sorting.** `planSort()` is a
pure function — given a list of files and a rule set, it returns what
*would* move where, without touching disk. `CommandRunner` executes that
plan, but nothing stops a future version from showing the plan to the
user for confirmation before executing it, the same "confirm once" model
from the Khameleon v1 wedge.

**No external dependencies.** Unlike the window-management module, this
one only uses Node's built-in `fs`, `path`, and `child_process` — no
native bindings, so it installs and runs identically on Linux, macOS,
and Windows (the app-launcher piece is the one genuinely macOS-specific
file, see below).

## What's actually implemented

- **`src/safety.ts`** — path-containment guard used by every operation.
- **`src/fileOps.ts`** — `createFolder`, `copyFile`, `moveFile`,
  `moveToTrash`, `deletePermanently`, `listDirectory`, `exists`. Real
  `fs/promises` calls, not mocked.
- **`src/dropZones.ts`** — `planSort()` + a default rule set
  (Screenshots, Images, Documents, Spreadsheets, Archives, Installers),
  fully overridable.
- **`src/macAppLauncher.ts`** — real macOS app open/quit/isRunning via
  `open -a`, `osascript … quit` (a clean quit, not a force-kill), and
  `pgrep`. Implements the platform-agnostic `AppLauncher` interface, so
  Windows/Linux launchers can be added later without touching anything
  upstream.
- **`src/commands.ts`** — `parseCommand()` (explicit, testable, no LLM —
  same philosophy as the window-agent module) and `CommandRunner`, which
  wires parsed commands to `FileOps` and `AppLauncher`.

## Verified — for real, not just "compiles"

Unlike the window-management module, this one needs no native bindings
and no display, so almost everything here is fully verified in the
sandbox against **real disk I/O**, not mocks:

- `npx tsc` — compiles clean, zero errors.
- `npx vitest run` — **27/27 tests passing**, including:
  - the safety guard actually blocking `../` traversal and absolute
    paths outside root (`test/safety.test.ts`)
  - `createFolder`/`copyFile`/`moveFile` genuinely creating, copying,
    and moving real files in a throwaway temp directory
    (`test/fileOps.test.ts`)
  - `moveToTrash` proven recoverable — the file still exists on disk
    afterward, just relocated
  - `deletePermanently` proven to refuse running without an explicit
    `confirm: true`
  - the full "sort my Downloads" scenario end-to-end: a folder with a
    screenshot, a PDF, and an unmatched file gets two of the three
    correctly sorted into `Images`/`Documents` subfolders, the third left
    alone (`test/commands.test.ts`)
  - a real bug the test suite actually caught and I fixed before calling
    this done: the folder-name parser was silently lowercasing whatever
    name you typed ("Invoices" → "invoices") because it matched against
    a lowercased copy of the input. Fixed to match case-insensitively
    while preserving the original casing.

**Not verified here, because it needs a real Mac:** `MacAppLauncher`
actually launching/quitting a real application — `open -a` and
`osascript` don't exist on this Linux sandbox. The interface and the
command-routing logic around it are tested (via `FakeAppLauncher`); the
concrete macOS implementation itself has not been run against a real app.

## Running it for real

```bash
npm install
npm run build
```

Then wire `FileOps` (pointed at a real folder) and `MacAppLauncher`
into `CommandRunner`, same pattern as `test/commands.test.ts`:

```ts
import { FileOps, MacAppLauncher, CommandRunner } from "./src";

const runner = new CommandRunner(
  new FileOps("/Users/you/Documents/Khameleon"),
  new MacAppLauncher()
);

await runner.run("sort my Downloads");
await runner.run("open Slack");
```

## Running the test suite (any OS)

```bash
npm install
npm test
```

## Deliberately out of scope for this slice

- Real voice/agent input — `parseCommand()` is a stand-in, same as the
  window-agent module.
- Windows/Linux app launchers — only `MacAppLauncher` exists; the
  `AppLauncher` interface is ready for more.
- A live folder-watcher that runs `planSort()` automatically when a file
  lands in a drop zone — today it runs on command ("sort my Downloads"),
  not continuously. Straightforward to add on top of `dropZones.ts`
  without changing it.
- Any UI for reviewing a sort plan before it executes — `planSort()`
  already returns a plan separately from executing it, so this is a
  thin layer to add later, not a redesign.
