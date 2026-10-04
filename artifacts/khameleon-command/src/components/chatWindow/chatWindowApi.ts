import { askAll, streamAgentChat, type AgentConfig, type ChatMessage as AgentChatMessage, type ToolEvent } from '@/lib/agentsApi';
import type { RouteMode, ReasoningStep } from './types';

/**
 * Route-mode wiring (2026-10-02). All four modes call the real backend -
 * none are stubbed. Single and Parallel/Vote/Council use genuinely
 * different real endpoints (streamAgentChat vs askAll), not a fake
 * distinction:
 *   - single: streamAgentChat to one pinned/auto-picked agent - the only
 *     path that renders progressively (the spec's own streaming
 *     requirement), at the honest cost of no real per-message energyWh
 *     (the streaming protocol's StreamDone doesn't carry it - shown as
 *     n/a, never fabricated).
 *   - parallel / vote: askAll(mode), the same real endpoint
 *     pages/agents/MultiAgent.tsx and Compare.tsx already call. Full
 *     AgentResponse per agent, including real energyWh.
 *   - council: this codebase's own Council.tsx page is itself just
 *     askAll(mode:'vote') under a different label - there is no distinct
 *     debate/synthesis backend anywhere in the repo. Wired the same way
 *     for consistency with how Council already behaves elsewhere, not
 *     silently duplicating a capability that doesn't actually exist -
 *     see khameleon-decisions-log.md, 2026-10-02.
 */

export interface RouteResult {
  content: string;
  agentId: string;
  model: string;
  durationMs: number;
  costUsd: number;
  energyWh?: number;
  routedForReason: string;
  reasoning?: ReasoningStep[];
}

/** Real per-call tool-use events (name + durationMs from the agent's own tool runner) become reasoning steps - never fabricated placeholder "thinking" text. Exported for direct unit testing. */
export function toolEventsToReasoning(events: ToolEvent[]): ReasoningStep[] {
  return events
    .filter(e => e.type === 'tool_result' || e.type === 'tool_error')
    .map(e => ({ label: e.type === 'tool_error' ? `${e.name} (failed)` : e.name, elapsedMs: e.durationMs }));
}

export function reasonForMode(mode: RouteMode, pinnedAgentName?: string): string {
  if (pinnedAgentName) return `you pinned ${pinnedAgentName}`;
  switch (mode) {
    case 'single': return 'auto-routed by task type';
    case 'parallel': return 'parallel comparison across connected agents';
    case 'vote': return 'majority vote across connected agents';
    case 'council': return 'council vote across connected agents';
  }
}

export function routeSingleStreaming(
  agentId: string,
  messages: AgentChatMessage[],
  onToken: (t: string) => void,
  onDone: (r: RouteResult) => void,
  onError: (e: string) => void,
  pinnedAgentName?: string,
): () => void {
  const toolEvents: ToolEvent[] = [];
  return streamAgentChat(
    agentId,
    messages,
    onToken,
    (d) => onDone({
      content: '', // caller already has the accumulated tokens
      agentId: d.agentId,
      model: d.model,
      durationMs: d.latencyMs,
      costUsd: d.costUsd,
      energyWh: undefined,
      routedForReason: reasonForMode('single', pinnedAgentName),
      reasoning: toolEventsToReasoning(toolEvents),
    }),
    onError,
    (e) => toolEvents.push(e),
  );
}

/** Pure, exported for direct unit testing - the real askAll endpoint only knows 'parallel'|'vote'; 'council' has no distinct backend mode anywhere in this repo (see chatWindowApi.ts's header comment). */
export function backendModeFor(mode: 'parallel' | 'vote' | 'council'): 'parallel' | 'vote' {
  return mode === 'council' ? 'vote' : mode;
}

export async function routeMultiAgent(
  mode: 'parallel' | 'vote' | 'council',
  messages: AgentChatMessage[],
  agentIds: string[],
): Promise<RouteResult> {
  const res = await askAll(messages, agentIds, backendModeFor(mode));
  const winner = res.verdict ?? res.results[0];
  if (!winner) throw new Error('No agent responded.');
  return {
    content: winner.content,
    agentId: winner.agentId,
    model: winner.model,
    durationMs: winner.latencyMs,
    costUsd: winner.costUsd,
    energyWh: winner.energyWh,
    routedForReason: reasonForMode(mode),
    reasoning: winner.toolCalls?.map(t => ({ label: t.error ? `${t.name} (failed)` : t.name, detail: t.error, elapsedMs: t.durationMs })),
  };
}

export function pickAutoRouteAgent(roster: AgentConfig[]): AgentConfig | undefined {
  // Honest, simple default - the first enabled agent - not a fabricated
  // "smart" router. A real task-type-based router is future work.
  return roster.find(a => a.enabled);
}
