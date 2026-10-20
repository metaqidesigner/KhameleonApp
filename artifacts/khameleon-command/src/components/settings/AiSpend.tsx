import { useCallback, useEffect, useState } from 'react';
import { useUi, Label, Hint, Msg, Group, type Tone } from './ui';

/**
 * Settings > AI > Spend (download decisions, step 4): this month's estimated
 * spend on pay-per-use AIs and an optional monthly limit - shown only when one
 * is set up (people using Khami or their company's Copilot never see it).
 * Server: routes/aiSpend.ts.
 */
const BASE = import.meta.env.VITE_API_URL || '/api';

interface Spend {
  relevant: boolean;
  month: string;
  providers: { provider: string; label: string; usd: number; answers: number }[];
  totalUsd: number;
  limitUsd: number | null;
  overLimit: boolean;
}

const usd = (n: number) => `US$${n < 0.01 && n > 0 ? '<0.01' : n.toFixed(2)}`;

export function AiSpend({ tone }: { tone: Tone }) {
  const { t, btn, input } = useUi(tone);
  const [spend, setSpend] = useState<Spend | null>(null);
  const [limit, setLimit] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await fetch(`${BASE}/settings/ai-spend`).then(r => r.json() as Promise<Spend>);
      setSpend(s);
      setLimit(s.limitUsd ? String(s.limitUsd) : '');
    } catch { /* hidden if the server can't say */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (!spend?.relevant) return null;

  const save = async (value: string) => {
    setMsg(null);
    const res = await fetch(`${BASE}/settings/ai-spend/limit`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ limitUsd: value.trim() === '' ? null : Number(value) }) });
    const body = await res.json().catch(() => ({})) as { error?: string; limitUsd?: number | null };
    if (!res.ok) { setMsg({ ok: false, text: body.error ?? 'Couldn\'t save the limit.' }); return; }
    setMsg({ ok: true, text: body.limitUsd ? `Limit set to ${usd(body.limitUsd)} a month.` : 'No limit.' });
    void load();
  };

  return (
    <Group>
      <Label tone={tone}>Spend on paid AIs - {spend.month}</Label>
      {spend.providers.map(p => (
        <div key={p.provider} style={{ display: 'flex', fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ flex: 1 }}>{p.label}</span>
          <span style={{ color: t.muted, marginRight: 12 }}>{p.answers} {p.answers === 1 ? 'answer' : 'answers'}</span>
          <span>about {usd(p.usd)}</span>
        </div>
      ))}
      <Hint tone={tone}>
        An estimate in US dollars, from each answer's size at the provider's published prices - your provider's own bill is the exact figure. Khami and Microsoft 365 Copilot aren't charged per use, so they aren't counted.
      </Hint>
      {spend.overLimit && <Msg tone={tone} ok={false}>This month's limit is reached - Khameleon is using Khami instead of paid AIs until next month.</Msg>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <span style={{ fontSize: 12.5, flexShrink: 0 }}>Monthly limit US$</span>
        <input aria-label="Monthly limit in US dollars" inputMode="decimal" placeholder="No limit" value={limit} onChange={e => setLimit(e.target.value)} style={{ ...input, width: 110 }} />
        <button type="button" style={btn(true)} onClick={() => void save(limit)}>Save</button>
        {spend.limitUsd !== null && <button type="button" style={btn()} onClick={() => { setLimit(''); void save(''); }}>Remove</button>}
      </div>
      <Hint tone={tone}>When the month's estimate reaches the limit, Khameleon switches to Khami and tells you - no surprise bills.</Hint>
      {msg && <Msg tone={tone} ok={msg.ok}>{msg.text}</Msg>}
    </Group>
  );
}
