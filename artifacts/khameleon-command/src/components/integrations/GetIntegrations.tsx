import { useCallback, useEffect, useState } from 'react';
import { searchIntegrations, probeIntegration, startIntegrationSignIn, type DirectoryIntegration, type ProbeResult } from '@/lib/integrationSourcesApi';
import { getCustomIntegrations, importCustomIntegration, removeCustomIntegration, type CustomIntegrationEntry } from '@/lib/customIntegrationsApi';

/**
 * Get integrations (docs/build-review.md, Build 16): search the public
 * directory or paste an address, check what an integration can do, then
 * connect - by signing in with the service, or with a key it gives you.
 * Connected integrations work with every AI in Khameleon. Shared by the
 * Overlay's Integrations panel and Classic's Integrations page.
 */
type Tone = 'overlay' | 'classic';

const TONES: Record<Tone, { text: string; muted: string; card: string; border: string; accent: string; good: string; warn: string; bad: string; input: string; radius: number }> = {
  overlay: { text: '#d6efee', muted: '#8fb4b6', card: 'rgba(255,255,255,0.035)', border: 'rgba(255,255,255,0.1)', accent: '#6FE6BD', good: '#6FE6BD', warn: '#ffb36b', bad: '#ff9b9b', input: 'rgba(0,0,0,0.25)', radius: 10 },
  classic: { text: 'var(--j-text)', muted: 'var(--j-text-muted)', card: 'rgba(0,212,255,0.03)', border: 'rgba(0,212,255,0.12)', accent: 'var(--j-cyan)', good: 'var(--j-green)', warn: 'var(--j-amber)', bad: 'var(--j-red)', input: 'rgba(0,4,8,0.6)', radius: 2 },
};

const hostOf = (url: string) => { try { return new URL(url).hostname; } catch { return url; } };

