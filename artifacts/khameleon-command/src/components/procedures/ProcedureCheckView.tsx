import { useCallback, useEffect, useState } from 'react';
import { listProcedureChecks, recheckSkill, type ProcedureCheck, type FlagKind } from '@/lib/proceduresApi';
import { TONES, useUi, type Tone } from '@/components/settings/ui';

/**
 * Build 5: how a skill compares with its company procedure - a badge
 * ("Matches" / "Differs at step N" / "No procedure found") and, opened, a
 * side-by-side view where every flag quotes the procedure text it relies
 * on. Shared by the Overlay's Skills panel and Classic's Skill Sets page.
 */

/** All checks, by skill id; reloads every 20s while a check may still be running in the background. */
export function useProcedureChecks() {
  const [checks, setChecks] = useState<Record<number, ProcedureCheck>>({});
  const load = useCallback(() => listProcedureChecks().then(list => setChecks(Object.fromEntries(list.map(c => [c.skillSetId, c])))).catch(() => {}), []);
  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(id);
  }, [load]);
  return { checks, reload: load };
}

export function CheckBadge({ tone, check, onClick, open }: { tone: Tone; check?: ProcedureCheck; onClick?: () => void; open?: boolean }) {
  const t = TONES[tone];
  if (!check) return null;
  const text = check.status === 'matches' ? 'Matches procedure'
    : check.status === 'differs' ? `Differs at step ${check.firstDifference ?? '?'}`
    : 'No procedure found';
  const colour = check.status === 'matches' ? t.good : check.status === 'differs' ? t.warn : t.muted;
  return (
    <button type="button" onClick={onClick} aria-expanded={open} title={check.status === 'no_procedure' ? (check.result.reason ?? '') : `Compared with ${check.result.documentName} - ${check.result.sectionHeading}`}
      style={{ fontSize: 10, padding: '1px 8px', borderRadius: tone === 'classic' ? 2 : 999, cursor: onClick ? 'pointer' : 'default', fontFamily: 'inherit',
        background: 'transparent', border: `1px solid ${colour}`, color: colour, whiteSpace: 'nowrap' }}>
      {text}{check.needsReview ? ' · procedure changed' : ''}
    </button>
  );
}

const FLAG_LABEL: Record<FlagKind, string> = { missing: 'Missing', extra: 'Not in the procedure', order: 'Out of order', contradicts: 'Contradicts' };

export function CheckDetails({ tone, skillId, check, onRechecked }: { tone: Tone; skillId: number; check: ProcedureCheck; onRechecked: () => void }) {
  const { t, btn } = useUi(tone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const r = check.result;
  const missingAfter = (n: number) => (r.missing ?? []).filter(m => m.afterStep === n);
  const matchedProc = new Set((r.steps ?? []).map(s => s.match?.procStep).filter(Boolean) as number[]);

  const recheck = async () => {
    setBusy(true); setError(null);
    try { await recheckSkill(skillId); onRechecked(); } catch (e) { setError(e instanceof Error ? e.message : 'Couldn\'t check'); }
    setBusy(false);
  };

  const flagRow = (kind: FlagKind, note: string, quote?: string, lessCertain?: boolean, key?: string) => (
    <div key={key} style={{ fontSize: 11, lineHeight: 1.4, padding: '4px 7px', borderRadius: t.radius, background: kind === 'contradicts' ? 'rgba(255,155,155,0.08)' : 'rgba(255,179,107,0.08)', borderLeft: `2px solid ${kind === 'contradicts' ? t.bad : t.warn}` }}>
      <strong style={{ color: kind === 'contradicts' ? t.bad : t.warn }}>{FLAG_LABEL[kind]}</strong>{lessCertain ? <span style={{ color: t.muted }}> (less certain)</span> : null}: {note}
      {quote && <div style={{ color: t.muted, marginTop: 2 }}>Procedure says: “{quote}”</div>}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: t.radius, background: t.card, border: `1px solid ${t.border}`, color: t.text }}>
      {check.status === 'no_procedure' ? (
        <div style={{ fontSize: 12, color: t.muted }}>{r.reason ?? 'No procedure covers this skill.'} Add procedure documents in Workspace → Domains &amp; documents.</div>
      ) : (
        <>
          <div style={{ fontSize: 11.5, color: t.muted }}>
            Compared with <strong style={{ color: t.text }}>{r.documentName}</strong> - {r.sectionHeading}
            {check.lessCertain && ' · contradiction checks are Khami\'s judgment - less certain'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.muted }}>This skill</div>
              {missingAfter(0).map(m => flagRow('missing', `Procedure step ${m.procStep} comes before this.`, m.quote, false, `m0-${m.procStep}`))}
              {(r.steps ?? []).map(s => (
                <div key={s.n} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                    <span style={{ color: s.flags.length ? t.warn : t.good }}>{s.n}.</span> {s.text}
                    {s.match && <span style={{ color: t.muted, fontSize: 10.5 }}> → procedure step {s.match.procStep}</span>}
                  </div>
                  {s.flags.map((f, i) => flagRow(f.kind, f.note, f.kind === 'order' || f.kind === 'contradicts' ? f.quote : undefined, f.lessCertain, `${s.n}-${i}`))}
                  {missingAfter(s.n).map(m => flagRow('missing', `The procedure has a step here (its step ${m.procStep}).`, m.quote, false, `m${s.n}-${m.procStep}`))}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.muted }}>The procedure</div>
              {(r.procedure ?? []).map((p, i) => (
                <div key={i} style={{ fontSize: 12, lineHeight: 1.4, color: matchedProc.has(i + 1) ? t.text : t.warn }}>
                  {i + 1}. {p}{!matchedProc.has(i + 1) && <span style={{ fontSize: 10.5 }}> (not in the skill)</span>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" style={btn()} disabled={busy} onClick={() => void recheck()}>{busy ? 'Checking… (Khami can take a minute)' : 'Re-check'}</button>
        <span style={{ fontSize: 10.5, color: t.muted }}>Checked {new Date(check.checkedAt).toLocaleString()}</span>
      </div>
      {error && <div role="alert" style={{ fontSize: 11.5, color: t.bad }}>{error}</div>}
    </div>
  );
}
