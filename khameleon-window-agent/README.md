# khameleon-window-agent

Khameleon's window-management layer: move/resize/reposition desktop
windows and spawn/close animated floating widgets. This is the piece that
implements the original example — "bring up a YouTube video enlarged,
then move it aside" — and does it for both windows Khameleon spawns
itself *and* third-party app windows already open on the desktop.

Built as scaffolding for task **#6 — Window teleport + floating widgets**
from the Khameleon backlog, using the same underlying library
(`node-window-manager`, MIT) that IRIS-AI's "Teleport Windows" feature is
built on — see the earlier comparison for why that library specifically.

## What's actually implemented

- **`src/layouts.ts`** — pure functions computing target bounds for four
  presets (`enlarged`, `docked-right`, `docked-left`, `corner`) given a
  screen work area. No OS calls; fully unit-tested.
- **`src/tween.ts`** — the animation engine: smoothly interpolates a
  window's bounds from A to B over time with easing, so "move aside"
  glides and shrinks instead of jumping instantly. Platform-agnostic —
  it doesn't know or care whether it's driving an Electron window or an
  external OS window.
- **`src/windowController.ts`** — the single API the rest of Khameleon
  talks to: `createWidget()`, `teleport()`, `closeWidget()`,
  `findExternal()`. Hides which backend owns a given window.
- **`src/backends/electronWidgetBackend.ts`** — controls windows
  Khameleon spawns itself (e.g. a floating YouTube player), via
  Electron's `BrowserWindow`.
- **`src/backends/externalWindowBackend.ts`** — controls windows
  Khameleon did *not* spawn (an already-open browser, Notes, whatever),
  via `node-window-manager`. This is the "reach out and control any
  window on the desktop" capability.
- **`src/commands.ts`** — a small, explicit intent parser (`parseCommand`)
  and a `CommandRunner` that remembers "the last widget I opened" so
  follow-ups like "move it aside" don't need to name the window again.
  This is a deliberately dumb, testable stand-in for what will
  eventually be an LLM-driven intent layer — swap the parser, keep
  everything downstream of it.
- **`src/main.ts` / `src/preload.ts` / `src/widget/control-panel.html`**
  — a minimal Electron app wiring it all together, with a small
  always-on-top text box standing in for voice/agent input during
  development.

## What's stubbed, and why

`node-window-manager` ships native bindings that only build on Windows
and macOS. It can't install in a Linux sandbox, so verification here
used a local ambient type declaration
(`src/types/node-window-manager.d.ts`) to typecheck against its real
public API without the native addon present. On your actual macOS
machine, a normal `npm install` pulls in the real package — nothing in
the application code needs to change.

## Verified so far

- `npx tsc` — compiles clean, zero errors, across the whole tree
  including the Electron-facing files.
- `npx vitest run` — **18/18 tests passing**, covering:
  - all four layout presets, including a non-zero screen origin
    (multi-monitor safe)
  - the tween engine (starts exactly at the source bounds, ends exactly
    at the target, respects cancellation)
  - the exact scenario from the original ask, end to end: open YouTube
    enlarged → confirm it's genuinely larger → "move it aside" → confirm
    it shrank and docked to the right screen edge

What's **not** yet verified because it needs a real display and macOS:
actually seeing a window move on screen, the accessibility permission
prompt, and controlling a real third-party app window.

## Running it for real (macOS)

```bash
npm install          # pulls the real node-window-manager, builds its native addon
npm run build         # tsc
npm run dev            # builds, then launches the Electron app
```

On first run, macOS will prompt for an Accessibility permission the
first time `ExternalWindowBackend` tries to move a window it didn't
spawn — grant it in System Settings → Privacy & Security → Accessibility.

Type into the control panel:

```
bring up a youtube video
move it aside
enlarge it
close it
```

## Running the test suite (any OS)

```bash
npm install
npm test
```

## What's deliberately out of scope for this slice

- Real voice/agent input — `parseCommand()` is a stand-in.
- More than four layout presets — add to `layouts.ts` + its tests as
  real use cases show up.
- Multi-monitor window placement beyond "use the primary display" — the
  layout math already supports arbitrary screen origins, `main.ts` just
  doesn't pick a monitor yet.
- Windows/Linux-specific `node-window-manager` quirks — only macOS has
  been reasoned through here (accessibility permission flow).