export function GetIntegrations({ tone }: { tone: Tone }) {
  const t = TONES[tone];
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DirectoryIntegration[] | null>(null);
  const [connected, setConnected] = useState<CustomIntegrationEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, ProbeResult>>({});
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [manualUrl, setManualUrl] = useState('');
  const [manualName, setManualName] = useState('');
  const [waitingFor, setWaitingFor] = useState<string | null>(null);

  const loadConnected = useCallback(() => { getCustomIntegrations().then(rows => setConnected(rows.filter(r => r.sourceType === 'mcp'))); }, []);
  useEffect(loadConnected, [loadConnected]);

  // While a sign-in window is open, watch for the integration to appear.
  useEffect(() => {
    if (!waitingFor) return;
    const id = window.setInterval(async () => {
      const rows = await getCustomIntegrations();
      setConnected(rows.filter(r => r.sourceType === 'mcp'));
      if (rows.some(r => r.sourceUrl === waitingFor)) setWaitingFor(null);
    }, 2000);
    const stop = window.setTimeout(() => setWaitingFor(null), 5 * 60 * 1000);
    return () => { window.clearInterval(id); window.clearTimeout(stop); };
  }, [waitingFor]);

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id); setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
    setBusy(null);
  };

  const search = () => run('search', async () => setResults(await searchIntegrations(query)));
  const check = (url: string) => run(url, async () => {
    const r = await probeIntegration(url, keys[url]?.trim() || undefined);
    setChecks(c => ({ ...c, [url]: r }));
  });
  const connect = (name: string, url: string, needsKey: boolean) => run(url, async () => {
    const key = keys[url]?.trim();
    if (needsKey || key) {
      if (!key) throw new Error('Paste the key this service gave you first.');
      await importCustomIntegration({ sourceType: 'mcp', name, sourceUrl: url, authToken: key });
      loadConnected();
      return;
    }
    const probe = checks[url] ?? await probeIntegration(url);
    setChecks(c => ({ ...c, [url]: probe }));
    if (probe.ok) {
      await importCustomIntegration({ sourceType: 'mcp', name, sourceUrl: url });
      loadConnected();
      return;
    }
    if (!probe.needsSignIn) throw new Error(probe.message);
    const r = await startIntegrationSignIn(url, name);
    if (r.connected) { loadConnected(); return; }
    if (r.signInUrl) { window.open(r.signInUrl, '_blank', 'width=560,height=720'); setWaitingFor(url); }
  });

  const isConnected = (url: string) => connected.some(c => c.sourceUrl === url);
  const input: React.CSSProperties = { flex: 1, minWidth: 0, padding: '6px 9px', borderRadius: t.radius, fontSize: 12, fontFamily: 'inherit', background: t.input, border: `1px solid ${t.border}`, color: t.text };
  const btn = (primary?: boolean): React.CSSProperties => ({
    padding: '5px 10px', borderRadius: t.radius, fontSize: 11.5, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
    background: primary ? 'rgba(111,230,189,0.14)' : 'transparent', border: `1px solid ${primary ? t.accent : t.border}`, color: t.text,
  });

  const card = (name: string, url: string, opts: { description?: string; verified?: boolean; publisher?: string; needsKey?: boolean; keyHint?: string; fromDirectory: boolean }) => {
    const probe = checks[url];
    return (
      <div key={url} style={{ padding: '9px 10px', borderRadius: t.radius, background: t.card, border: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{name}</span>
          {opts.fromDirectory && (opts.verified
            ? <span style={{ fontSize: 10.5, color: t.good }}>Publisher verified - owns {opts.publisher}</span>
            : <span style={{ fontSize: 10.5, color: t.warn }}>Published by {opts.publisher} - not verified</span>)}
          <span style={{ fontSize: 10.5, color: t.muted }}>runs at {hostOf(url)}</span>
        </div>
        {opts.description && <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3, lineHeight: 1.45 }}>{opts.description}</div>}
        {opts.needsKey && (
          <input aria-label={`Key for ${name}`} type="password" placeholder={opts.keyHint || 'Key from this service'} value={keys[url] ?? ''}
            onChange={e => setKeys(k => ({ ...k, [url]: e.target.value }))} style={{ ...input, width: '100%', marginTop: 6 }} />
        )}
        {probe?.ok && (
          <div style={{ fontSize: 11, color: t.muted, marginTop: 6 }}>
            Can do: {probe.tools.slice(0, 8).map(x => x.name).join(', ')}{probe.tools.length > 8 ? ` and ${probe.tools.length - 8} more` : ''}
          </div>
        )}
        {probe && !probe.ok && <div style={{ fontSize: 11, color: probe.needsSignIn ? t.warn : t.bad, marginTop: 6 }}>{probe.message}{probe.needsSignIn && !opts.needsKey ? ' Connect will open its sign-in page.' : ''}</div>}
        {waitingFor === url && <div style={{ fontSize: 11, color: t.warn, marginTop: 6 }}>Finish signing in in the window that opened - this updates by itself.</div>}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
          {isConnected(url)
            ? <span style={{ fontSize: 11.5, color: t.good }}>Connected</span>
            : <button type="button" style={btn(true)} disabled={busy === url} onClick={() => void connect(name, url, !!opts.needsKey)}>{busy === url ? 'Working…' : 'Connect'}</button>}
          <button type="button" style={btn()} disabled={busy === url} onClick={() => void check(url)}>What can it do?</button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, color: t.text }}>
      <div style={{ fontSize: 11.5, color: t.muted, lineHeight: 1.45 }}>
        Connect the services you work with. Connected integrations can be used by every AI in Khameleon, including Khami. Check who publishes an integration before connecting - whatever you connect can see what the AI sends it.
      </div>

      {connected.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.muted }}>Connected</div>
          {connected.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: t.radius, background: t.card, border: `1px solid ${t.border}` }}>
              <span style={{ flex: 1, fontSize: 12 }}>{c.name} <span style={{ fontSize: 10.5, color: t.muted }}>· {hostOf(c.sourceUrl ?? '')}</span></span>
              <button type="button" style={btn()} onClick={() => void run(`rm-${c.id}`, async () => { await removeCustomIntegration(c.id); loadConnected(); })}>Disconnect</button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={e => { e.preventDefault(); void search(); }} style={{ display: 'flex', gap: 6 }}>
        <input aria-label="Search integrations" placeholder="Search the public directory (e.g. Notion, Jira, Xero)" value={query} onChange={e => setQuery(e.target.value)} style={input} />
        <button type="submit" style={btn(true)} disabled={busy === 'search'}>{busy === 'search' ? 'Searching…' : 'Search'}</button>
      </form>

      <details>
        <summary style={{ fontSize: 11.5, color: t.muted, cursor: 'pointer' }}>Have an address? Add it directly</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          <input aria-label="Integration name" placeholder="Name (e.g. Our CRM)" value={manualName} onChange={e => setManualName(e.target.value)} style={input} />
          <input aria-label="Integration address" placeholder="https://… (the integration's address)" value={manualUrl} onChange={e => setManualUrl(e.target.value)} style={input} />
          {manualUrl.startsWith('https://') && manualName.trim() && card(manualName.trim(), manualUrl.trim(), { fromDirectory: false, needsKey: false })}
        </div>
      </details>

      {error && <div role="alert" style={{ fontSize: 12, color: t.bad }}>{error}</div>}
      {results && results.length === 0 && <div style={{ fontSize: 12, color: t.muted }}>Nothing found that Khameleon can connect to.</div>}
      {results?.map(r => card(r.title, r.url, { description: r.description, verified: r.verified, publisher: r.publisher, needsKey: r.needsKey, keyHint: r.keyHint, fromDirectory: true }))}
    </div>
  );
}
