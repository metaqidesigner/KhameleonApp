import { useState } from 'react';
import { LICENCE_NOTICES, LICENCE_TEXTS, type LicenceNotice } from '@/lib/licences';

/**
 * About Khameleon -> Licences (docs/legal-compliance.md): the notices
 * Khameleon is required to keep for the third-party parts it uses. Shared
 * by the Overlay (head menu) and Classic (Settings -> ABOUT).
 */
type Tone = 'overlay' | 'classic';

const TONES: Record<Tone, { text: string; muted: string; card: string; border: string; radius: number }> = {
  overlay: { text: '#d6efee', muted: '#8fb4b6', card: 'rgba(255,255,255,0.035)', border: 'rgba(255,255,255,0.1)', radius: 10 },
  classic: { text: 'var(--j-text)', muted: 'var(--j-text-muted)', card: 'rgba(0,4,8,0.6)', border: 'rgba(0,212,255,0.15)', radius: 2 },
};

export function AboutLicences({ tone }: { tone: Tone }) {
  const t = TONES[tone];
  const [shown, setShown] = useState<LicenceNotice['licence'] | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, color: t.text }}>
      <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.5 }}>
        Khameleon is built with the help of the open-source software, models and materials below. Their licences require us to keep these notices.
      </div>
      {LICENCE_NOTICES.map(n => (
        <div key={n.component} style={{ padding: '8px 10px', borderRadius: t.radius, background: t.card, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{n.component}</div>
          <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{n.usedFor} · {n.licence}</div>
          <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{n.copyright}</div>
          {n.modified && <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>Changes: {n.modified}</div>}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(Object.keys(LICENCE_TEXTS) as LicenceNotice['licence'][]).map(l => (
          <button key={l} type="button" onClick={() => setShown(s => (s === l ? null : l))} aria-expanded={shown === l}
            style={{ padding: '5px 10px', borderRadius: t.radius, fontSize: 11.5, fontFamily: 'inherit', cursor: 'pointer', background: 'transparent', border: `1px solid ${t.border}`, color: t.text }}>
            {shown === l ? `Hide ${l} licence text` : `Show ${l} licence text`}
          </button>
        ))}
      </div>
      {shown && (
        <pre style={{ margin: 0, padding: 10, borderRadius: t.radius, background: t.card, border: `1px solid ${t.border}`, fontSize: 10.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', maxHeight: 280, overflowY: 'auto', color: t.muted }}>
          {LICENCE_TEXTS[shown]}
        </pre>
      )}
    </div>
  );
}
