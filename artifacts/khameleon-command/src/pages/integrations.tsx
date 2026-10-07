import { useEffect, useMemo, useState } from 'react';
import { Plug, Plus } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { WorkDomainFilterBar, useWorkDomains } from '@/components/WorkDomainFilterBar';
import { ConnectIntegrationGate } from '@/components/ConnectIntegrationGate';
import { ImportCustomIntegration } from '@/components/ImportCustomIntegration';
import { getIntegrations, disconnectIntegration, type IntegrationEntry } from '@/lib/integrationsApi';
import { getCustomIntegrations, removeCustomIntegration, type CustomIntegrationEntry } from '@/lib/customIntegrationsApi';
import { setEntityWorkDomains } from '@/lib/workDomainsApi';

/**
 * design-spec.md §16 Integrations — a browsable directory that states
 * plainly, before connection, what data it can read and what actions it
 * can take (§16.2), with connecting always gated (§16.3) and
 * disconnecting always immediate and reversible (§16.5).
 */
export default function Integrations() {
  const [entries, setEntries] = useState<IntegrationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [gateFor, setGateFor] = useState<IntegrationEntry | null>(null);
  const [error, setError] = useState<string>();
  const [selectedDomain, setSelectedDomain] = useState<number | null>(null);
  const { domains, reload: reloadDomains } = useWorkDomains();

  const [customEntries, setCustomEntries] = useState<CustomIntegrationEntry[]>([]);
  const [importing, setImporting] = useState(false);

  const load = () => { getIntegrations().then(d => { setEntries(d); setLoading(false); }); };
  const loadCustom = () => { getCustomIntegrations().then(setCustomEntries); };
  useEffect(load, []);
  useEffect(loadCustom, []);

  const doRemoveCustom = async (entry: CustomIntegrationEntry) => {
    setError(undefined);
    try {
      await removeCustomIntegration(entry.id);
      loadCustom();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  };

  const filtered = useMemo(
    () => selectedDomain === null ? entries : entries.filter(e => e.workDomainIds.includes(selectedDomain)),
    [entries, selectedDomain],
  );

  const doDisconnect = async (entry: IntegrationEntry) => {
    if (!entry.providerId) return;
    setError(undefined);
    try {
      await disconnectIntegration(entry.providerId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  };

  const toggleDomainTag = async (entry: IntegrationEntry, domainId: number) => {
    const next = entry.workDomainIds.includes(domainId)
      ? entry.workDomainIds.filter(id => id !== domainId)
      : [...entry.workDomainIds, domainId];
    try {
      await setEntityWorkDomains('integration', entry.id, next);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tags');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', padding: 8 }}>
      {/* .j-panel hardcodes height:100% - without flexShrink:0 here this
          panel inflates to fill the flex column and starves the
          scrollable list below to 0 height (documented gotcha, hit
          earlier this session in tasks.tsx). */}
      <div style={{ flexShrink: 0 }}>
        <JPanel title="INTEGRATIONS DIRECTORY" icon={<Plug size={13} />} badge={`${entries.filter(e => e.connected).length}/${entries.length} CONNECTED`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <WorkDomainFilterBar
              domains={domains}
              selected={selectedDomain}
              onSelect={setSelectedDomain}
              onDomainsChanged={reloadDomains}
            />
            <div style={{ flex: 1 }} />
            <button className="j-btn-ghost" style={{ height: 26, padding: '0 10px', fontSize: 9, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }} onClick={() => setImporting(true)}>
              <Plus size={11} /> IMPORT CUSTOM
            </button>
          </div>
        </JPanel>
      </div>

      {error && <div style={{ fontSize: 11, color: '#E77A7A' }}>{error}</div>}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} className="scrollbar-jarvis">
        {loading ? (
          <div className="j-empty">LOADING…</div>
        ) : filtered.length === 0 ? (
          <div className="j-empty">NO INTEGRATIONS IN THIS DOMAIN</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
            {filtered.map(entry => (
              <div key={entry.id} style={{ padding: '10px 12px', background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.1)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.connected ? 'var(--j-green)' : 'var(--j-text-faint)', boxShadow: entry.connected ? '0 0 6px var(--j-green)' : 'none' }} />
                  <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, color: '#fff', flex: 1 }}>{entry.name}</span>
                  <span className="j-mono" style={{ fontSize: 8, color: entry.connected ? 'var(--j-green)' : 'var(--j-text-faint)' }}>
                    {entry.connected ? 'CONNECTED' : 'NOT CONNECTED'}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--j-text-muted)', lineHeight: 1.5 }}>
                  <div><strong>Can read:</strong> {entry.dataScope}</div>
                  <div><strong>Can do:</strong> {entry.actionScope}</div>
                </div>
                {domains.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {domains.map(d => (
                      <button
                        key={d.id}
                        onClick={() => toggleDomainTag(entry, d.id)}
                        className="j-badge"
                        style={{
                          fontSize: 8, cursor: 'pointer', padding: '2px 6px',
                          background: entry.workDomainIds.includes(d.id) ? 'rgba(0,212,255,0.12)' : 'transparent',
                          border: `1px solid ${entry.workDomainIds.includes(d.id) ? 'var(--j-cyan)' : 'rgba(0,212,255,0.12)'}`,
                          color: entry.workDomainIds.includes(d.id) ? 'var(--j-cyan)' : 'var(--j-text-faint)',
                        }}
                      >
                        {d.name}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 2 }}>
                  {entry.connected ? (
                    <button className="j-btn-ghost" style={{ height: 26, padding: '0 10px', fontSize: 9, width: '100%', borderColor: 'rgba(192,21,42,0.3)', color: 'var(--j-red)' }} onClick={() => doDisconnect(entry)}>
                      DISCONNECT
                    </button>
                  ) : entry.providerId ? (
                    <button className="j-btn-primary" style={{ height: 26, padding: '0 10px', fontSize: 9, width: '100%' }} onClick={() => setGateFor(entry)}>
                      CONNECT
                    </button>
                  ) : (
                    <div style={{ fontSize: 9, color: 'var(--j-text-faint)', textAlign: 'center', padding: '4px 0' }}>NOT YET AVAILABLE</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {customEntries.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 9, letterSpacing: '0.08em', color: 'var(--j-text-muted)', marginBottom: 8 }}>CUSTOM (OPENAPI / MCP)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
              {customEntries.map(entry => (
                <div key={entry.id} style={{ padding: '10px 12px', background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.1)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--j-green)', boxShadow: '0 0 6px var(--j-green)' }} />
                    <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, color: '#fff', flex: 1 }}>{entry.name}</span>
                    <span className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)' }}>{entry.sourceType.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--j-text-muted)' }}>
                    {entry.sourceType === 'openapi'
                      ? `${entry.operationCount} operation${entry.operationCount === 1 ? '' : 's'} · ${entry.baseUrl}`
                      : entry.sourceUrl}
                  </div>
                  <button className="j-btn-ghost" style={{ height: 26, padding: '0 10px', fontSize: 9, width: '100%', borderColor: 'rgba(192,21,42,0.3)', color: 'var(--j-red)' }} onClick={() => doRemoveCustom(entry)}>
                    DISCONNECT
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {gateFor && gateFor.providerId && (
        <ConnectIntegrationGate
          providerId={gateFor.providerId}
          name={gateFor.name}
          dataScope={gateFor.dataScope}
          actionScope={gateFor.actionScope}
          onCancel={() => setGateFor(null)}
        />
      )}

      {importing && (
        <ImportCustomIntegration
          onImported={() => { setImporting(false); loadCustom(); }}
          onCancel={() => setImporting(false)}
        />
      )}
    </div>
  );
}
