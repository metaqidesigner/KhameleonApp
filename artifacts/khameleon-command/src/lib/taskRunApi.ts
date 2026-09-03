const BASE = import.meta.env.VITE_API_URL || '/api';

export type TriggerType   = 'manual' | 'scheduled' | 'event';
export type TaskRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskStep {
  index: number;
  label: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  output?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TaskRun {
  id: string;
  commandText: string;
  triggerType: TriggerType;
  triggerSource?: string;
  agentId: string;
  status: TaskRunStatus;
  steps: TaskStep[];
  previewContent?: string;
  resultSummary?: string;
  errorMessage?: string;
  retryCount: number;
  retryFromStep?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

async function safeFetch<T>(url: string, opts?: RequestInit, fallback?: T): Promise<T> {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as T;
  } catch {
    if (fallback !== undefined) return fallback;
    throw new Error('Backend unreachable');
  }
}

/** Submit a command → creates and starts a task run. Returns the taskRunId. */
export async function submitCommand(
  text: string,
  options?: { triggerType?: TriggerType; triggerSource?: string },
): Promise<{ taskRunId: string }> {
  return safeFetch<{ taskRunId: string }>(
    `${BASE}/command`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, ...options }),
    },
    { taskRunId: '' },
  );
}

/** Fetch a list of task runs with optional filters. */
export async function getTaskRuns(params?: {
  status?: TaskRunStatus;
  triggerType?: TriggerType;
  q?: string;
  limit?: number;
}): Promise<TaskRun[]> {
  const qs = new URLSearchParams();
  if (params?.status)      qs.set('status',      params.status);
  if (params?.triggerType) qs.set('triggerType',  params.triggerType);
  if (params?.q)           qs.set('q',            params.q);
  if (params?.limit)       qs.set('limit',        String(params.limit));
  return safeFetch<TaskRun[]>(`${BASE}/task-runs?${qs}`, undefined, []);
}

/** Fetch a single task run by ID. */
export async function getTaskRun(id: string): Promise<TaskRun | null> {
  return safeFetch<TaskRun | null>(`${BASE}/task-runs/${id}`, undefined, null);
}

/** Retry a failed task run. */
export async function retryTaskRun(id: string): Promise<{ ok: boolean }> {
  return safeFetch<{ ok: boolean }>(
    `${BASE}/task-runs/${id}/retry`,
    { method: 'POST' },
    { ok: false },
  );
}

/** Cancel a running task run. */
export async function cancelTaskRun(id: string): Promise<{ ok: boolean }> {
  return safeFetch<{ ok: boolean }>(
    `${BASE}/task-runs/${id}/cancel`,
    { method: 'POST' },
    { ok: false },
  );
}

/**
 * Subscribe to live SSE events for a task run.
 * Returns a stop function that closes the connection.
 */
export function streamTaskRun(
  id: string,
  onEvent: (event: Record<string, unknown>) => void,
  onClose?: () => void,
): () => void {
  let closed = false;
  const ctrl = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${BASE}/task-runs/${id}/stream`, { signal: ctrl.signal });
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done || closed) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try { onEvent(JSON.parse(line.slice(6))); } catch { /* ignore */ }
        }
      }
    } catch { /* aborted */ }
    if (!closed) onClose?.();
  })();

  return () => { closed = true; ctrl.abort(); };
}
