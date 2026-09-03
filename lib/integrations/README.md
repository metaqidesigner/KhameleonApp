# Khameleon integrations

This package composes the three verified Khameleon modules behind one execution boundary:

- `ClaudeIntentResolver` turns a request into one validated, structured capability intent using Claude tool use.
- `KhameleonCoordinator` routes that intent through the existing window, file, or memory command runner.
- Module instances remain injected, so tests can use fake window/app backends and in-memory storage.

The coordinator preserves the module guardrails: file commands use the path-scoped `FileOps` implementation and destructive text intents map to recoverable trash, while window placement remains behind `WindowController`.

## Verification

- `pnpm --filter khameleon-window-agent run build` — passes.
- `pnpm --filter khameleon-file-agent run build` — passes.
- `pnpm --filter khameleon-memory run build` — passes.
- `pnpm --filter @khameleon/integrations run build` — passes.
- `pnpm --filter @khameleon/integrations run test` — 3/3 passing.

Claude API calls are not made by the test suite. Set `ANTHROPIC_API_KEY` and optionally `ANTHROPIC_MODEL` when constructing `ClaudeIntentResolver` in a running shell. Electron/native window movement remains subject to the window-agent README's macOS accessibility requirement.
