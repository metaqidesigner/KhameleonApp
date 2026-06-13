import { useJarvisHealth } from '@/hooks/useJarvis';
import { useJarvisStore } from '@/store/jarvisStore';

const ENV_KEYS = [
  { name: 'ANTHROPIC_API_KEY', present: !!import.meta.env.VITE_HAS_ANTHROPIC },
  { name: 'OPENAI_API_KEY',    present: !!import.meta.env.VITE_HAS_OPENAI },
];

const GUARDRAILS = [
  'Injection Scanner',
  'Rate Limiter',
  'File Policy',
  'SSRF Protection',
  'Audit Log',
];

export default function Security() {
  const { data: health } = useJarvisHealth();
  const agentHistory = useJarvisStore(s => s.agentHistory);
  const isOnline = health?.status === 'online';

  return (
    <div className="j-page">
      <div className="j-page-header">
        <div>
          <h1>Security</h1>
          <p>Credential status, audit log, and guardrails</p>
        </div>
      </div>
      <div className="j-page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="j-grid-2">
          {/* API Credentials */}
          <div className="j-card">
            <div className="j-card-header">API Credentials</div>
            <table className="j-table">
              <thead><tr><th>Key</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {ENV_KEYS.map(k => (
                  <tr key={k.name}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{k.name}</td>
                    <td>
                      {k.present
                        ? <span className="j-badge j-badge-green">● Set</span>
                        : <span className="j-badge j-badge-red">✕ Not set</span>
                      }
                    </td>
                    <td>
                      <button className="j-btn" style={{ height: 24, fontSize: 11, padding: '0 8px' }}>Revoke</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Guardrails */}
          <div className="j-card">
            <div className="j-card-header">Guardrails</div>
            <table className="j-table">
              <thead><tr><th>Control</th><th>Status</th></tr></thead>
              <tbody>
                {GUARDRAILS.map(g => (
                  <tr key={g}>
                    <td style={{ fontSize: 12 }}>{g}</td>
                    <td>
                      <span className={`j-badge ${isOnline ? 'j-badge-green' : 'j-badge-gray'}`}>
                        {isOnline ? 'Active' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Log */}
        <div className="j-card">
          <div className="j-card-header">Audit Log — last {Math.min(agentHistory.length, 20)} entries</div>
          {agentHistory.length === 0 ? (
            <div className="j-empty" style={{ padding: '24px 0' }}>No audit entries yet</div>
          ) : (
            <table className="j-table">
              <thead><tr>
                <th>Timestamp</th><th>Agent</th><th>Action</th><th>Status</th><th>Latency</th>
              </tr></thead>
              <tbody>
                {agentHistory.slice(0, 20).map(ev => (
                  <tr key={ev.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#484f58' }}>
                      {new Date(ev.ts).toISOString().replace('T', ' ').slice(0, 19)}
                    </td>
                    <td><span className="j-badge j-badge-purple">{ev.agent}</span></td>
                    <td style={{ fontSize: 12, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.prompt.slice(0, 50)}{ev.prompt.length > 50 ? '…' : ''}
                    </td>
                    <td><span className="j-badge j-badge-green">success</span></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      {ev.durationMs ? `${ev.durationMs}ms` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
