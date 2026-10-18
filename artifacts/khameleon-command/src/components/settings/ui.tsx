import type { ReactNode } from 'react';

/**
 * Shared look for the Settings sections (docs/gap-review.md Q18 + final):
 * the same sections appear in the Overlay's Settings panel and Classic's
 * Settings page, styled for each.
 */
export type Tone = 'overlay' | 'classic';

export const TONES: Record<Tone, { text: string; muted: string; card: string; border: string; accent: string; good: string; warn: string; bad: string; input: string; radius: number }> = {
  overlay: { text: '#d6efee', muted: '#8fb4b6', card: 'rgba(255,255,255,0.035)', border: 'rgba(255,255,255,0.12)', accent: '#6FE6BD', good: '#6FE6BD', warn: '#ffb36b', bad: '#ff9b9b', input: 'rgba(0,0,0,0.25)', radius: 8 },
  classic: { text: 'var(--j-text)', muted: 'var(--j-text-muted)', card: 'rgba(0,212,255,0.03)', border: 'rgba(0,212,255,0.15)', accent: 'var(--j-cyan)', good: 'var(--j-green)', warn: 'var(--j-amber)', bad: 'var(--j-red)', input: 'rgba(0,4,8,0.6)', radius: 2 },
};

export function useUi(tone: Tone) {
  const t = TONES[tone];
  const input: React.CSSProperties = { width: '100%', padding: '7px 9px', borderRadius: t.radius, fontSize: 12.5, fontFamily: 'inherit', background: t.input, border: `1px solid ${t.border}`, color: t.text, boxSizing: 'border-box' };
  const btn = (primary?: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: t.radius, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
    background: primary ? 'rgba(111,230,189,0.14)' : 'transparent', border: `1px solid ${primary ? t.accent : t.border}`, color: t.text,
  });
  return { t, input, btn };
}

/* Defined once, outside any component, so inputs inside them keep focus while typing. */
export function Label({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: TONES[tone].text }}>{children}</div>;
}
export function Hint({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <div style={{ fontSize: 11, color: TONES[tone].muted, lineHeight: 1.45 }}>{children}</div>;
}
export function Msg({ tone, ok, children }: { tone: Tone; ok: boolean; children: ReactNode }) {
  return <div role={ok ? 'status' : 'alert'} style={{ fontSize: 11.5, color: ok ? TONES[tone].good : TONES[tone].bad, lineHeight: 1.4 }}>{children}</div>;
}
export function Group({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>;
}
