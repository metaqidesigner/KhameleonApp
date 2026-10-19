import { useState } from 'react';
import { TONES, type Tone } from '@/components/settings/ui';

/**
 * Capture full recording: "Replay" for a skill that has recorded clicks and
 * typing. The desktop app finds each step's button or box by name and stops
 * at the first one it can't find - it never guesses. Shared by the Overlay
 * and Classic.
 */
interface Report { ok: boolean; done: number; total: number; steps: { n: number; what: string; ok: boolean; message: string }[] }
const BASE = import.meta.env.VITE_API_URL || '/api';

export function ReplaySkill({ tone, skillId, steps }: { tone: Tone; skillId: number; steps: number }) {
  const t = TONES[tone];
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true); setError(null); setReport(null);
    try {
      const res = await fetch(`${BASE}/skill-sets/${skillId}/replay`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'The replay couldn\'t run.');
      setReport(body);
    } catch (e) { setError(e instanceof Error ? e.message : 'The replay couldn\'t run.'); }
    setBusy(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5, color: t.text }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" disabled={busy} onClick={() => void run()} style={{ padding: '4px 10px', borderRadius: t.radius, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', color: t.text, background: 'rgba(111,230,189,0.14)', border: `1px solid ${t.accent}` }}>
          {busy ? 'Replaying… (hands off the mouse)' : `Replay the recording (${steps} steps)`}
        </button>
        <span style={{ color: t.muted, fontSize: 10.5 }}>Repeats the recorded clicks and typing exactly; pauses while you use the computer; stops if a button or box can't be found.</span>
      </div>
      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ color: report.ok ? t.good : t.warn }}>{report.ok ? `Done - all ${report.total} steps.` : `Stopped at step ${report.done + 1} of ${report.total}.`}</div>
          {report.steps.slice(-6).map(s => (
            <div key={s.n} style={{ color: s.ok ? t.muted : t.bad }}>{s.n}. {s.what} - {s.message}</div>
          ))}
        </div>
      )}
      {error && <div role="alert" style={{ color: t.bad }}>{error}</div>}
    </div>
  );
}
