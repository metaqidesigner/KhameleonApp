import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Mic, MicOff, RefreshCw, ChevronDown, ChevronRight,
  X, RotateCcw, CheckCircle2, AlertTriangle, Loader2,
  Terminal, FileText, Clock, Zap, Filter, Search,
  Calendar, Mail, Play,
} from 'lucide-react';
import JPanel from '@/components/JPanel';
import { useJarvisStore } from '@/store/jarvisStore';
import {
  submitCommand, getTaskRuns, retryTaskRun, cancelTaskRun, streamTaskRun,
  type TaskRun, type TaskStep, type TaskRunStatus, type TriggerType,
} from '@/lib/taskRunApi';

// ── Helpers ───────────────────────────────────────────────────

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000)  return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.round(diff / 3600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function StatusBadge({ status }: { status: TaskRunStatus }) {
  const cfg: Record<TaskRunStatus, { color: string; label: string }> = {
    queued:    { color: 'var(--j-violet)', label: 'QUEUED' },
    running:   { color: 'var(--j-teal)',   label: 'RUNNING' },
    completed: { color: 'var(--j-green)',  label: 'DONE' },
    failed:    { color: 'var(--j-coral)',  label: 'FAILED' },
    cancelled: { color: 'var(--j-text-muted)', label: 'CANCELLED' },
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

function TriggerBadge({ type }: { type: TriggerType }) {
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

// ── Step trace row ────────────────────────────────────────────

function StepRow({ step }: { step: TaskStep }) {
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
        <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, color: textColor, flex: 1 }}>
          {step.label}
        </span>
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

// ── Task run card ─────────────────────────────────────────────

interface CardProps {
  run: TaskRun;
  onRemove: (id: string) => void;
}

function TaskRunCard({ run: initialRun, onRemove }: CardProps) {
  const [run, setRun]           = useState<TaskRun>(initialRun);
  const [expanded, setExpanded] = useState(
    initialRun.status !== 'completed' && initialRun.status !== 'cancelled'
  );
  const [retrying, setRetrying] = useState(false);
  const removeActiveTask        = useJarvisStore(s => s.removeActiveTask);

  // Sync prop changes
  useEffect(() => { setRun(initialRun); }, [initialRun.id]);

  // SSE subscription for live updates
  useEffect(() => {
    if (run.status !== 'running' && run.status !== 'queued') return;
    const stop = streamTaskRun(
      run.id,
      (event) => {
        const e = event as Record<string, unknown>;
        setRun((r) => {
          if (e.type === 'init')    return { ...r, ...(e.task as Partial<TaskRun>) };
          if (e.type === 'status')  return { ...r, status: e.status as TaskRunStatus };
          if (e.type === 'steps')   return { ...r, steps: e.steps as TaskStep[] };
          if (e.type === 'step') {
            const s = e.step as TaskStep;
            return { ...r, steps: r.steps.map((x) => (x.index === s.index ? s : x)) };
          }
          if (e.type === 'preview') return { ...r, previewContent: e.preview as string };
          if (e.type === 'done') {
            setExpanded(false);
            removeActiveTask(r.id);
            return { ...r, status: 'completed', resultSummary: e.summary as string, previewContent: (e.preview as string) || r.previewContent };
          }
          if (e.type === 'error') {
            removeActiveTask(r.id);
            return { ...r, status: 'failed', errorMessage: e.error as string, retryFromStep: e.retryFromStep as number };
          }
          if (e.type === 'cancelled') {
            removeActiveTask(r.id);
            return { ...r, status: 'cancelled' };
          }
          return r;
        });
      },
    );
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
  const borderColor = run.status === 'completed' ? 'rgba(56,207,138,0.18)'
    : run.status === 'failed' ? 'rgba(226,90,110,0.22)'
    : run.status === 'running' ? 'rgba(0,196,184,0.22)'
    : 'rgba(120,168,220,0.11)';
  const glowColor = run.status === 'completed' ? 'rgba(56,207,138,0.08)'
    : run.status === 'failed' ? 'rgba(226,90,110,0.06)'
    : run.status === 'running' ? 'rgba(0,196,184,0.07)'
    : 'transparent';

  return (
    <div style={{
      background: 'rgba(8,14,32,0.75)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: `1px solid ${borderColor}`,
      borderRadius: 14,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 4px 24px rgba(0,0,0,0.4), 0 0 32px ${glowColor}`,
      overflow: 'hidden',
      animation: 'jarvis-fadein 0.25s ease both',
      ...(isActive && { animation: 'task-pulse 3s ease-in-out infinite' }),
    }}>
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: expanded ? `1px solid rgba(120,168,220,0.07)` : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, overflow: 'hidden' }}>
          {run.status === 'running' ? (
            <Loader2 size={12} style={{ color: 'var(--j-teal)', animation: 'jarvis-spin 1s linear infinite', flexShrink: 0 }} />
          ) : run.status === 'completed' ? (
            <CheckCircle2 size={12} style={{ color: 'var(--j-green)', flexShrink: 0 }} />
          ) : run.status === 'failed' ? (
            <AlertTriangle size={12} style={{ color: 'var(--j-coral)', flexShrink: 0 }} />
          ) : (
            <Clock size={12} style={{ color: 'var(--j-text-muted)', flexShrink: 0 }} />
          )}
          <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, fontWeight: 600, color: 'var(--j-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {run.commandText.length > 60 ? run.commandText.slice(0, 58) + '…' : run.commandText}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <TriggerBadge type={run.triggerType} />
          <StatusBadge status={run.status} />
          <span className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)' }}>
            {relativeTime(run.createdAt)}
          </span>
          {/* Controls */}
          {run.status === 'completed' && (
            <button onClick={() => setExpanded((e) => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--j-text-faint)', padding: '0 2px', display: 'flex', alignItems: 'center' }}>
              {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
          )}
          {run.status === 'failed' && (
            <button onClick={handleRetry} disabled={retrying} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--j-amber)', padding: '0 2px', display: 'flex', alignItems: 'center' }} title="Retry from failed step">
              <RotateCcw size={11} style={{ animation: retrying ? 'jarvis-spin 0.7s linear infinite' : 'none' }} />
            </button>
          )}
          {isActive && (
            <button onClick={handleCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--j-text-faint)', padding: '0 2px', display: 'flex', alignItems: 'center' }} title="Cancel">
              <X size={11} />
            </button>
          )}
          <button onClick={() => onRemove(run.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(120,168,220,0.25)', padding: '0 2px', display: 'flex', alignItems: 'center' }} title="Dismiss">
            <X size={10} />
          </button>
        </div>
      </div>

      {/* Completed summary (collapsed) */}
      {!expanded && run.status === 'completed' && run.resultSummary && (
        <div style={{ padding: '7px 12px', fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'var(--j-text-muted)', lineHeight: 1.4 }}>
          {run.resultSummary}
        </div>
      )}

      {/* Failed summary */}
      {!expanded && run.status === 'failed' && (
        <div style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-coral)', flex: 1 }}>
            {(run.errorMessage ?? 'Unknown error').slice(0, 100)}
          </span>
          <button onClick={handleRetry} disabled={retrying} className="j-btn-ghost" style={{ height: 22, padding: '0 8px', fontSize: 9, borderColor: 'rgba(226,90,110,0.35)', color: 'var(--j-coral)', borderRadius: 6 }}>
            <RotateCcw size={9} /> RETRY
          </button>
        </div>
      )}

      {/* Expanded body — steps + preview */}
      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Step trace */}
          {run.steps.length > 0 && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(120,168,220,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <Terminal size={10} style={{ color: 'var(--j-text-faint)' }} />
                <span className="j-mono" style={{ fontSize: 9, color: 'var(--j-text-faint)', letterSpacing: '0.1em' }}>TRACE</span>
              </div>
              {run.steps.map((step) => (
                <StepRow key={step.index} step={step} />
              ))}
            </div>
          )}

          {/* Queued/no-steps state */}
          {run.steps.length === 0 && (run.status === 'queued' || run.status === 'running') && (
            <div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--j-text-faint)', fontFamily: 'var(--j-font-mono)', fontSize: 10 }}>
              <Loader2 size={12} style={{ animation: 'jarvis-spin 1s linear infinite' }} />
              Analyzing command and planning steps…
            </div>
          )}

          {/* Live preview */}
          {run.previewContent && (
            <div style={{ padding: '8px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <FileText size={10} style={{ color: 'var(--j-text-faint)' }} />
                <span className="j-mono" style={{ fontSize: 9, color: 'var(--j-text-faint)', letterSpacing: '0.1em' }}>LIVE PREVIEW</span>
              </div>
              <div style={{
                fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'var(--j-text)',
                lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                maxHeight: 220, overflowY: 'auto', padding: '8px 10px',
                background: 'rgba(0,196,184,0.03)', border: '1px solid rgba(0,196,184,0.09)',
                borderRadius: 8,
              }} className="scrollbar-jarvis">
                {run.previewContent}
                {run.status === 'running' && <span className="j-blink" style={{ color: 'var(--j-teal)' }}>▌</span>}
              </div>
            </div>
          )}

          {/* Failure detail + retry */}
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

// ── Command bar ───────────────────────────────────────────────

interface CommandBarProps {
  onSubmit: (text: string) => void;
  loading: boolean;
}

function CommandBar({ onSubmit, loading }: CommandBarProps) {
  const [input, setInput]       = useState('');
  const [listening, setListening] = useState(false);
  const inputRef                = useRef<HTMLInputElement>(null);
  const pendingVoiceQuery    = useJarvisStore(s => s.pendingVoiceQuery);
  const setPendingVoiceQuery = useJarvisStore(s => s.setPendingVoiceQuery);

  // Consume voice queries from the orb
  useEffect(() => {
    if (pendingVoiceQuery) {
      setInput(pendingVoiceQuery);
      setPendingVoiceQuery(null);
      inputRef.current?.focus();
    }
  }, [pendingVoiceQuery, setPendingVoiceQuery]);

  const submit = () => {
    if (!input.trim() || loading) return;
    onSubmit(input.trim());
    setInput('');
  };

  const startVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Speech recognition is only available in Chrome/Edge.');
      return;
    }
    const rec = new SpeechRec();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.onresult = (e: { results: { [x: string]: { [x: string]: { transcript: string } } } }) => {
      const text = e.results[0][0].transcript;
      setInput(text);
      inputRef.current?.focus();
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    setListening(true);
  };

  return (
    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <input
          ref={inputRef}
          className="j-input"
          style={{ height: 48, fontSize: 14, paddingLeft: 16, paddingRight: 16, borderRadius: 12, letterSpacing: '0.02em' }}
          placeholder="Issue any command — ask, create, research, schedule, delegate…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && submit()}
          disabled={loading}
        />
      </div>
      <button
        onClick={startVoice}
        className="j-btn-ghost"
        title={listening ? 'Listening…' : 'Voice input'}
        style={{
          height: 48, width: 48, padding: 0, flexShrink: 0, borderRadius: 12,
          borderColor: listening ? 'rgba(226,90,110,0.5)' : undefined,
          color: listening ? 'var(--j-coral)' : undefined,
          animation: listening ? 'jarvis-pulse 0.8s ease-in-out infinite' : 'none',
        }}
      >
        {listening ? <MicOff size={16} /> : <Mic size={16} />}
      </button>
      <button
        className="j-btn-primary"
        style={{ height: 48, padding: '0 28px', borderRadius: 12, fontSize: 13, letterSpacing: '0.12em' }}
        onClick={submit}
        disabled={!input.trim() || loading}
      >
        {loading
          ? <Loader2 size={14} style={{ animation: 'jarvis-spin 0.7s linear infinite' }} />
          : <Send size={14} />}
        EXECUTE
      </button>
    </div>
  );
}

// ── Auto-trigger config panel ─────────────────────────────────

const DEFAULT_SCHEDULES = [
  { id: 'morning', label: 'Morning digest', cron: '7:00 AM daily', active: false },
  { id: 'weekly',  label: 'Weekly summary', cron: 'Monday 9:00 AM', active: false },
];
const DEFAULT_EVENTS = [
  { id: 'email', label: 'New email arrives', icon: <Mail size={11} />, active: false },
  { id: 'calendar', label: 'Calendar event starting', icon: <Calendar size={11} />, active: false },
];

function AutoTriggers() {
  const [schedules, setSchedules] = useState(DEFAULT_SCHEDULES);
  const [events, setEvents]       = useState(DEFAULT_EVENTS);
  const [expanded, setExpanded]   = useState(false);

  return (
    <div style={{
      background: 'rgba(8,14,32,0.65)', backdropFilter: 'blur(16px)',
      border: '1px solid rgba(120,96,194,0.15)', borderRadius: 12,
      overflow: 'hidden', flexShrink: 0,
    }}>
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', userSelect: 'none' }}
      >
        <Zap size={11} style={{ color: 'var(--j-violet)' }} />
        <span style={{ fontFamily: 'var(--j-font-head)', fontSize: 10, color: 'var(--j-text-muted)', letterSpacing: '0.15em', flex: 1 }}>AUTO TRIGGERS</span>
        <span className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)' }}>
          {schedules.filter((s) => s.active).length + events.filter((e) => e.active).length} active
        </span>
        {expanded ? <ChevronDown size={10} style={{ color: 'var(--j-text-faint)' }} /> : <ChevronRight size={10} style={{ color: 'var(--j-text-faint)' }} />}
      </div>

      {expanded && (
        <div style={{ padding: '0 12px 10px', display: 'flex', gap: 20 }}>
          {/* Schedules */}
          <div style={{ flex: 1 }}>
            <div className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)', letterSpacing: '0.12em', marginBottom: 6 }}>SCHEDULED</div>
            {schedules.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <button
                  onClick={() => setSchedules((prev) => prev.map((x) => x.id === s.id ? { ...x, active: !x.active } : x))}
                  style={{ width: 28, height: 16, borderRadius: 8, border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s', background: s.active ? 'var(--j-violet)' : 'rgba(120,168,220,0.15)', position: 'relative' }}
                >
                  <div style={{ position: 'absolute', top: 2, left: s.active ? 14 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                </button>
                <div>
                  <div style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, color: s.active ? 'var(--j-text)' : 'var(--j-text-muted)' }}>{s.label}</div>
                  <div className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)' }}>{s.cron}</div>
                </div>
              </div>
            ))}
          </div>
          {/* Events */}
          <div style={{ flex: 1 }}>
            <div className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)', letterSpacing: '0.12em', marginBottom: 6 }}>EVENT-TRIGGERED</div>
            {events.map((e) => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <button
                  onClick={() => setEvents((prev) => prev.map((x) => x.id === e.id ? { ...x, active: !x.active } : x))}
                  style={{ width: 28, height: 16, borderRadius: 8, border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s', background: e.active ? 'var(--j-amber)' : 'rgba(120,168,220,0.15)', position: 'relative' }}
                >
                  <div style={{ position: 'absolute', top: 2, left: e.active ? 14 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: 'var(--j-amber)', display: 'flex' }}>{e.icon}</span>
                  <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, color: e.active ? 'var(--j-text)' : 'var(--j-text-muted)' }}>{e.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── History row ───────────────────────────────────────────────

function HistoryRow({ run, onRerun }: { run: TaskRun; onRerun: (text: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid rgba(120,168,220,0.06)', animation: 'jarvis-fadein 0.2s ease both' }}>
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', cursor: 'pointer', userSelect: 'none' }}
      >
        {expanded ? <ChevronDown size={9} style={{ color: 'var(--j-text-faint)', flexShrink: 0 }} /> : <ChevronRight size={9} style={{ color: 'var(--j-text-faint)', flexShrink: 0 }} />}
        <span className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)', flexShrink: 0 }}>{relativeTime(run.createdAt)}</span>
        <TriggerBadge type={run.triggerType} />
        <StatusBadge status={run.status} />
        <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'var(--j-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {run.commandText}
        </span>
        <span className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)', flexShrink: 0 }}>
          {run.steps.length} steps
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onRerun(run.commandText); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--j-text-faint)', padding: '0 2px', display: 'flex', alignItems: 'center' }}
          title="Run again"
        >
          <Play size={9} />
        </button>
      </div>
      {expanded && (
        <div style={{ paddingLeft: 16, paddingBottom: 8 }}>
          {run.resultSummary && (
            <div style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'var(--j-text-muted)', marginBottom: 4, lineHeight: 1.5 }}>
              {run.resultSummary}
            </div>
          )}
          {run.steps.map((s) => (
            <StepRow key={s.index} step={s} />
          ))}
          {run.previewContent && (
            <div style={{ marginTop: 6, fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-text-muted)', background: 'rgba(0,196,184,0.03)', border: '1px solid rgba(0,196,184,0.08)', borderRadius: 6, padding: '6px 8px', maxHeight: 100, overflowY: 'auto' }} className="scrollbar-jarvis">
              {run.previewContent.slice(0, 800)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Tasks page ───────────────────────────────────────────

const STATUS_FILTERS: { value: TaskRunStatus | 'all'; label: string }[] = [
  { value: 'all',       label: 'ALL' },
  { value: 'running',   label: 'RUNNING' },
  { value: 'completed', label: 'DONE' },
  { value: 'failed',    label: 'FAILED' },
];
const TRIGGER_FILTERS: { value: TriggerType | 'all'; label: string }[] = [
  { value: 'all',       label: 'ANY SOURCE' },
  { value: 'manual',    label: 'MANUAL' },
  { value: 'scheduled', label: 'SCHEDULED' },
  { value: 'event',     label: 'EVENT' },
];

export default function Tasks() {
  const [activeRuns, setActiveRuns]   = useState<TaskRun[]>([]);
  const [historyRuns, setHistoryRuns] = useState<TaskRun[]>([]);
  const [submitting, setSubmitting]   = useState(false);
  const [searchQ, setSearchQ]         = useState('');
  const [statusFilter, setStatusFilter]   = useState<TaskRunStatus | 'all'>('all');
  const [triggerFilter, setTriggerFilter] = useState<TriggerType | 'all'>('all');
  const addActiveTask = useJarvisStore(s => s.addActiveTask);

  // Load recent task runs on mount and every 10s
  const loadHistory = useCallback(async () => {
    const params: Parameters<typeof getTaskRuns>[0] = { limit: 80 };
    if (statusFilter !== 'all')  params.status      = statusFilter;
    if (triggerFilter !== 'all') params.triggerType  = triggerFilter;
    if (searchQ.length > 1)      params.q            = searchQ;
    const runs = await getTaskRuns(params);
    // Split into active (running/queued) and history (everything else)
    const active  = runs.filter((r) => r.status === 'running' || r.status === 'queued');
    const history = runs.filter((r) => r.status !== 'running' && r.status !== 'queued');
    setActiveRuns(active);
    setHistoryRuns(history);
  }, [searchQ, statusFilter, triggerFilter]);

  useEffect(() => {
    loadHistory();
    const id = setInterval(loadHistory, 8000);
    return () => clearInterval(id);
  }, [loadHistory]);

  const handleCommand = async (text: string) => {
    setSubmitting(true);
    try {
      const { taskRunId } = await submitCommand(text, { triggerType: 'manual' });
      if (taskRunId) {
        addActiveTask(taskRunId);
        // Optimistically add to active runs
        const optimistic: TaskRun = {
          id: taskRunId, commandText: text, triggerType: 'manual',
          agentId: 'claude', status: 'queued', steps: [],
          retryCount: 0, createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setActiveRuns((prev) => [optimistic, ...prev]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const removeCard = (id: string) => {
    setActiveRuns((prev) => prev.filter((r) => r.id !== id));
  };

  // When a running card completes, move it to history after a short delay
  const onCardStatusChange = useCallback(() => {
    setTimeout(loadHistory, 2000);
  }, [loadHistory]);

  // Combined filter for history
  const filteredHistory = historyRuns.filter((r) => {
    if (statusFilter !== 'all'  && r.status      !== statusFilter)  return false;
    if (triggerFilter !== 'all' && r.triggerType !== triggerFilter) return false;
    if (searchQ.length > 1 && !r.commandText.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 10, gap: 8, overflow: 'hidden' }}>

      {/* ── Command bar ── */}
      <CommandBar onSubmit={handleCommand} loading={submitting} />

      {/* ── Auto triggers ── */}
      <AutoTriggers />

      {/* ── Active tasks grid ── */}
      {activeRuns.length > 0 && (
        <div style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--j-font-head)', fontSize: 10, color: 'var(--j-text-muted)', letterSpacing: '0.18em' }}>ACTIVE</span>
            <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-teal)', background: 'rgba(0,196,184,0.12)', border: '1px solid rgba(0,196,184,0.2)', borderRadius: 8, padding: '1px 6px' }}>
              {activeRuns.length}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: activeRuns.length === 1 ? '1fr' : 'repeat(2, 1fr)', gap: 8 }}>
            {activeRuns.map((run) => (
              <TaskRunCard key={run.id} run={run} onRemove={removeCard} />
            ))}
          </div>
        </div>
      )}

      {/* ── History ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {/* History header with search + filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--j-font-head)', fontSize: 10, color: 'var(--j-text-muted)', letterSpacing: '0.18em', flexShrink: 0 }}>HISTORY</span>
          <div style={{ position: 'relative', flex: '0 1 180px' }}>
            <Search size={10} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--j-text-faint)', pointerEvents: 'none' }} />
            <input
              className="j-input"
              style={{ height: 26, paddingLeft: 24, fontSize: 10 }}
              placeholder="Search commands…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map((f) => (
              <button key={f.value} onClick={() => setStatusFilter(f.value)}
                className="j-mono"
                style={{ height: 22, padding: '0 8px', fontSize: 8, letterSpacing: '0.08em', cursor: 'pointer', borderRadius: 8, border: '1px solid', transition: 'all 0.15s',
                  background: statusFilter === f.value ? 'rgba(0,196,184,0.12)' : 'transparent',
                  borderColor: statusFilter === f.value ? 'rgba(0,196,184,0.35)' : 'rgba(120,168,220,0.12)',
                  color: statusFilter === f.value ? 'var(--j-teal)' : 'var(--j-text-faint)',
                }}>
                {f.label}
              </button>
            ))}
            <span style={{ color: 'rgba(120,168,220,0.2)', alignSelf: 'center' }}>|</span>
            {TRIGGER_FILTERS.map((f) => (
              <button key={f.value} onClick={() => setTriggerFilter(f.value)}
                className="j-mono"
                style={{ height: 22, padding: '0 8px', fontSize: 8, letterSpacing: '0.08em', cursor: 'pointer', borderRadius: 8, border: '1px solid', transition: 'all 0.15s',
                  background: triggerFilter === f.value ? 'rgba(120,96,194,0.12)' : 'transparent',
                  borderColor: triggerFilter === f.value ? 'rgba(120,96,194,0.35)' : 'rgba(120,168,220,0.12)',
                  color: triggerFilter === f.value ? 'var(--j-violet)' : 'var(--j-text-faint)',
                }}>
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={loadHistory} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--j-text-faint)', padding: 0, display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
            <RefreshCw size={11} />
          </button>
        </div>

        {/* History list */}
        <div className="scrollbar-jarvis" style={{ flex: 1, overflowY: 'auto' }}>
          {filteredHistory.length === 0 && (
            <div className="j-empty">
              {historyRuns.length === 0
                ? 'NO TASK HISTORY YET — ISSUE YOUR FIRST COMMAND ABOVE'
                : 'NO RESULTS MATCH THE CURRENT FILTERS'}
            </div>
          )}
          {filteredHistory.map((run) => (
            <HistoryRow key={run.id} run={run} onRerun={handleCommand} />
          ))}
        </div>

        {/* Footer stats */}
        <div className="j-mono" style={{ fontSize: 9, color: 'var(--j-text-faint)', display: 'flex', gap: 14, paddingTop: 6, flexShrink: 0 }}>
          <span>{historyRuns.length} TOTAL</span>
          <span>{historyRuns.filter((r) => r.status === 'completed').length} COMPLETED</span>
          <span>{historyRuns.filter((r) => r.status === 'failed').length} FAILED</span>
          <span>{historyRuns.filter((r) => r.triggerType === 'scheduled').length} SCHEDULED</span>
        </div>
      </div>
    </div>
  );
}
