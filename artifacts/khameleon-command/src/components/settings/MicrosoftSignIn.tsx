import { useCallback, useEffect, useState } from 'react';
import { clearMicrosoftApp, getMicrosoftAppStatus, saveMicrosoftApp, testMicrosoftApp, type MicrosoftAppStatus } from '@/lib/microsoftAppApi';
import { useUi, Label, Hint, Msg, Group, type Tone } from './ui';

/**
 * Settings > Microsoft sign-in (option 1, Newton 2026-10-18): the admin
 * types in the Microsoft app's details once; Outlook and Microsoft 365
 * Copilot sign-ins then work for everyone. The secret is stored encrypted
 * and never shown again.
 */
export function MicrosoftSignIn({ tone }: { tone: Tone }) {
  const { t, input, btn } = useUi(tone);
  const [status, setStatus] = useState<MicrosoftAppStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => getMicrosoftAppStatus().then(setStatus).catch(e => setMsg({ ok: false, text: e.message })), []);
  useEffect(() => { void load(); }, [load]);

  const act = async (name: string, fn: () => Promise<void>) => {
    setBusy(name); setMsg(null);
    try { await fn(); } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong' }); }
    setBusy(null);
  };
  const typed = { clientId: clientId.trim(), clientSecret: clientSecret.trim(), tenantId: tenantId.trim() || undefined };

  if (!status) return <Hint tone={tone}>Loading…</Hint>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Hint tone={tone}>
        Lets people connect Outlook and Microsoft 365 Copilot. Your organisation registers Khameleon with Microsoft once
        (portal.azure.com → Microsoft Entra ID → App registrations), then pastes the app's details here.
      </Hint>

      <Group>
        <Label tone={tone}>Status</Label>
        <div style={{ fontSize: 12.5, color: status.configured ? t.good : t.warn }}>
          {status.configured
            ? `Set up${status.source === 'server' ? ' on the server' : ''} - app ${status.clientId}${status.tenantId ? `, directory ${status.tenantId}` : ''}`
            : 'Not set up yet - Outlook and Copilot sign-in won\'t work until it is.'}
        </div>
      </Group>

      <Group>
        <Label tone={tone}>Address to give Microsoft</Label>
        <Hint tone={tone}>In the app registration, add this under Authentication → Web → Redirect URIs.</Hint>
        <div style={{ display: 'flex', gap: 6 }}>
          <input readOnly aria-label="Redirect address" value={status.redirectUri} style={{ ...input, fontFamily: 'var(--j-font-mono, monospace)', fontSize: 11.5 }} onFocus={e => e.currentTarget.select()} />
          <button type="button" style={btn()} onClick={() => { void navigator.clipboard?.writeText(status.redirectUri).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
      </Group>

      {!status.canEdit && <Hint tone={tone}>Only an admin can change these details.</Hint>}

      {status.canEdit && !editing && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" style={btn(true)} onClick={() => { setEditing(true); setMsg(null); }}>{status.configured ? 'Change details' : 'Enter details'}</button>
          {status.configured && <button type="button" style={btn()} disabled={!!busy} onClick={() => void act('test', async () => { const r = await testMicrosoftApp(); setMsg({ ok: r.ok, text: r.message }); })}>{busy === 'test' ? 'Testing…' : 'Test'}</button>}
          {status.source === 'settings' && <button type="button" style={btn()} disabled={!!busy} onClick={() => void act('clear', async () => { await clearMicrosoftApp(); await load(); setMsg({ ok: true, text: 'Removed. People already signed in stay connected until their sign-in expires.' }); })}>Remove</button>}
        </div>
      )}

      {status.canEdit && editing && (
        <form style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={e => { e.preventDefault(); void act('save', async () => { await saveMicrosoftApp(typed); setEditing(false); setClientSecret(''); await load(); setMsg({ ok: true, text: 'Saved. People can now connect Outlook (Integrations) and Microsoft 365 Copilot.' }); }); }}>
          <Group>
            <Label tone={tone}>Application (client) ID</Label>
            <input aria-label="Application (client) ID" placeholder="e.g. 1a2b3c4d-1234-5678-9abc-1234567890ab" value={clientId} onChange={e => setClientId(e.target.value)} style={input} autoComplete="off" />
            <Hint tone={tone}>On the app's Overview page.</Hint>
          </Group>
          <Group>
            <Label tone={tone}>Client secret</Label>
            <input aria-label="Client secret" type="password" placeholder="The secret's Value" value={clientSecret} onChange={e => setClientSecret(e.target.value)} style={input} autoComplete="new-password" />
            <Hint tone={tone}>Certificates &amp; secrets → New client secret → copy the Value straight away (Microsoft only shows it once). Stored encrypted; never shown again.</Hint>
          </Group>
          <Group>
            <Label tone={tone}>Directory (tenant) ID - optional</Label>
            <input aria-label="Directory (tenant) ID" placeholder="e.g. 1a2b3c4d-1234-5678-9abc-1234567890ab" value={tenantId} onChange={e => setTenantId(e.target.value)} style={input} autoComplete="off" />
            <Hint tone={tone}>Also on the Overview page. With it, Test can check the secret too.</Hint>
          </Group>
          <Hint tone={tone}>
            Permissions to add (API permissions → Microsoft Graph → Delegated): Mail.ReadWrite, Mail.Send, Calendars.ReadWrite, User.Read, offline_access.
            For Copilot also: Sites.Read.All, Mail.Read, People.Read.All, OnlineMeetingTranscript.Read.All, Chat.Read, ChannelMessage.Read.All, ExternalItem.Read.All (needs admin approval).
          </Hint>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="submit" style={btn(true)} disabled={!!busy || !typed.clientId || !typed.clientSecret}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
            <button type="button" style={btn()} disabled={!!busy || !typed.clientId || !typed.clientSecret} onClick={() => void act('test', async () => { const r = await testMicrosoftApp(typed); setMsg({ ok: r.ok, text: r.message }); })}>{busy === 'test' ? 'Testing…' : 'Test first'}</button>
            <button type="button" style={btn()} onClick={() => { setEditing(false); setClientSecret(''); setMsg(null); }}>Cancel</button>
          </div>
        </form>
      )}

      {msg && <Msg tone={tone} ok={msg.ok}>{msg.text}</Msg>}
    </div>
  );
}
