import { useEffect, useState } from 'react';
import { getPrepSettings, setPrepSettings, type PrepSettings } from '@/lib/workNoticesApi';
import { useUi, Label, Hint, Msg, Group, type Tone } from './ui';

/** Settings > Alerts (Builds 10-11): meeting briefs - on/off and how long before. */
export function AlertSettings({ tone }: { tone: Tone }) {
  const { btn, input } = useUi(tone);
  const [prep, setPrep] = useState<PrepSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { getPrepSettings().then(setPrep).catch(e => setError(e.message)); }, []);
  const save = async (p: Partial<PrepSettings>) => {
    setError(null);
    try { setPrep(await setPrepSettings(p)); } catch (e) { setError(e instanceof Error ? e.message : 'Couldn\'t save'); }
  };
  if (!prep) return error ? <Msg tone={tone} ok={false}>{error}</Msg> : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Group>
        <Label tone={tone}>Meeting briefs</Label>
        <div style={{ display: 'flex', gap: 6 }}>
          {[true, false].map(v => <button key={String(v)} type="button" aria-pressed={prep.enabled === v} style={btn(prep.enabled === v)} onClick={() => void save({ enabled: v })}>{v ? 'On' : 'Off'}</button>)}
        </div>
        <Hint tone={tone}>Before a meeting with other people, a short brief appears at the top of the screen: who's coming, recent emails from them, related tasks and points to raise. Skips solo blocks, focus time and meetings you've declined. Also in your morning digest, and on request ("prep me for the 3pm").</Hint>
      </Group>
      {prep.enabled && (
        <Group>
          <Label tone={tone}>How long before</Label>
          <select aria-label="Minutes before the meeting" value={prep.leadMinutes} onChange={e => void save({ leadMinutes: Number(e.target.value) })} style={{ ...input, width: 140 }}>
            {[5, 10, 15, 20, 30, 45, 60].map(m => <option key={m} value={m}>{m} minutes</option>)}
          </select>
        </Group>
      )}
      {error && <Msg tone={tone} ok={false}>{error}</Msg>}
    </div>
  );
}
