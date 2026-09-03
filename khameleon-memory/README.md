# khameleon-memory

Khameleon's persistent memory layer: remembered facts/preferences,
searchable notes, and learned routines (recorded demonstrations) other
modules can replay. Task **#13** on the backlog — and it also covers
**#10 (Local notes storage)**, since notes turned out to be a natural
part of the same model rather than a separate system.

## Why this exists

Both earlier modules assume something remembers what's been taught:
window-agent's Phase 3 concept ("show it how it's done") and file-agent's
`planSort()` design both need a place to store what was learned. This
module is that place — a storage substrate the other modules build on,
without needing to know anything about window bounds or file paths
itself.

## Design choices worth knowing about

**Routines are intentionally opaque.** A `Routine`'s `steps` field is
typed `unknown[]` — this module has no idea what a "Command" looks like
in window-agent or file-agent, and it shouldn't. Each module can save its
own typed command sequences here and cast them back on the way out. That
keeps this module a dependency of the others, never the other way
around.

**Two storage backends behind one interface.** `InMemoryStorage` for
tests and ephemeral use, `JsonFileStorage` for real persistence. Writes
are atomic — `save()` writes to a temp file and renames it over the real
one, so a crash mid-write can never leave a half-written, corrupted
memory file on disk.

**Search is a simple token-overlap ranker, not a database.** No SQLite,
no native dependency (deliberately — see the window-agent module's
README for why that's worth avoiding when it can be). `scoreMatch()`
counts shared words between query and text, with a bonus for exact
phrase matches, good enough for a personal memory store's scale.

## What's actually implemented

- **`src/search.ts`** — `tokenize`, `scoreMatch`, `rank` — pure functions.
- **`src/storage/inMemoryStorage.ts`** / **`jsonFileStorage.ts`** — the
  two `MemoryStorage` implementations.
- **`src/memoryStore.ts`** — `MemoryStore`: `remember`/`recall`/`forget`
  (facts), `saveNote`/`searchNotes` (notes), `recordRoutine`/
  `findRoutine`/`markRoutineUsed` (learned workflows).
- **`src/commands.ts`** — `parseCommand`/`CommandRunner`, same pattern as
  the other two modules: "remember my timezone is EST", "what's my
  timezone", "note: meeting moved to 3pm", "find notes about the
  meeting".

## Verified — including a second real bug the tests caught

Zero external dependencies, so — like file-agent, unlike window-agent —
this is fully verifiable in the sandbox with no stubbing required:

- `npx tsc` — compiles clean.
- `npx vitest run` — **29/29 tests passing**, including real disk
  persistence (`JsonFileStorage` round-tripping actual JSON files, a
  second independent instance reading the same file back correctly, and
  confirming no stray `.tmp` files are ever left behind).

**The test suite caught a second real bug before this was called done:**
"remember my timezone is EST" parsed the key as `"my timezone"`, but
"what's my timezone" parsed the recall key as `"timezone"` — two
different keys that never matched, so the assistant would immediately
"forget" anything you told it. The `remember -> recall round-trips`
integration test failed and exposed it; fixed by making both parsers
strip a leading "my" the same way.

This is the second module in a row where the automated tests found a
real behavioral bug before it shipped, not just a compile error — worth
noting since it's the concrete answer to "how do I know this actually
works."

## Running it for real

```bash
npm install
npm run build
```

```ts
import { MemoryStore, JsonFileStorage, CommandRunner } from "./src";

const memory = new MemoryStore(new JsonFileStorage("/Users/you/Documents/Khameleon/memory.json"));
const runner = new CommandRunner(memory);

await runner.run("remember my timezone is EST");
await runner.run("note: meeting moved to 3pm");
```

## Running the test suite (any OS)

```bash
npm install
npm test
```

## Deliberately out of scope for this slice

- Real voice/agent input — `parseCommand()` is a stand-in, same pattern
  as the other modules.
- Any UI for browsing/editing remembered facts or notes.
- Routine *replay* — this module can store and find a matching routine,
  but actually executing its `steps` back through window-agent/file-agent
  is integration work for whichever module owns those command types, not
  something this module should do (it doesn't know their shapes).
- Expiring/archiving old notes — everything persists indefinitely today.
