# Prompt for Claude Code — Build Khameleon

Copy everything below into Claude Code in the project directory where
`Khameleon_v1_Scope.md` and the three module folders
(`khameleon-window-agent/`, `khameleon-file-agent/`, `khameleon-memory/`)
have been placed. Claude Code should read those files before writing any
new code — they contain real, already-verified work this prompt builds on.

---

## What Khameleon is

Khameleon is an agent platform for individual knowledge workers that
automates their work by operating the apps they already use every day —
email, CRM, spreadsheets, project trackers, internal tools — the same
way a person would: reading screens, clicking, typing, navigating. It
does not ask anyone to migrate to a new system or change their existing
process. The name is the pitch: it adapts to whatever environment it's
dropped into, rather than making the environment adapt to it.

Full positioning, competitive landscape, cost model, and phased build
plan are in `Khameleon_v1_Scope.md` in this project — **read it before
doing anything else.** It also contains a "Competitive update" section
on Grok Bot (xAI/Cursor's very similar product, launched Aug 2026) and
a "Build log" section describing exactly what's been built so far and
why — both relevant to decisions you'll need to make below.

## What already exists — read these before writing new code

Three standalone, independently verified TypeScript modules already
exist in this project. Each has its own `README.md` explaining what it
does, what design decisions were made and why, and — importantly —
**exactly what was and wasn't verified, and why**. Read each README in
full before touching that module's code.

1. **`khameleon-window-agent/`** — moves/resizes/repositions desktop
   windows and spawns/closes animated floating widgets (e.g. "bring up
   a YouTube video enlarged" → "move it aside"). Built on
   `node-window-manager` (native macOS/Windows bindings — this is the
   one module that could not be fully verified outside of macOS).
2. **`khameleon-file-agent/`** — open/close apps, create/organize
   folders, copy/move/delete files (delete defaults to a recoverable
   trash, not permanent), rule-based "smart drop zone" auto-sorting.
   Zero external dependencies; fully verified against real disk I/O.
3. **`khameleon-memory/`** — remembered facts/preferences, searchable
   notes, and a `Routine` store (recorded demonstrations) that the other
   modules can plug replay logic into later for the "learn by
   demonstration" concept in the scope doc's Phase 3. Zero external
   dependencies; fully verified including real persistence to disk.

All three follow the same architecture on purpose — **match it exactly**
in anything new you build:

- **Pure logic separated from I/O.** Anything that doesn't need to
  touch the OS (layout math, tween/animation curves, search ranking,
  path-safety checks) is a pure function with zero dependencies, fully
  unit-tested. Anything that does touch the OS (Electron windows,
  native window control, `child_process`, `fs`) sits behind a small,
  explicit interface (`WindowBackend`, `AppLauncher`, `MemoryStorage`)
  so it can be swapped for a fake in tests.
- **`parseCommand()` is a deliberate placeholder, not a real agent
  brain.** Each module has an explicit, regex-based, non-LLM command
  parser. This is intentional — it's the seam where real agent
  reasoning gets wired in later without the execution layer beneath it
  needing to change. Don't treat these as throwaway; extend the pattern
  consistently rather than replacing it ad hoc.
- **Destructive operations default to safe/recoverable.** File deletes
  go to a hidden trash folder, not `rm`. Any new capability that can
  destroy user data should follow the same default, with a genuinely
  permanent option requiring explicit, non-command-triggerable
  confirmation (see `khameleon-file-agent/src/fileOps.ts`).
- **Everything that touches the filesystem is scoped to an explicit
  root and path-guarded against traversal** (see
  `khameleon-file-agent/src/safety.ts` — `assertWithinRoot`). Reuse or
  mirror this for any new module that touches disk.
- **Real verification, not assumed verification.** Every module was
  actually built (`tsc`) and actually tested (`vitest run`) before being
  called done, and each README says so with the pass/fail counts. Two
  real bugs were caught this way (a silently-lowercased folder name, and
  a fact-storage key mismatch that made "remember X" and "recall X"
  silently disagree) — both fixed because the tests, not just the code
  review, caught them. Hold new code to the same bar: write it, build
  it, test it, and report honestly what could and couldn't be verified
  in your environment (e.g. anything needing a real display or a real
  macOS accessibility permission grant).

## Immediate priorities, in order

1. **Integration layer.** Nothing currently wires these three modules
   together into one running app. Build a single Electron shell (reuse
   `khameleon-window-agent/src/main.ts` as the starting point — it
   already has the Electron scaffolding) that:
   - Instantiates all three modules' controllers/stores
   - Replaces each module's placeholder `parseCommand()` with a real
     intent layer backed by the Claude API (Messages API, tool use) —
     the individual `Command` types each module already exports are
     good candidates for tool schemas
   - Wires `khameleon-memory`'s `Routine` store to actually record and
     replay sequences of commands across the other two modules (this
     was explicitly left undone — see that module's README)
   - Builds toward the dashboard UI already designed (see
     `Khameleon_v1_Scope.md`): Overview/Work mode/Agents/Research tabs,
     live agent activity feed, system status (queries, latency, cost,
     energy per query), wake phrase "Hello Khameleon", swappable model
     backend (Claude/GPT-4o).
2. **#11 — Research agent.** Powers the "Research" tab already in the
   dashboard design. Should follow the scope doc's hybrid execution
   model: API-first where available, browser/computer-use fallback
   otherwise.
3. **#12 — Multi-agent orchestration.** Powers the "Agents" tab.
   Coordinate multiple specialist agents in parallel, per the scope
   doc's Phase 4 description.
4. **#8 — Terminal & dev tools control** and **#9 — Screen OCR / inline
   coding assist.** Lower priority — see "Ask before assuming" below,
   this depends on a positioning question that hasn't been resolved.

## Ask before assuming — don't silently pick a direction on these

Four scope decisions were deliberately left open rather than guessed at.
**Ask the user directly before building toward any of these**, the same
way this prompt is asking you to read existing context before acting:

- **Lifestyle utilities** (Spotify control, weather, maps, stock
  tickers) — in scope or explicitly excluded? The working assumption in
  the scope doc is "excluded, stay work-automation focused," but this
  hasn't been confirmed.
- **Mobile device control** (remote Android) — in scope, or desktop/web
  only for the foreseeable future?
- **Security vault** (local PIN/biometric lock) — worth building now, or
  is credential/session scoping (already a flagged risk in the scope
  doc) the higher priority to solve first?
- **Terminal & dev tools control** (#8) — is Khameleon's audience
  developers specifically, or knowledge workers broadly? This changes
  whether #8/#9 are worth building at all.

## Constraints that matter for a commercial product

- **Open-source licensing.** MIT/Apache-2.0 dependencies are fine for
  commercial use but require keeping copyright/license notices attached
  — maintain a `THIRD_PARTY_LICENSES.md` as dependencies are added, not
  as an afterthought before launch. Do not use IRIS-AI's or
  ethanplusai/jarvis's code directly — the latter is explicitly
  non-commercial-licensed; treat both as prior art/reference only, not
  as a source to copy from. `node-window-manager` (MIT, standalone) is
  the one dependency already adopted directly, and that's the right
  model going forward: depend on the underlying maintained library, not
  on a hobby app's wrapper around it.
- **No JARVIS/Iron Man branding, ever**, including as an easter egg —
  every open-source project this was benchmarked against explicitly
  disclaims Marvel affiliation because they're free fan projects; that
  protection does not extend to a commercial product.
- **macOS is the primary target platform** for now (Electron +
  AppleScript/`osascript` + `node-window-manager`'s native bindings).
  Cross-platform support is future work, not a v1 requirement.

## Definition of done

For any new module or feature: it builds clean (`tsc`), it has a real,
executable test suite that passes (`vitest run` or equivalent) covering
the actual behavior (not just "it compiles"), it has a README stating
plainly what was and wasn't verified and why, and any decision that
changes user-facing scope (not just implementation detail) gets asked
about rather than assumed. Match the existing three modules' bar — don't
lower it for speed.
