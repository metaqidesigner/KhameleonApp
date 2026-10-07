import type { AgentConfig, AgentStatus } from '@/lib/agentsApi';
import type { WorkDomain } from '@/lib/workDomainsApi';
import type { TaskRun } from '@/lib/taskRunApi';

/**
 * Chat Window types (2026-10-02 build - see khameleon-decisions-log.md).
 * Composed from real existing types (AgentConfig, WorkDomain, TaskRun)
 * rather than redefined, per this file's own job: UI state and view
 * models for the window, not a second copy of the data layer's shapes.
 */

export type RouteMode = 'single' | 'parallel' | 'vote' | 'council';

export const ROUTE_MODE_LABELS: Record<RouteMode, string> = {
  single: 'Single',
  parallel: 'Parallel',
  vote: 'Vote',
  council: 'Council',
};

export const ROUTE_MODE_DESCRIPTIONS: Record<RouteMode, string> = {
  single: 'One agent answers.',
  parallel: 'Agents work side by side - you compare the results.',
  vote: 'Every agent answers; the majority answer wins.',
  council: 'Agents debate the question; one verified answer comes back.',
};

/** A lightweight reference to a roster agent, not a duplicate of AgentConfig. */
export interface AgentRef {
  id: string;
  name: string;
  status: AgentStatus;
  color: string;
  initials: string;
}

export function toAgentRef(agent: AgentConfig, status: AgentStatus): AgentRef {
  return { id: agent.id, name: agent.name, status, color: agent.color, initials: agent.initials };
}

export interface ReasoningStep {
  label: string;
  detail?: string;
  elapsedMs?: number;
}

export interface ActionCardData {
  id: string;
  approvalId: number;
  title: string;
  scope: string;
  target: string;
  preview: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface MessageMeta {
  /** undefined (not 0) means "not reported" - rendered as n/a, never a fabricated number. */
  durationMs?: number;
  costUsd?: number;
  energyWh?: number;
  /** Only ever true when a real upstream ZDR signal says so - see routeMessage(). No live per-call ZDR signal exists yet (2026-10-02), so this is always undefined today; wired honestly, not hard-coded. */
  zeroDataRetention?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  /** Which agent actually answered - undefined for user messages and for route modes that don't resolve to one agent (vote/council show a synthesized answer instead). */
  answeredBy?: AgentRef;
  /** Why this agent/mode was picked, shown as a muted "routed for <reason>" label. Only set when routeMessage() has a real reason to give. */
  routedForReason?: string;
  reasoning?: ReasoningStep[];
  actionCard?: ActionCardData;
  taskRunId?: string;
  meta?: MessageMeta;
}

/** Minimal, honestly-scoped v1 - no backend concept of a thread exists yet (2026-10-02 ground-truth check), so this is persisted client-side per domain, not a fabricated server entity. */
export interface ChatThread {
  id: string;
  domainId: number | 'all';
  name: string;
  createdAt: string;
}

export type { WorkDomain, TaskRun };

export interface StarterCard {
  id: string;
  label: string;
  prompt: string;
}

export interface ParkedStripItem {
  taskId: number;
  title: string;
  reason: string;
}

export interface ChatWindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
