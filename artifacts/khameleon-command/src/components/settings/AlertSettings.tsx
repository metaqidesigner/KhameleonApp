import { useEffect, useState } from 'react';
import { getPrepSettings, setPrepSettings, getUrgentAlertSettings, setUrgentAlertSettings, type PrepSettings, type UrgentAlertSettings, type AlertMode } from '@/lib/workNoticesApi';
import { useUi, Label, Hint, Msg, Group, type Tone } from './ui';

/** Settings > Alerts (Builds 10-11): meeting briefs, and urgent email flags. */
export function AlertSettings({ tone }: { tone: Tone }) {
  const { btn, input } = useUi(tone);
  const [prep, setPrep] = useState<PrepSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [urgent, setUrgent] = useState<UrgentAlertSettings | null>(null);
  useEffect(() => {
    getPrepSettings().then(setPrep).catch(e => setError(e.message));
    getUrgentAlertSettings().then(setUrgent).catch(() => {});
  }, []);
  const saveUrgent = async (p: Partial<UrgentAlertSettings>) => {
    setError(null);
    try { setUrgent(await setUrgentAlertSettings(p)); } catch (e) { setError(e instanceof Error ? e.message : 'Couldn\'t save'); }
  };
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
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
      {urgent && (
        <Group>
          <Label tone={tone}>Urgent email</Label>
          <div role="radiogroup" aria-label="Urgent email alerts" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([['regular', 'Check every 10 minutes'], ['on_request', 'Only when I ask'], ['off', 'Off']] as [AlertMode, string][]).map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={urgent.mode === v} style={btn(urgent.mode === v)} onClick={() => void saveUrgent({ mode: v })}>{l}</button>
            ))}
            <button type="button" role="radio" aria-checked={false} disabled style={{ ...btn(), opacity: 0.45, cursor: 'not-allowed' }}
              title="Needs Khameleon to be reachable from the internet (hosted mode)">Instant alerts</button>
          </div>
          <Hint tone={tone}>
            {urgent.mode === 'regular' && 'Flags only urgent mail from people you write to, or mail marked important - and says why. Several at once are grouped. '}
            {urgent.mode === 'on_request' && 'Nothing pops up - ask "anything urgent?" in the chat. '}
            Instant alerts need Khameleon to be reachable from the internet (hosted mode), so they aren't available yet.
          </Hint>
          {urgent.mode === 'regular' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
              <span>At most</span>
              <select aria-label="Most flags per day" value={urgent.maxPerDay} onChange={e => void saveUrgent({ maxPerDay: Number(e.target.value) })} style={{ ...input, width: 70 }}>
                {[1, 2, 3, 5, 10].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span>a day · quiet from</span>
              <select aria-label="Quiet hours start" value={urgent.quietStart} onChange={e => void saveUrgent({ quietStart: Number(e.target.value) })} style={{ ...input, width: 90 }}>
                {hours.map(h => <option key={h} value={h}>{hh(h)}</option>)}
              </select>
              <span>to</span>
              <select aria-label="Quiet hours end" value={urgent.quietEnd} onChange={e => void saveUrgent({ quietEnd: Number(e.target.value) })} style={{ ...input, width: 90 }}>
                {hours.map(h => <option key={h} value={h}>{hh(h)}</option>)}
              </select>
            </div>
          )}
        </Group>
      )}
      {error && <Msg tone={tone} ok={false}>{error}</Msg>}
    </div>
  );
}
