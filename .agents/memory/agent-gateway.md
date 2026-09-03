---
name: AI Agent Gateway
description: Multi-provider agent gateway in api-server; Replit AI integrations for Anthropic+OpenAI, env-var keys for others.
---

# AI Agent Gateway

## Architecture
- `artifacts/api-server/src/agents/types.ts` — shared types (AgentConfig, ChatMessage, AgentResponse, etc.)
- `artifacts/api-server/src/agents/defaults.ts` — 6 built-in agents + in-memory custom agent CRUD
- `artifacts/api-server/src/agents/gateway.ts` — routes to Anthropic SDK or OpenAI SDK
- `artifacts/api-server/src/agents/store.ts` — in-memory metrics + conversation history (up to 50 per agent)
- `artifacts/api-server/src/routes/agentRoster.ts` — REST endpoints; mounted BEFORE agentsRouter in index.ts

## Key config
- CLAUDE (anthropic): uses `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` + `AI_INTEGRATIONS_ANTHROPIC_API_KEY`
- GPT-4o (openai): uses `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY`
- GEMINI: needs `GEMINI_API_KEY`; routes to openai SDK at `https://generativelanguage.googleapis.com/v1beta/openai/`
- OPENROUTER: needs `OPENROUTER_API_KEY`; routes to openai SDK at `https://openrouter.ai/api/v1`
- LOCAL (ollama): no key; routes to openai SDK at `http://localhost:11434/v1`
- MINIMAX: needs `MINIMAX_API_KEY`; routes to openai SDK at `https://api.minimax.chat/v1`

**Why:** Replit AI integrations for Anthropic and OpenAI mean no API key config needed for those two providers. All others use env vars. Gateway tries integration env vars first, then falls back to provider-specific env vars.

**How to apply:** When adding new providers, follow the openai SDK pattern in gateway.ts — add to PROVIDER_URLS and envMap, then add default config in defaults.ts.

## Frontend
- `artifacts/khameleon-command/src/lib/agentsApi.ts` — typed API client with offline fallbacks
- `artifacts/khameleon-command/src/pages/agents.tsx` — sub-nav shell with 6 sub-tabs
- Sub-pages: Roster, AgentChat, MultiAgent, Compare, Council, AgentSettings
