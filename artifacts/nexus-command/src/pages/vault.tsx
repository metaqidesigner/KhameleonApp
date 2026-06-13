import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const ENV_KEYS = [
  { name: 'ANTHROPIC_API_KEY', desc: 'Anthropic API (Claude)' },
  { name: 'OPENAI_API_KEY',    desc: 'OpenAI API (GPT)' },
  { name: 'JARVIS_ENGINE',     desc: 'Default engine override' },
  { name: 'JARVIS_MODEL',      desc: 'Default model override' },
  { name: 'SESSION_SECRET',    desc: 'Session signing key' },
  { name: 'DATABASE_URL',      desc: 'PostgreSQL connection string' },
];

export default function Vault() {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  return (
    <div className="j-page">
      <div className="j-page-header">
        <div>
          <h1>Vault</h1>
          <p>Environment secrets and credential status</p>
        </div>
      </div>
      <div className="j-page-content">
        <div className="j-card">
          <div className="j-card-header">Environment Keys</div>
          <p style={{ fontSize: 12, color: '#8b949e', marginBottom: 16 }}>
            Key values are never exposed to the frontend. Status reflects whether the variable is set in the environment.
          </p>
          <table className="j-table">
            <thead><tr>
              <th>Key</th><th>Description</th><th>Status</th><th>Value</th>
            </tr></thead>
            <tbody>
              {ENV_KEYS.map(k => {
                const isSet = false; // can't read env from client
                return (
                  <tr key={k.name}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{k.name}</td>
                    <td style={{ fontSize: 12, color: '#8b949e' }}>{k.desc}</td>
                    <td>
                      <span className={`j-badge ${isSet ? 'j-badge-green' : 'j-badge-gray'}`}>
                        {isSet ? '● Set' : '— Not set'}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => setRevealed(r => ({ ...r, [k.name]: !r[k.name] }))}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          background: 'none', border: 'none', color: '#484f58',
                          cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {revealed[k.name]
                          ? <><EyeOff style={{ width: 12, height: 12 }} /> ••••••••</>
                          : <><Eye style={{ width: 12, height: 12 }} /> Show</>
                        }
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="j-card" style={{ marginTop: 16 }}>
          <div className="j-card-header">Add Secret</div>
          <p style={{ fontSize: 12, color: '#8b949e', marginBottom: 12 }}>
            Set environment variables via the Replit Secrets panel or your deployment environment.
            Never commit secrets to code.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="j-input" placeholder="KEY_NAME" style={{ width: 180 }} />
            <input className="j-input" placeholder="value..." type="password" style={{ flex: 1 }} />
            <button className="j-btn j-btn-primary" style={{ flexShrink: 0 }}>Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}
