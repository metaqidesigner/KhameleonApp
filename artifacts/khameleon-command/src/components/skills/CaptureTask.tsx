import { useCallback, useEffect, useState } from 'react';
import { captureBridge, type CaptureStatus } from '@/lib/desktopBridge';

/**
 * Capture a task (docs/build-review.md, Build 4): the user does a task once
 * while Khameleon watches which apps and windows they move through, then the
 * first available AI (Khami first) writes it up as a skill draft for the
 * guided skill maker. Only possible inside the desktop app. Shared by the
 * Overlay (toolbar "Capture a task") and Classic's Skill Sets page.
 */
type Tone = 'overlay' | 'classic';

const TONES: Record<Tone, { text: string; muted: string; glass: string; border: string; accent: string; rec: string; warn: string; bad: string; input: string; radius: number }> = {
  overlay: { text: '#d6efee', muted: '#8fb4b6', glass: 'rgba(10,22,26,0.82)', border: 'rgba(255,255,255,0.14)', accent: '#6FE6BD', rec: '#8fd3ff', warn: '#ffb36b', bad: '#ff9b9b', input: 'rgba(0,0,0,0.25)', radius: 12 },
  classic: { text: 'var(--j-text)', muted: 'var(--j-text-muted)', glass: 'rgba(0,10,16,0.92)', border: 'rgba(0,212,255,0.25)', accent: 'var(--j-cyan)', rec: 'var(--j-cyan)', warn: 'var(--j-amber)', bad: 'var(--j-red)', input: 'rgba(0,4,8,0.6)', radius: 2 },
};

export interface CaptureDraft { name: string; description: string; steps: string; source: string; recording?: unknown[] }

const BASE = import.meta.env.VITE_API_URL || '/api';

export function useCaptureTask(onDraft: (draft: CaptureDraft) => void) {
  const bridge = captureBridge();
  const [status, setStatus] = useState<CaptureStatus | null>(null);
  const [intro, setIntro] = useState(false);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bridge) return;
    bridge.status().then(setStatus).catch(() => {});
    return bridge.onUpdate(setStatus);
  }, [bridge]);

  const act = useCallback(async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
  }, []);

  const open = useCallback(() => { setError(null); setIntro(true); }, []);
  const close = useCallback(() => { setIntro(false); setError(null); }, []);

  const stop = useCallback(() => act(async () => {
    if (!bridge) return;
    const steps = await bridge.stop();
    if (!steps.length) { await bridge.discard(); setError('Nothing was recorded - switch to the app you work in after pressing Start.'); return; }
    setWriting(true);
    try {
      const res = await fetch(`${BASE}/skill-sets/guide/from-capture`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: steps.map(({ app, title, text, note, actions }) => ({ app, title, text, note, actions })) }),
      });
      const body = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) throw new Error(body.error ?? `Request failed (HTTP ${res.status})`);
      const by = body.by === 'KHAMI' ? 'Khami' : body.by;
      const recording = steps.flatMap(s => s.actions ?? []);
      onDraft({
        name: body.name ?? '', description: body.description ?? '', steps: body.steps ?? '', recording: recording.length ? recording : undefined,
        source: `Written up by ${by} from your recording (${steps.length} step${steps.length === 1 ? '' : 's'}${recording.length ? `, ${recording.length} clicks and typing - it can be replayed` : ''}).`,
      });
    } finally {
      setWriting(false);
      await bridge.discard();
    }
  }), [act, bridge, onDraft]);

  return {
    available: !!bridge,
    status, intro, writing, error,
    open, close,
    start: () => act(async () => { setIntro(false); await bridge?.start(); }),
    pause: () => act(async () => { await bridge?.pause(); }),
    resume: () => act(async () => { await bridge?.resume(); }),
    note: (text: string) => act(async () => { await bridge?.note(text); }),
    discard: () => act(async () => { await bridge?.discard(); }),
    openSnapshotSettings: () => void bridge?.openSnapshotSettings(),
    openInputSettings: () => void bridge?.openInputSettings?.(),
    stop,
  };
}

export type CaptureTask = ReturnType<typeof useCaptureTask>;

/**
 * The intro card and the recording bar. Renders nothing when idle. Sits at
 * the top centre of the screen so it stays out of the way of the work.
 */
