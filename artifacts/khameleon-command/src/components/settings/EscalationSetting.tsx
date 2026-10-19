import { useEffect, useState } from 'react';
import { getEscalationMode, setEscalationMode, type EscalationMode } from '@/lib/escalationApi';
import { useUi, Label, Hint, Msg, Group, type Tone } from './ui';

/**
 * Settings > AI > "When a task is tricky" (docs/khami-design.md, step 5):
 * Khami asks before handing work to an outside AI (default), hands it over
 * automatically, or never does. Confidential work stays with Khami whatever
 * this says.
 */
const OPTIONS: { value: EscalationMode; label: string; hint: string }[] = [
  { value: 'ask', label: 'Ask me first', hint: 'Khami offers to hand it over - you decide each time.' },
  { value: 'auto', label: 'Hand over automatically', hint: 'Tricky work goes straight to your outside AI (Copilot first).' },
  { value: 'never', label: 'Never hand over', hint: 'Khami always does it, and says when an answer may be weaker.' },
];

export function EscalationSetting({ tone }: { tone: Tone }) {
  const { btn } = useUi(tone);
  const [mode, setMode] = useState<EscalationMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { getEscalationMode().then(setMode).catch(() => setMode('ask')); }, []);

  const choose = async (m: EscalationMode) => {
    setError(null);
    try { setMode(await setEscalationMode(m)); } catch (e) { setError(e instanceof Error ? e.message : 'Couldn\'t save'); }
  };

  return (
    <Group>
      <Label tone={tone}>When a task is tricky for Khami</Label>
      <div role="radiogroup" aria-label="When a task is tricky for Khami" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {OPTIONS.map(o => (
          <button key={o.value} type="button" role="radio" aria-checked={mode === o.value} onClick={() => void choose(o.value)} style={btn(mode === o.value)}>{o.label}</button>
        ))}
      </div>
      <Hint tone={tone}>{OPTIONS.find(o => o.value === mode)?.hint ?? ''} Confidential conversations always stay with Khami on this computer.</Hint>
      {error && <Msg tone={tone} ok={false}>{error}</Msg>}
    </Group>
  );
}
