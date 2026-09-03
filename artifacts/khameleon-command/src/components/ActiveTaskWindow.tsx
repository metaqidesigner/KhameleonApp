import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Clock as ClockIcon, Zap, AlertTriangle, FileText, Terminal, RotateCcw } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { StatusBadge, TriggerBadge, StepRow } from '@/components/taskRun/TaskRunParts';
import { useJarvisStore } from '@/store/jarvisStore';
import {
  getTaskRun, retryTaskRun, streamTaskRun,
  type TaskRun, type TaskStep, type TaskRunStatus, type TriggerType,
} from '@/lib/taskRunApi';

/**
 * The assistant-home center zone's "live-view of the task in progress"
 * (design-spec.md §6 window management). Unlike the permanent hero orb it
 * replaces, this window only exists while there's something to show —
 * see assistant-home.tsx for the empty-state handling.
 */

// Spec §4: "a source glyph (mic / clock / bolt for manual / scheduled / event)".
const SOURCE_ICON: Record<TriggerType, ReactNode> = {
  manual: <Mic size={11} />,
  scheduled: <ClockIcon size={11} />,
  event: <Zap size={11} />,
};

function formatElapsed(createdAt: string, now: number): string {
  const secs = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

// Standard easing from design-spec.md §3 Motion.
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function ActiveTaskWindow() {
  const activeTaskIds    = useJarvisStore(s => s.activeTaskIds);
  const removeActiveTask = useJarvisStore(s => s.removeActiveTask);

  // The slot shows whichever task most recently became active — matching
  // §6's "actively processing gets frontmost priority" rule as best a
  // single center slot can. It stays pinned through a failure (so the
  // inline retry in §5's failure-handling rule stays visible) even though
  // a failed run drops out of activeTaskIds; only a newly-started task or
  // this run actually finishing clears the slot.
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [run, setRun]           = useState<TaskRun | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [now, setNow]           = useState(() => Date.now());

  useEffect(() => {
    const latest = activeTaskIds[activeTaskIds.length - 1] ?? null;
    if (latest && latest !== pinnedId) setPinnedId(latest);
  }, [activeTaskIds, pinnedId]);

  // Fetch the initial snapshot whenever a new task takes the slot.
  useEffect(() => {
    if (!pinnedId) { setRun(null); return; }
    let cancelled = false;
    getTaskRun(pinnedId).then(r => { if (!cancelled && r) setRun(r); });
    return () => { cancelled = true; };
  }, [pinnedId]);

  // Live-stream updates for whichever run is pinned.
  useEffect(() => {
    if (!pinnedId) return;
    const id = pinnedId;
    const stop = streamTaskRun(id, (event) => {
      const e = event as Record<string, unknown>;
      setRun(r => {
        if (!r || r.id !== id) return r;
        if (e.type === 'init')    return { ...r, ...(e.task as Partial<TaskRun>) };
        if (e.type === 'status') {
          // Paused on the user (e.g. outlook-draft-email's draft is ready),
          // not actively processing - drops out of the active-tasks
          // indicator the same way done/failed/cancelled do below. Stays
          // pinned in this center zone though (unlike those three) - it's
          // a "needs input" state, the highest-prominence case in the
          // window model (design-spec.md §6), not one to clear away.
          if (e.status === 'awaiting_confirmation') removeActiveTask(id);
          return { ...r, status: e.status as TaskRunStatus };
        }
        if (e.type === 'steps')   return { ...r, steps: e.steps as TaskStep[] };
        if (e.type === 'step') { const s = e.step as TaskStep; return { ...r, steps: r.steps.map(x => x.index === s.index ? s : x) }; }
        if (e.type === 'preview') return { ...r, previewContent: e.preview as string };
        if (e.type === 'done')      { removeActiveTask(id); return { ...r, status: 'completed', resultSummary: e.summary as string, previewContent: (e.preview as string) || r.previewContent }; }
        if (e.type === 'error')     { removeActiveTask(id); return { ...r, status: 'failed', errorMessage: e.error as string, retryFromStep: e.retryFromStep as number }; }
        if (e.type === 'cancelled') { removeActiveTask(id); return { ...r, status: 'cancelled' }; }
        return r;
      });
    });
    return stop;
  }, [pinnedId, removeActiveTask]);

  // Once the pinned run has nothing left to show, clear the slot so the
  // center zone goes empty again (a failed run stays pinned for its retry).
  useEffect(() => {
    if (run && (run.status === 'completed' || run.status === 'cancelled')) {
      setPinnedId(null);
    }
  }, [run]);

  useEffect(() => {
    if (!pinnedId) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pinnedId]);

  const handleRetry = useCallback(async () => {
    if (!pinnedId) return;
    setRetrying(true);
    await retryTaskRun(pinnedId);
    setRun(r => r ? { ...r, status: 'queued', errorMessage: undefined } : r);
    setRetrying(false);
  }, [pinnedId]);

  return (
    <AnimatePresence>
      {run && (
        <motion.div
          key={run.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.3, ease: EASE }}
          style={{ width: '100%' }}
        >
          <JPanel
            className="kh-task-window"
            title={run.commandText}
            icon={SOURCE_ICON[run.triggerType]}
            badge="LIVE"
            action={
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <TriggerBadge type={run.triggerType} />
                <StatusBadge status={run.status} />
                <span className="j-mono" style={{ fontSize: 9, color: 'var(--j-text-faint)' }}>
                  {formatElapsed(run.createdAt, now)}
                </span>
              </div>
            }
          >
            <div className="kh-task-window-body">
              <div className="kh-task-window-trace">
                <div className="kh-task-window-col-label">
                  <Terminal size={10} /> TRACE
                </div>
                {run.steps.length > 0 ? (
                  run.steps.map(step => <StepRow key={step.index} step={step} />)
                ) : (
                  <div style={{ color: 'var(--j-text-faint)', fontFamily: 'var(--j-font-mono)', fontSize: 10, padding: '6px 0' }}>
                    Analysing command and planning steps…
                  </div>
                )}
              </div>
              {run.previewContent && (
                <div className="kh-task-window-live">
                  <div className="kh-task-window-col-label">
                    <FileText size={10} /> LIVE VIEW
                  </div>
                  <div className="kh-task-window-preview scrollbar-jarvis">
                    {run.previewContent}
                    {run.status === 'running' && <span className="j-blink" style={{ color: 'var(--j-teal)' }}>▌</span>}
                  </div>
                </div>
              )}
            </div>

            {run.status === 'failed' && (
              <div className="kh-task-window-footer">
                <AlertTriangle size={12} style={{ color: 'var(--j-coral)', flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-coral)', marginBottom: 6, lineHeight: 1.5 }}>
                    {run.errorMessage ?? 'An error occurred'}
                    {run.retryFromStep != null && ` (will retry from step ${run.retryFromStep + 1})`}
                  </div>
                  <button
                    onClick={handleRetry}
                    disabled={retrying}
                    className="j-btn-ghost"
                    style={{ height: 26, padding: '0 10px', fontSize: 10, borderColor: 'rgba(226,90,110,0.35)', color: 'var(--j-coral)', borderRadius: 6 }}
                  >
                    <RotateCcw size={10} style={{ animation: retrying ? 'jarvis-spin 0.7s linear infinite' : 'none' }} />
                    {' '}RETRY FROM STEP {(run.retryFromStep ?? 0) + 1}
                  </button>
                </div>
              </div>
            )}
          </JPanel>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
