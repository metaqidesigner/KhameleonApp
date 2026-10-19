import { useCallback, useEffect, useState } from 'react';
import { KhamiSetup } from '@/components/khami/KhamiSetup';
import { saveApiKey, clearApiKey, type ApiKeyProvider } from '@/lib/jarvisApi';
import { useUi, Label, Hint, Msg, Group, type Tone } from './ui';
import { EscalationSetting } from './EscalationSetting';

/**
 * Settings > AI (docs/gap-review.md Q5, docs/khami-design.md): Khami first -
 * Khameleon's own AI on this computer - then the outside AIs the
 * organisation may provide. Copilot connects by signing in (Integrations);
 * Claude, GPT and Gemini by key (stored encrypted).
 */
interface EngineStatus { id: 'khami' | 'copilot' | 'anthropic' | 'openai' | 'google'; name: string; available: boolean; note?: string }

const BASE = import.meta.env.VITE_API_URL || '/api';
const KEYED: { id: ApiKeyProvider; engine: EngineStatus['id']; label: string; placeholder: string }[] = [
  { id: 'anthropic', engine: 'anthropic', label: 'Claude', placeholder: 'sk-ant-…' },
  { id: 'openai', engine: 'openai', label: 'GPT', placeholder: 'sk-…' },
  { id: 'google', engine: 'google', label: 'Gemini', placeholder: 'AIza…' },
];

export function AiEngines({ tone, onOpenIntegrations }: { tone: Tone; onOpenIntegrations?: () => void }) {
  const { t, input, btn } = useUi(tone);
  const [engines, setEngines] = useState<EngineStatus[]>([]);
  const [editing, setEditing] = useState<ApiKeyProvider | null>(null);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => fetch(`${BASE}/engines`).then(r => r.json()).then(setEngines).catch(() => {}), []);
  useEffect(() => { void load(); }, [load]);
  const status = (id: EngineStatus['id']) => engines.find(e => e.id === id);
  const copilot = status('copilot');

  const save = async (id: ApiKeyProvider, label: string) => {
    setBusy(true); setMsg(null);
    try { await saveApiKey(id, key.trim()); setKey(''); setEditing(null); await load(); setMsg({ ok: true, text: `${label} key saved (encrypted).` }); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Couldn\'t save the key' }); }
    setBusy(false);
  };
  const remove = async (id: ApiKeyProvider, label: string) => {
    setBusy(true); setMsg(null);
    try { await clearApiKey(id); await load(); setMsg({ ok: true, text: `${label} key removed.` }); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Couldn\'t remove the key' }); }
    setBusy(false);
  };

  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: t.radius, background: t.card, border: `1px solid ${t.border}` };
  const dot = (on: boolean) => <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: on ? t.good : t.muted, flexShrink: 0 }} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Group>
        <Label tone={tone}>Khami - Khameleon's own AI</Label>
        <div style={{ padding: 10, borderRadius: t.radius, background: t.card, border: `1px solid ${t.border}` }}>
          <KhamiSetup tone={tone} onReady={() => void load()} />
        </div>
      </Group>

      <Group>
        <Label tone={tone}>Outside AIs (optional)</Label>
        <Hint tone={tone}>Only if your organisation provides them. Khami offers them for tricky work (Copilot first), you can pick one in the chat, and they step in when Khami isn't set up. Confidential work never goes to them.</Hint>
        <div style={row}>
          {dot(!!copilot?.available)}
          <span style={{ flex: 1, fontSize: 12.5 }}>Microsoft 365 Copilot</span>
          <span style={{ fontSize: 11, color: t.muted }}>{copilot?.available ? 'Connected' : 'Sign in with your work account'}</span>
          {!copilot?.available && onOpenIntegrations && <button type="button" style={btn()} onClick={onOpenIntegrations}>Connect…</button>}
        </div>
        {KEYED.map(k => {
          const on = !!status(k.engine)?.available;
          return (
            <div key={k.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={row}>
                {dot(on)}
                <span style={{ flex: 1, fontSize: 12.5 }}>{k.label}</span>
                <span style={{ fontSize: 11, color: t.muted }}>{on ? 'Key added' : 'No key'}</span>
                {editing !== k.id && <button type="button" style={btn()} disabled={busy} onClick={() => { setEditing(k.id); setKey(''); setMsg(null); }}>{on ? 'Replace' : 'Add key'}</button>}
                {on && editing !== k.id && <button type="button" style={btn()} disabled={busy} onClick={() => void remove(k.id, k.label)}>Remove</button>}
              </div>
              {editing === k.id && (
                <form style={{ display: 'flex', gap: 6 }} onSubmit={e => { e.preventDefault(); if (key.trim()) void save(k.id, k.label); }}>
                  <input aria-label={`${k.label} key`} type="password" autoComplete="new-password" placeholder={k.placeholder} value={key} onChange={e => setKey(e.target.value)} style={input} autoFocus />
                  <button type="submit" style={btn(true)} disabled={busy || !key.trim()}>{busy ? 'Saving…' : 'Save'}</button>
                  <button type="button" style={btn()} onClick={() => setEditing(null)}>Cancel</button>
                </form>
              )}
            </div>
          );
        })}
      </Group>
      <EscalationSetting tone={tone} />
      {msg && <Msg tone={tone} ok={msg.ok}>{msg.text}</Msg>}
    </div>
  );
}
