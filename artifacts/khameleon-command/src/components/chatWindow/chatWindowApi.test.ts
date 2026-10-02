import { describe, it, expect } from 'vitest';
import { reasonForMode, backendModeFor, pickAutoRouteAgent, toolEventsToReasoning } from './chatWindowApi';
import type { AgentConfig, ToolEvent } from '@/lib/agentsApi';

function makeAgent(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    id: 'claude', name: 'Claude', provider: 'anthropic', model: 'claude-sonnet-4-6',
    enabled: true, role: 'general', systemPrompt: '', color: '#fff', initials: 'CL',
    ...overrides,
  };
}

describe('reasonForMode', () => {
  it('prefers the pinned-agent reason over the mode default, regardless of mode', () => {
    expect(reasonForMode('single', 'Claude')).toBe('you pinned Claude');
    expect(reasonForMode('vote', 'GPT-4o')).toBe('you pinned GPT-4o');
  });

  it('falls back to a mode-specific reason with no pinned agent', () => {
    expect(reasonForMode('single')).toBe('auto-routed by task type');
    expect(reasonForMode('parallel')).toBe('parallel comparison across connected agents');
    expect(reasonForMode('vote')).toBe('majority vote across connected agents');
    expect(reasonForMode('council')).toBe('council vote across connected agents');
  });
});

describe('backendModeFor', () => {
  it('passes parallel and vote through unchanged', () => {
    expect(backendModeFor('parallel')).toBe('parallel');
    expect(backendModeFor('vote')).toBe('vote');
  });

  it('maps council to vote - there is no distinct council backend mode anywhere in this repo', () => {
    expect(backendModeFor('council')).toBe('vote');
  });
});

describe('pickAutoRouteAgent', () => {
  it('picks the first enabled agent', () => {
    const roster = [makeAgent({ id: 'a', enabled: false }), makeAgent({ id: 'b', enabled: true }), makeAgent({ id: 'c', enabled: true })];
    expect(pickAutoRouteAgent(roster)?.id).toBe('b');
  });

  it('returns undefined when no agent is enabled - never fabricates a fallback', () => {
    const roster = [makeAgent({ id: 'a', enabled: false })];
    expect(pickAutoRouteAgent(roster)).toBeUndefined();
  });

  it('returns undefined for an empty roster', () => {
    expect(pickAutoRouteAgent([])).toBeUndefined();
  });
});

describe('toolEventsToReasoning', () => {
  it('maps real tool_result events to reasoning steps with their real name and duration', () => {
    const events: ToolEvent[] = [
      { type: 'tool_start', name: 'search_memory' },
      { type: 'tool_result', name: 'search_memory', durationMs: 240 },
      { type: 'tool_result', name: 'get_calendar', durationMs: 90 },
    ];
    expect(toolEventsToReasoning(events)).toEqual([
      { label: 'search_memory', elapsedMs: 240 },
      { label: 'get_calendar', elapsedMs: 90 },
    ]);
  });

  it('ignores tool_start events - only completed calls become reasoning steps, never a fabricated in-progress placeholder', () => {
    const events: ToolEvent[] = [{ type: 'tool_start', name: 'search_memory' }];
    expect(toolEventsToReasoning(events)).toEqual([]);
  });

  it('labels a failed tool call distinctly rather than hiding the failure', () => {
    const events: ToolEvent[] = [{ type: 'tool_error', name: 'send_email', durationMs: 50, error: 'timeout' }];
    expect(toolEventsToReasoning(events)).toEqual([{ label: 'send_email (failed)', elapsedMs: 50 }]);
  });

  it('returns an empty array for no tool calls, not a fabricated reasoning step', () => {
    expect(toolEventsToReasoning([])).toEqual([]);
  });
});
