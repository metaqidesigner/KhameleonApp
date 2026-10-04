import React, { useEffect, useState } from 'react';
import {
  Loader2, CheckCircle2, AlertTriangle, AlertCircle, Clock, ChevronDown, ChevronRight,
  RotateCcw, X, Terminal, FileText,
} from 'lucide-react';
import { useJarvisStore } from '@/store/jarvisStore';
import {
  streamTaskRun, retryTaskRun, cancelTaskRun,
  type TaskAgentType, type TaskRun, type TaskRunStatus, type TaskStep, type TriggerType,
} from '@/lib/taskRunApi';

/**
 * Small presentational pieces for the Tasks page's run list (pages/tasks.tsx)
 * and the full TaskRunCard itself. Previously also shared with the
 * assistant-home center zone's ActiveTaskWindow, removed 2026-10-01 as dead
 * code once assistant-home.tsx was reduced to <CommandWall/> and nothing
 * rendered it anymore.
 *
 * TaskRunCard moved here from pages/tasks.tsx (2026-10-02) so the Chat
 * Window's Live Task Card can import it directly without pulling the whole
 * (large, otherwise-lazy-loaded) Tasks page into the main bundle - this file
 * already existed for exactly that reason (see ApiKeyRow.tsx for the same
 * pattern applied to Settings/OnboardingWizard).
 */

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000)   return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.round(diff / 3600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function StatusBadge({ status }: { status: TaskRunStatus }) {
  const cfg: Record<TaskRunStatus, { color: string; label: string }> = {
    queued:    { color: 'var(--j-violet)', label: 'QUEUED' },
    running:   { color: 'var(--j-teal)',   label: 'RUNNING' },
    completed: { color: 'var(--j-green)',  label: 'DONE' },
    failed:    { color: 'var(--j-coral)',  label: 'FAILED' },
    cancelled: { color: 'var(--j-text-muted)', label: 'CANCELLED' },
    // Amber = "attention, not error" (design-spec.md §3's accent ramp) - a
    // draft is ready and waiting on the user, the highest-prominence state
    // in the window model (§6), not a neutral in-between state.
    awaiting_confirmation: { color: 'var(--j-amber)', label: 'NEEDS CONFIRM' },
  };
  const { color, label } = cfg[status] ?? cfg.queued;
  return (
    <span className="j-mono" style={{
      fontSize: 8, letterSpacing: '0.1em', padding: '2px 7px',
      background: `color-mix(in srgb, ${color} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
      borderRadius: 10, color,
    }}>
      {label}
    </span>
  );
}

export function TriggerBadge({ type }: { type: TriggerType }) {
  const cfg = {
    manual:    { color: 'var(--j-teal)',   label: 'MANUAL',  icon: '⌨' },
    scheduled: { color: 'var(--j-violet)', label: 'SCHED',   icon: '⏰' },
    event:     { color: 'var(--j-amber)',  label: 'EVENT',   icon: '⚡' },
  };
  const { color, label, icon } = cfg[type] ?? cfg.manual;
  return (
    <span className="j-mono" style={{
      fontSize: 8, letterSpacing: '0.08em', padding: '2px 6px',
      border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      borderRadius: 8, color, opacity: 0.8,
    }}>
      {icon} {label}
    </span>
  );
}

/**
 * design-spec.md §11.1's execution-model contract, made visible - which
 * path actually ran (real data from the backend's classifyComplexity(),
 * not a decorative label). 'orchestrator' is the pre-existing default
 * and isn't worth calling out on every run; only the newer paths are
 * badged, the same restraint used elsewhere in this app for "nothing
 * to say" states.
 */
export function AgentTypeBadge({ type }: { type: TaskAgentType }) {
  if (type === 'orchestrator') return null;
  const cfg: Record<Exclude<TaskAgentType, 'orchestrator'>, { color: string; label: string }> = {
    simple:    { color: 'var(--j-text-muted)', label: 'SIMPLE' },
    traced:    { color: 'var(--j-violet)',     label: 'TRACED' },
    sandboxed: { color: 'var(--j-amber)',      label: 'SANDBOXED' },
  };
  const { color, label } = cfg[type];
  return (
    <span className="j-mono" style={{
      fontSize: 8, letterSpacing: '0.08em', padding: '2px 6px',
      border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      borderRadius: 8, color, opacity: 0.8,
    }}>
      {label}
    </span>
  );
}

export function StepRow({ step }: { step: TaskStep }) {
  const icons: Record<string, React.ReactNode> = {
    pending:  <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid var(--j-text-faint)', flexShrink: 0 }} />,
    running:  <Loader2 size={10} style={{ color: 'var(--j-teal)', animation: 'jarvis-spin 1s linear infinite', flexShrink: 0 }} />,
    done:     <CheckCircle2 size={10} style={{ color: 'var(--j-green)', flexShrink: 0 }} />,
    failed:   <AlertTriangle size={10} style={{ color: 'var(--j-coral)', flexShrink: 0 }} />,
  };
  const textColor = step.status === 'done' ? 'var(--j-text-muted)' : step.status === 'running' ? 'var(--j-text)' : step.status === 'failed' ? 'var(--j-coral)' : 'var(--j-text-faint)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {icons[step.status] ?? icons.pending}
        <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, color: textColor, flex: 1 }}>{step.label}</span>
        {step.completedAt && step.startedAt && (
          <span className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)' }}>
            {((new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()) / 1000).toFixed(1)}s
          </span>
        )}
      </div>
      {step.output && step.status === 'done' && (
        <div style={{ paddingLeft: 17, fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-text-muted)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {step.output}
        </div>
      )}
    </div>
  );
}

export interface TaskRunCardProps { run: TaskRun; onRemove: (id: string) => void; }

export function TaskRunCard({ run: initialRun, onRemove }: TaskRunCardProps) {
  const [run, setRun]           = useState<TaskRun>(initialRun);
  // design-spec.md §6.5.1: "never auto-expanded for routine work" - a
  // running task is routine work, so this starts collapsed regardless of
  // status (previously defaulted open for anything not completed/cancelled,
  // flagged in the 2026-10-01 audit as a direct contradiction of that rule).
  const [expanded, setExpanded] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const removeActiveTask        = useJarvisStore(s => s.removeActiveTask);

  useEffect(() => { setRun(initialRun); }, [initialRun.id]);

  useEffect(() => {
    if (run.status !== 'running' && run.status !== 'queued') return;
    const stop = streamTaskRun(run.id, (event) => {
      const e = event as Record<string, unknown>;
      setRun((r) => {
        if (e.type === 'init')    return { ...r, ...(e.task as Partial<TaskRun>) };
        if (e.type === 'status') {
          // awaiting_confirmation isn't "actively processing" either - the
          // pipeline stopped, it's just paused on the user (e.g.
          // outlook-draft-email once its draft is ready) - so it drops out
          // of the active-tasks indicator the same way done/failed/
          // cancelled do below.
          if (e.status === 'awaiting_confirmation') removeActiveTask(r.id);
          return { ...r, status: e.status as TaskRunStatus };
        }
        if (e.type === 'steps')   return { ...r, steps: e.steps as TaskStep[] };
        if (e.type === 'step') { const s = e.step as TaskStep; return { ...r, steps: r.steps.map((x) => (x.index === s.index ? s : x)) }; }
        if (e.type === 'preview') return { ...r, previewContent: e.preview as string };
        if (e.type === 'done') { setExpanded(false); removeActiveTask(r.id); return { ...r, status: 'completed', resultSummary: e.summary as string, previewContent: (e.preview as string) || r.previewContent }; }
        if (e.type === 'error') { removeActiveTask(r.id); return { ...r, status: 'failed', errorMessage: e.error as string, retryFromStep: e.retryFromStep as number }; }
        if (e.type === 'cancelled') { removeActiveTask(r.id); return { ...r, status: 'cancelled' }; }
        return r;
      });
    });
    return stop;
  }, [run.id, run.status]);

  const handleRetry = async () => {
    setRetrying(true);
    await retryTaskRun(run.id);
    setRun((r) => ({ ...r, status: 'queued', errorMessage: undefined }));
    setExpanded(true);
    setRetrying(false);
  };
  const handleCancel = async () => {
    await cancelTaskRun(run.id);
    setRun((r) => ({ ...r, status: 'cancelled' }));
    removeActiveTask(run.id);
  };

  const isActive = run.status === 'running' || run.status === 'queued';
  // awaiting_confirmation gets its own amber treatment, distinct from the
  // neutral default - it's a "needs input" state (design-spec.md §6's
  // highest-prominence case), not a passive in-between one.
  const borderColor = run.status === 'completed' ? 'rgba(56,207,138,0.18)' : run.status === 'failed' ? 'rgba(226,90,110,0.22)' : run.status === 'running' ? 'rgba(0,196,184,0.22)' : run.status === 'awaiting_confirmation' ? 'rgba(240,163,76,0.3)' : 'rgba(120,168,220,0.11)';
  const glowColor   = run.status === 'completed' ? 'rgba(56,207,138,0.08)' : run.status === 'failed' ? 'rgba(226,90,110,0.06)' : run.status === 'running' ? 'rgba(0,196,184,0.07)' : run.status === 'awaiting_confirmation' ? 'rgba(240,163,76,0.1)' : 'transparent';
  // Distinct from isActive (which also gates the cancel button below) -
  // there's nothing to cancel once a run is paused on the user, but it
  // should still draw the eye the same way an actively-running one does.
  const needsAttention = isActive || run.status === 'awaiting_confirmation';

  return (
    <div style={{
      background: 'rgba(8,14,32,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      border: `1px solid ${borderColor}`, borderRadius: 14,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 4px 24px rgba(0,0,0,0.4), 0 0 32px ${glowColor}`,
      overflow: 'hidden', animation: 'jarvis-fadein 0.25s ease both',
      ...(needsAttention && { animation: 'task-pulse 3s ease-in-out infinite' }),
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: expanded ? `1px solid rgba(120,168,220,0.07)` : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, overflow: 'hidden' }}>
          {run.status === 'running'   ? <Loader2 size={12} style={{ color: 'var(--j-teal)', animation: 'jarvis-spin 1s linear infinite', flexShrink: 0 }} />
          : run.status === 'completed'? <CheckCircle2 size={12} style={{ color: 'var(--j-green)', flexShrink: 0 }} />
          : run.status === 'failed'   ? <AlertTriangle size={12} style={{ color: 'var(--j-coral)', flexShrink: 0 }} />
          : run.status === 'awaiting_confirmation' ? <AlertCircle size={12} style={{ color: 'var(--j-amber)', flexShrink: 0 }} />
          : <Clock size={12} style={{ color: 'var(--j-text-muted)', flexShrink: 0 }} />}
          <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, fontWeight: 600, color: 'var(--j-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {run.commandText.length > 60 ? run.commandText.slice(0, 58) + '…' : run.commandText}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <TriggerBadge type={run.triggerType} />
          <AgentTypeBadge type={run.agentType} />
          <StatusBadge status={run.status} />
          <span className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)' }}>{relativeTime(run.createdAt)}</span>
          {(run.status === 'completed' || run.status === 'awaiting_confirmation') && (
            <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--j-text-faint)', padding: '0 2px', display: 'flex', alignItems: 'center' }}>
              {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
          )}
          {run.status === 'failed' && (
            <button onClick={handleRetry} disabled={retrying} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--j-amber)', padding: '0 2px', display: 'flex' }}>
              <RotateCcw size={11} style={{ animation: retrying ? 'jarvis-spin 0.7s linear infinite' : 'none' }} />
            </button>
          )}
          {isActive && (
            <button onClick={handleCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--j-text-faint)', padding: '0 2px', display: 'flex' }}>
              <X size={11} />
            </button>
          )}
          <button onClick={() => onRemove(run.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(120,168,220,0.25)', padding: '0 2px', display: 'flex' }}>
            <X size={10} />
          </button>
        </div>
      </div>
      {!expanded && (run.status === 'completed' || run.status === 'awaiting_confirmation') && run.resultSummary && (
        <div style={{ padding: '7px 12px', fontFamily: 'var(--j-font-ui)', fontSize: 11, color: run.status === 'awaiting_confirmation' ? 'var(--j-amber)' : 'var(--j-text-muted)', lineHeight: 1.4 }}>{run.resultSummary}</div>
      )}
      {!expanded && run.status === 'failed' && (
        <div style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-coral)', flex: 1 }}>{(run.errorMessage ?? 'Unknown error').slice(0, 100)}</span>
          <button onClick={handleRetry} disabled={retrying} className="j-btn-ghost" style={{ height: 22, padding: '0 8px', fontSize: 9, borderColor: 'rgba(226,90,110,0.35)', color: 'var(--j-coral)', borderRadius: 6 }}>
            <RotateCcw size={9} /> RETRY
          </button>
        </div>
      )}
      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {run.steps.length > 0 && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(120,168,220,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <Terminal size={10} style={{ color: 'var(--j-text-faint)' }} />
                <span className="j-mono" style={{ fontSize: 9, color: 'var(--j-text-faint)', letterSpacing: '0.1em' }}>TRACE</span>
              </div>
              {run.steps.map(step => <StepRow key={step.index} step={step} />)}
            </div>
          )}
          {run.steps.length === 0 && (run.status === 'queued' || run.status === 'running') && (
            <div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--j-text-faint)', fontFamily: 'var(--j-font-mono)', fontSize: 10 }}>
              <Loader2 size={12} style={{ animation: 'jarvis-spin 1s linear infinite' }} />
              Analysing command and planning steps…
            </div>
          )}
          {run.previewContent && (
            <div style={{ padding: '8px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <FileText size={10} style={{ color: 'var(--j-text-faint)' }} />
                <span className="j-mono" style={{ fontSize: 9, color: 'var(--j-text-faint)', letterSpacing: '0.1em' }}>LIVE PREVIEW</span>
              </div>
              <div style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'var(--j-text)', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 220, overflowY: 'auto', padding: '8px 10px', background: 'rgba(0,196,184,0.03)', border: '1px solid rgba(0,196,184,0.09)', borderRadius: 8 }} className="scrollbar-jarvis">
                {run.previewContent}
                {run.status === 'running' && <span className="j-blink" style={{ color: 'var(--j-teal)' }}>▌</span>}
              </div>
            </div>
          )}
          {run.status === 'failed' && (
            <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <AlertTriangle size={12} style={{ color: 'var(--j-coral)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-coral)', marginBottom: 6, lineHeight: 1.5 }}>
                  {run.errorMessage ?? 'An error occurred'}
                  {run.retryFromStep != null && ` (will retry from step ${run.retryFromStep + 1})`}
                </div>
                <button onClick={handleRetry} disabled={retrying} className="j-btn-ghost" style={{ height: 26, padding: '0 10px', fontSize: 10, borderColor: 'rgba(226,90,110,0.35)', color: 'var(--j-coral)', borderRadius: 6 }}>
                  <RotateCcw size={10} /> RETRY FROM STEP {(run.retryFromStep ?? 0) + 1}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
