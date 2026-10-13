import { useCallback, useEffect, useMemo, useState } from 'react';
import { getActionReceipts, undoActionReceipt, type ActionReceiptData } from '@/lib/actionReceiptsApi';
import { getTaskRuns, retryTaskRun, type TaskRun } from '@/lib/taskRunApi';

/**
 * One activity log (gap review Q10 + Q14): everything Khameleon did - sent
 * emails, sorted inboxes, skill installs, connections, background task
 * runs - and everything that went wrong, newest first. Shared by the
 * Overlay's Workspace -> Status tab and Classic's Analytics page.
 *
 * Undo is offered only where the server can genuinely reverse the action
 * (installing a skill, connecting an account). Failed background runs
 * offer Retry.
 */

type Tone = 'overlay' | 'classic';

const TONES: Record<Tone, { text: string; muted: string; rowBg: string; ok: string; bad: string; pending: string; btnBorder: string }> = {
  overlay: { text: '#d6efee', muted: '#8fb4b6', rowBg: 'rgba(255,255,255,0.03)', ok: '#6FE6BD', bad: '#ff8f8f', pending: '#ffb36b', btnBorder: 'rgba(255,255,255,0.14)' },
  classic: { text: 'var(--j-text)', muted: 'var(--j-text-muted)', rowBg: 'rgba(0,212,255,0.03)', ok: 'var(--j-green)', bad: 'var(--j-red)', pending: 'var(--j-amber)', btnBorder: 'rgba(0,212,255,0.2)' },
};

type Outcome = 'ok' | 'failed' | 'pending';

export interface ActivityEntry {
  id: string;
  when: string;
  description: string;
  outcome: Outcome;
  detail?: string | null;
  undone?: boolean;
  undo?: () => Promise<unknown>;
  retry?: () => Promise<unknown>;
}

const UNDOABLE = new Set(['skill_set_install', 'integration_connect']);

function fromReceipt(r: ActionReceiptData): ActivityEntry {
  return {
    id: `receipt-${r.id}`,
    when: r.createdAt,
    description: r.description,
    outcome: r.outcome === 'failure' ? 'failed' : r.outcome === 'success' ? 'ok' : 'pending',
    detail: r.detail,
    undone: r.undone,
    undo: r.canUndo && !r.undone && UNDOABLE.has(r.category) ? () => undoActionReceipt(r.id) : undefined,
  };
}

function fromRun(t: TaskRun): ActivityEntry | null {
  if (t.status === 'queued' || t.status === 'running') return null; // in progress - shown elsewhere
  const outcome: Outcome = t.status === 'failed' ? 'failed' : t.status === 'completed' ? 'ok' : 'pending';
  const label = t.status === 'cancelled' ? 'Cancelled' : t.status === 'awaiting_confirmation' ? 'Waiting for you' : t.status === 'failed' ? 'Failed' : 'Done';
  return {
    id: `run-${t.id}`,
    when: t.completedAt ?? t.updatedAt ?? t.createdAt,
    description: `${label}: ${t.commandText}`,
    outcome,
    detail: t.status === 'failed' ? t.errorMessage : t.resultSummary,
    retry: t.status === 'failed' ? () => retryTaskRun(t.id) : undefined,
  };
}

/** Merges and sorts both sources, newest first. Exported for testing. */
export function mergeActivity(receipts: ActionReceiptData[], runs: TaskRun[]): ActivityEntry[] {
  return [...receipts.map(fromReceipt), ...runs.map(fromRun).filter((e): e is ActivityEntry => e !== null)]
    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function ActivityLog({ tone, limit = 60 }: { tone: Tone; limit?: number }) {
  const t = TONES[tone];
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    Promise.all([getActionReceipts(), getTaskRuns({ limit: 50 })])
      .then(([receipts, runs]) => setEntries(mergeActivity(receipts, runs)));
  }, []);
  useEffect(() => {
    reload();
    const id = window.setInterval(reload, 30_000);
    return () => window.clearInterval(id);
  }, [reload]);

  const shown = useMemo(
    () => (entries ?? []).filter(e => !problemsOnly || e.outcome === 'failed').slice(0, limit),
    [entries, problemsOnly, limit],
  );

  const run = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    setError(null);
    try { await fn(); reload(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
    setBusy(null);
  };

  const btn: React.CSSProperties = {
    padding: '3px 9px', borderRadius: tone === 'classic' ? 2 : 7, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
    background: 'transparent', border: `1px solid ${t.btnBorder}`, color: t.text, flexShrink: 0,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: t.muted, cursor: 'pointer' }}>
        <input type="checkbox" checked={problemsOnly} onChange={e => setProblemsOnly(e.target.checked)} />
        Only show problems
      </label>
      {error && <div role="alert" style={{ fontSize: 12, color: t.bad }}>{error}</div>}
      {entries === null && <div style={{ fontSize: 12, color: t.muted }}>Loading activity…</div>}
      {entries && shown.length === 0 && (
        <div style={{ fontSize: 12, color: t.muted }}>{problemsOnly ? 'No problems logged.' : 'Nothing logged yet.'}</div>
      )}
      {shown.map(e => (
        <div key={e.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 9px', background: t.rowBg, borderRadius: tone === 'classic' ? 0 : 8 }}>
          <span aria-label={e.outcome === 'failed' ? 'Failed' : e.outcome === 'ok' ? 'Done' : 'Pending'}
            style={{ width: 7, height: 7, borderRadius: '50%', marginTop: 5, flexShrink: 0,
              background: e.outcome === 'failed' ? t.bad : e.outcome === 'ok' ? t.ok : t.pending }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: t.text, textDecoration: e.undone ? 'line-through' : 'none' }}>
              {e.description}{e.undone ? ' (undone)' : ''}
            </div>
            {e.detail && (
              <div style={{ fontSize: 11, color: e.outcome === 'failed' ? t.bad : t.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: e.outcome === 'failed' ? 'normal' : 'nowrap' }}>
                {e.detail}
              </div>
            )}
            <div style={{ fontSize: 10, color: t.muted, marginTop: 2 }}>{timeAgo(e.when)}</div>
          </div>
          {e.undo && <button type="button" style={btn} disabled={busy === e.id} onClick={() => void run(e.id, e.undo!)}>Undo</button>}
          {e.retry && <button type="button" style={btn} disabled={busy === e.id} onClick={() => void run(e.id, e.retry!)}>Retry</button>}
        </div>
      ))}
    </div>
  );
}
