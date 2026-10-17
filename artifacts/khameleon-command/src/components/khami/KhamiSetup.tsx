import { useCallback, useEffect, useState } from 'react';
import { getKhamiSetup, downloadKhamiBrain, chooseKhamiBrain, type KhamiSetup as Setup, type BrainId } from '@/lib/khamiApi';

/**
 * Khami setup (docs/khami-design.md): pick Khami's brain - Standard or
 * Better - and download it, with progress. Shared by the Overlay (head menu
 * and first-run prompt) and Classic (first-run wizard, Settings).
 */

type Tone = 'overlay' | 'classic';

const TONES: Record<Tone, { text: string; muted: string; card: string; cardActive: string; border: string; borderActive: string; accent: string; bad: string; radius: number }> = {
  overlay: { text: '#d6efee', muted: '#8fb4b6', card: 'rgba(255,255,255,0.035)', cardActive: 'rgba(111,230,189,0.1)', border: 'rgba(255,255,255,0.1)', borderActive: 'rgba(111,230,189,0.55)', accent: '#6FE6BD', bad: '#ffb0b0', radius: 10 },
  classic: { text: 'var(--j-text)', muted: 'var(--j-text-muted)', card: 'rgba(0,4,8,0.6)', cardActive: 'rgba(0,212,255,0.08)', border: 'rgba(0,212,255,0.15)', borderActive: 'var(--j-cyan)', accent: 'var(--j-cyan)', bad: 'var(--j-red)', radius: 2 },
};

export function KhamiSetup({ tone, onReady }: { tone: Tone; onReady?: () => void }) {
  const t = TONES[tone];
  const [setup, setSetup] = useState<Setup | null>(null);
  const [selected, setSelected] = useState<BrainId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getKhamiSetup()
      .then(s => { setSetup(s); setSelected(prev => prev ?? s.active ?? s.recommended); })
      .catch(e => setError(e instanceof Error ? e.message : "Couldn't reach Khameleon's server"));
  }, []);
  useEffect(load, [load]);

  // Follow a download in progress.
  const downloading = setup?.download.state === 'downloading';
  useEffect(() => {
    if (!downloading) return;
    const id = window.setInterval(load, 1000);
    return () => window.clearInterval(id);
  }, [downloading, load]);

  useEffect(() => {
    if (setup?.download.state === 'done' && setup.active) onReady?.();
  }, [setup?.download.state, setup?.active, onReady]);

  if (error && !setup) return <div role="alert" style={{ fontSize: 12, color: t.bad }}>{error}</div>;
  if (!setup) return <div style={{ fontSize: 12, color: t.muted }}>Checking this computer…</div>;

  const choice = setup.brains.find(b => b.id === selected) ?? setup.brains[0];
  const go = async () => {
    setError(null);
    try {
      if (choice.downloaded) { setSetup(await chooseKhamiBrain(choice.id)); onReady?.(); }
      else { await downloadKhamiBrain(choice.id); load(); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
  };

  const d = setup.download;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, color: t.text }}>
      <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.5 }}>
        Khami is Khameleon's own AI. It runs privately on this computer - nothing you ask it leaves your machine, and it works without internet.
        Choose how capable it should be. This computer has about {setup.memoryGb} GB of memory.
      </div>

      <div role="radiogroup" aria-label="Khami's brain" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {setup.brains.map(b => {
          const isSel = b.id === selected;
          return (
            <button key={b.id} type="button" role="radio" aria-checked={isSel} disabled={downloading} onClick={() => setSelected(b.id)}
              style={{
                textAlign: 'left', padding: '10px 12px', borderRadius: t.radius, cursor: downloading ? 'default' : 'pointer', fontFamily: 'inherit',
                background: isSel ? t.cardActive : t.card, border: `1px solid ${isSel ? t.borderActive : t.border}`, color: t.text,
              }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{b.label}</span>
                <span style={{ fontSize: 11, color: t.muted }}>about {b.sizeGb} GB download</span>
                {b.id === setup.recommended && <span style={{ fontSize: 10.5, color: t.accent }}>Recommended for this computer</span>}
                {setup.active === b.id && <span style={{ fontSize: 10.5, color: t.accent }}>In use</span>}
                {b.downloaded && setup.active !== b.id && <span style={{ fontSize: 10.5, color: t.muted }}>Downloaded</span>}
              </div>
              <div style={{ fontSize: 11.5, color: t.muted, marginTop: 4, lineHeight: 1.45 }}>{b.description}</div>
              {!b.fitsThisComputer && <div style={{ fontSize: 11, color: t.bad, marginTop: 4 }}>This computer may be too small for it - it could run slowly.</div>}
            </button>
          );
        })}
      </div>

      {downloading && (
        <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div role="progressbar" aria-valuenow={d.percent ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="Download progress"
            style={{ height: 6, borderRadius: 3, background: t.card, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
            <div style={{ width: `${d.percent ?? 0}%`, height: '100%', background: t.accent, transition: 'width 400ms ease' }} />
          </div>
          <div style={{ fontSize: 11.5, color: t.muted, fontVariantNumeric: 'tabular-nums' }}>
            Downloading {setup.brains.find(b => b.id === d.brain)?.label ?? ''} brain - {d.percent ?? 0}%
            {d.totalGb ? ` (${d.downloadedGb} of ${d.totalGb} GB)` : ''}. You can keep using Khameleon meanwhile.
          </div>
        </div>
      )}
      {d.state === 'error' && <div role="alert" style={{ fontSize: 12, color: t.bad }}>The download stopped: {d.error}. Check the internet connection and try again.</div>}
      {error && <div role="alert" style={{ fontSize: 12, color: t.bad }}>{error}</div>}
      {setup.active && !downloading && <div style={{ fontSize: 12, color: t.accent }}>Khami is ready to use offline.</div>}

      {!downloading && (
        <div>
          <button type="button" onClick={() => void go()} disabled={setup.active === choice.id}
            style={{
              padding: '7px 14px', borderRadius: t.radius, fontSize: 12.5, fontFamily: 'inherit', cursor: setup.active === choice.id ? 'default' : 'pointer',
              background: t.cardActive, border: `1px solid ${t.borderActive}`, color: t.text, opacity: setup.active === choice.id ? 0.5 : 1,
            }}>
            {choice.downloaded ? (setup.active === choice.id ? `Using ${choice.label}` : `Switch to ${choice.label}`) : `Download ${choice.label} (about ${choice.sizeGb} GB)`}
          </button>
        </div>
      )}
      <div style={{ fontSize: 10.5, color: t.muted }}>Khami's brain is {choice.modelName}, an open model licensed for commercial use (Apache 2.0).</div>
    </div>
  );
}
