import { useCallback, useEffect, useState } from 'react';
import { clearAzure, getAzureStatus, saveAzure, testAzure, type AzureStatus } from '@/lib/azureOpenAIApi';
import { useUi, Hint, Msg, Group, Label, type Tone } from './ui';

/**
 * Settings > AI > Azure OpenAI (docs/khami-design.md, step 5): the
 * organisation's own OpenAI models in its Azure account. Admin enters the
 * address, deployment name and key; stored encrypted; offered after Copilot.
 */
export function AzureOpenAI({ tone, onChange }: { tone: Tone; onChange?: () => void }) {
  const { t, input, btn } = useUi(tone);
  const [status, setStatus] = useState<AzureStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [endpoint, setEndpoint] = useState('');
  const [deployment, setDeployment] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => getAzureStatus().then(setStatus).catch(() => {}), []);
  useEffect(() => { void load(); }, [load]);
  const typed = { endpoint: endpoint.trim(), deployment: deployment.trim(), apiKey: apiKey.trim() };
  const ready = !!(typed.endpoint && typed.deployment && typed.apiKey);

  const act = async (name: string, fn: () => Promise<void>) => {
    setBusy(name); setMsg(null);
    try { await fn(); } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong' }); }
    setBusy(null);
  };

  if (!status) return null;
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: t.radius, background: t.card, border: `1px solid ${t.border}` };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={row}>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: status.configured ? t.good : t.muted, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 12.5 }}>Azure OpenAI <span style={{ color: t.muted, fontSize: 11 }}>(your organisation's)</span></span>
        <span style={{ fontSize: 11, color: t.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{status.configured ? status.deployment : 'Not set up'}</span>
        {status.canEdit && !editing && <button type="button" style={btn()} onClick={() => { setEditing(true); setMsg(null); setEndpoint(status.endpoint ?? ''); setDeployment(status.deployment ?? ''); }}>{status.configured ? 'Change' : 'Set up'}</button>}
        {status.canEdit && status.configured && !editing && <button type="button" style={btn()} disabled={!!busy} onClick={() => void act('test', async () => { const r = await testAzure(); setMsg({ ok: r.ok, text: r.message }); })}>{busy === 'test' ? 'Testing…' : 'Test'}</button>}
      </div>
      {editing && (
        <form style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: t.radius, background: t.card, border: `1px solid ${t.border}` }}
          onSubmit={e => { e.preventDefault(); if (ready) void act('save', async () => { await saveAzure(typed); setEditing(false); setApiKey(''); await load(); onChange?.(); setMsg({ ok: true, text: 'Saved. Azure OpenAI is now offered after Copilot.' }); }); }}>
          <Hint tone={tone}>All three are in the Azure portal: open the Azure OpenAI resource → Keys and Endpoint; the deployment name is in Azure AI Foundry → Deployments.</Hint>
          <Group><Label tone={tone}>Resource address</Label>
            <input aria-label="Resource address" placeholder="e.g. https://acme-ai.openai.azure.com" value={endpoint} onChange={e => setEndpoint(e.target.value)} style={input} /></Group>
          <Group><Label tone={tone}>Deployment name</Label>
            <input aria-label="Deployment name" placeholder="e.g. gpt-4o" value={deployment} onChange={e => setDeployment(e.target.value)} style={input} /></Group>
          <Group><Label tone={tone}>Key</Label>
            <input aria-label="Azure key" type="password" autoComplete="new-password" placeholder="KEY 1 or KEY 2" value={apiKey} onChange={e => setApiKey(e.target.value)} style={input} /></Group>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="submit" style={btn(true)} disabled={!!busy || !ready}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
            <button type="button" style={btn()} disabled={!!busy || !ready} onClick={() => void act('test', async () => { const r = await testAzure(typed); setMsg({ ok: r.ok, text: r.message }); })}>{busy === 'test' ? 'Testing…' : 'Test first'}</button>
            {status.configured && <button type="button" style={btn()} disabled={!!busy} onClick={() => void act('clear', async () => { await clearAzure(); setEditing(false); await load(); onChange?.(); setMsg({ ok: true, text: 'Removed.' }); })}>Remove</button>}
            <button type="button" style={btn()} onClick={() => { setEditing(false); setApiKey(''); }}>Cancel</button>
          </div>
        </form>
      )}
      {msg && <Msg tone={tone} ok={msg.ok}>{msg.text}</Msg>}
    </div>
  );
}
