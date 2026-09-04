const BASE = import.meta.env.VITE_API_URL || '/api';

export interface CompletionTrendPoint {
  label: string;
  completed: number;
}

/** Reads degrade to empty on failure - an empty trend and an unreachable backend look the same, honestly. */
export async function getTaskCompletionTrend(): Promise<CompletionTrendPoint[]> {
  try {
    const res = await fetch(`${BASE}/tasks/completion-trend`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