export function CaptureBar({ capture, tone, onDescribeInstead }: { capture: CaptureTask; tone: Tone; onDescribeInstead: () => void }) {
  const t = TONES[tone];
  const [noteText, setNoteText] = useState('');
  const [noting, setNoting] = useState(false);
  const s = capture.status;
  const active = s && (s.state === 'recording' || s.state === 'paused' || s.state === 'processing');
  if (!capture.intro && !active && !capture.writing && !capture.error) return null;

  const btn = (primary?: boolean): React.CSSProperties => ({
    padding: '5px 11px', borderRadius: t.radius === 2 ? 2 : 8, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
    background: primary ? 'rgba(111,230,189,0.14)' : 'transparent', border: `1px solid ${primary ? t.accent : t.border}`, color: t.text,
  });
  const shell: React.CSSProperties = {
    position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 60, maxWidth: 'calc(100vw - 32px)',
    padding: '10px 14px', borderRadius: t.radius, background: t.glass, border: `1px solid ${t.border}`, color: t.text,
    backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxShadow: '0 8px 30px rgba(0,0,0,0.35)', fontSize: 12.5,
  };

  if (capture.intro) {
    return (
      <div data-overlay-hit role="dialog" aria-label="Capture a task" style={{ ...shell, width: 420, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontWeight: 600 }}>Capture a task</div>
        <div style={{ color: t.muted, lineHeight: 1.45 }}>
          Do the task once as you normally would. Khameleon notes each app and window, and the buttons you click and what you type (never passwords),
          then writes it up as a skill you can check - and replay. Everything stays on this computer; snapshots are deleted once the skill is saved.
        </div>
        {s && !s.snapshotsAllowed && (
          <div style={{ color: t.warn, lineHeight: 1.45 }}>
            For more detail, allow Khameleon to take snapshots (Screen Recording in your Mac's settings). Without it, only window names are noted.{' '}
            <button type="button" style={{ ...btn(), padding: '2px 8px', fontSize: 11 }} onClick={capture.openSnapshotSettings}>Open settings</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button type="button" style={btn()} onClick={capture.close}>Cancel</button>
          <button type="button" style={btn()} onClick={() => { capture.close(); onDescribeInstead(); }}>Describe it instead</button>
          <button type="button" style={btn(true)} onClick={() => void capture.start()}>Start recording</button>
        </div>
      </div>
    );
  }

  if (capture.writing || s?.state === 'processing') {
    return <div data-overlay-hit role="status" style={shell}>Writing up your task as a skill - this can take a minute or two…</div>;
  }

  if (!active) {
    return (
      <div data-overlay-hit role="alert" style={{ ...shell, display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ color: t.bad }}>{capture.error}</span>
        <button type="button" style={btn()} onClick={capture.close}>OK</button>
      </div>
    );
  }

  const recording = s.state === 'recording';
  const where = [s.currentApp, s.currentTitle].filter(Boolean).join(' - ');
  return (
    <div data-overlay-hit role="region" aria-label="Recording a task" style={{ ...shell, display: 'flex', flexDirection: 'column', gap: 8, width: 560 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, background: recording ? t.rec : t.muted, boxShadow: recording ? `0 0 8px ${t.rec}` : 'none' }} />
        <span style={{ fontWeight: 600, flexShrink: 0 }}>{recording ? 'Recording' : 'Paused'}</span>
        <span style={{ color: t.muted, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {where || 'Switch to the app you work in to begin'}
        </span>
        <span style={{ color: t.muted, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{s.steps} step{s.steps === 1 ? '' : 's'}</span>
      </div>
      {noting ? (
        <form style={{ display: 'flex', gap: 6 }} onSubmit={e => { e.preventDefault(); if (noteText.trim()) { void capture.note(noteText); setNoteText(''); setNoting(false); } }}>
          <input autoFocus aria-label="Note for this step" placeholder="e.g. Only invoices over £500 need approval" value={noteText} onChange={e => setNoteText(e.target.value)}
            style={{ flex: 1, minWidth: 0, padding: '5px 9px', borderRadius: t.radius === 2 ? 2 : 8, fontSize: 12, fontFamily: 'inherit', background: t.input, border: `1px solid ${t.border}`, color: t.text }} />
          <button type="submit" style={btn(true)} disabled={!noteText.trim()}>Add</button>
          <button type="button" style={btn()} onClick={() => setNoting(false)}>Cancel</button>
        </form>
      ) : (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" style={btn()} onClick={() => setNoting(true)}>Add a note</button>
          {recording
            ? <button type="button" style={btn()} onClick={() => void capture.pause()}>Pause</button>
            : <button type="button" style={btn()} onClick={() => void capture.resume()}>Resume</button>}
          <button type="button" style={btn()} onClick={() => void capture.discard()}>Discard</button>
          <span style={{ flex: 1 }} />
          <button type="button" style={btn(true)} onClick={() => void capture.stop()}>Stop and write it up</button>
        </div>
      )}
      {s.fullRecording && <div style={{ fontSize: 11, color: t.muted }}>Recording clicks and typing too - passwords are never recorded.</div>}
      {!s.fullRecording && s.fullRecordingNote && (
        <div style={{ fontSize: 11, color: t.muted }}>
          {s.fullRecordingNote}{' '}
          <button type="button" onClick={capture.openInputSettings} style={{ background: 'none', border: 'none', padding: 0, color: t.accent, cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}>Allow clicks and typing</button>
        </div>
      )}
      {!s.snapshotsAllowed && (
        <div style={{ fontSize: 11, color: t.muted }}>
          Snapshots are off, so screen text isn't read.{' '}
          <button type="button" onClick={capture.openSnapshotSettings} style={{ background: 'none', border: 'none', padding: 0, color: t.accent, cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}>Allow snapshots</button>
        </div>
      )}
      {capture.error && <div role="alert" style={{ fontSize: 11.5, color: t.bad }}>{capture.error}</div>}
    </div>
  );
}
