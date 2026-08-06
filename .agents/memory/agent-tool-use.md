---
name: Agent Tool-Use Architecture
description: How the Khameleon agentic loop works — tools, DB persistence, SSE events, and session tracking.
---

## Architecture

### Tool pipeline
- `agents/tools/definitions.ts` — Anthropic tool JSON schemas (9 tools: read_file, write_file, list_files, run_build, run_command, git_status, git_log, check_workflow, read_logs)
- `agents/tools/shell.ts` — async implementations; all file I/O scoped to `path.resolve(process.cwd(), '../..')` (the monorepo root). Block `.env`, `/proc`, `/sys`, `/etc/shadow`, `.git/objects`.
- `agents/tools/dispatcher.ts` — security gate: whitelist enforcement before any exec. `run_command` blocks shell metacharacters (`;&|`$`).

### Agentic loop (gateway.ts)
- Only runs for `agent.useTools === true` (currently only `claude` / Anthropic provider).
- Non-streaming multi-turn loop: call → check stop_reason → if `tool_use`, execute tools via dispatcher, append results, loop; if `end_turn`, emit text via onToken in 6-char chunks.
- MAX_ITERATIONS = 10 to prevent runaway loops.
- Collects `ToolCallRecord[]` for DB persistence and SSE reporting.

### SSE tool events
- Route emits `{ tool_event: ToolEvent }` SSE frames during the loop.
- Frontend `streamAgentChat` accepts optional `onToolEvent` callback (6th arg) and optional `sessionId` (7th arg).
- AgentChat.tsx inserts `tool_event` message bubbles before the streaming assistant message; bubbles are expandable to show input/result.

### DB persistence (agent_conversations table)
- Schema: `lib/db/src/schema/agent_conversations.ts`
- Rows: one `user` row + N `tool_use`/`tool_result` pairs + one `assistant` row per exchange
- Fire-and-forget write in `store.ts::persistConversation`; errors logged, never thrown
- Route: `GET /api/agent-conversations?agentId=&sessionId=&limit=`
- Also `GET /api/agent-conversations/sessions` for distinct session summaries

### Session continuity
- Route generates UUID `sessionId` per POST unless client sends one in body
- SSE `done` event includes `sessionId` and `toolCallCount`
- AgentChat.tsx persists `sessionId` in `sessionIdRef` and sends it back on next turn
- Clear chat resets sessionIdRef

**Why:** Each turn needs the same sessionId so the Memory page can group messages into readable conversation threads.

**How to apply:** When adding a new agent chat surface, pass `sessionIdRef.current` as the 7th arg to `streamAgentChat`; update on `done`.
