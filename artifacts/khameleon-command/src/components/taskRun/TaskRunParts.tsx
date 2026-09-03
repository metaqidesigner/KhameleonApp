import React from 'react';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { TaskRunStatus, TaskStep, TriggerType } from '@/lib/taskRunApi';

/**
 * Small presentational pieces shared between the Tasks page's run list
 * (pages/tasks.tsx) and the assistant-home center zone's ActiveTaskWindow —
 * kept in one place so both stay visually identical rather than drifting.
 */

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
