import { Lock, Key, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

const ENV_KEYS = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'SESSION_SECRET', 'DATABASE_URL', 'JARVIS_ENGINE', 'JARVIS_MODEL'];

export default function Vault() {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const toggle = (k: string) => setRevealed(prev => ({ ...prev, [k]: !prev[k] }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#c9a84c', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Vault</h2>
        <p style={{ fontSize: 12, color: 'rgba(130,170,200,0.55)', lineHeight: 1.5 }}>Local encrypted secrets management. Values are never transmitted or displayed in plain text.</p>
      </div>

      {/* Lock icon hero */}
      <div className="nexus-card" style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 0 30px rgba(201,168,76,0.15)' }}>
          <Lock style={{ width: 28, height: 28, color: '#c9a84c' }} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(220,240,255,0.9)', marginBottom: 6 }}>Local Encrypted Secrets</div>
        <div style={{ fontSize: 12, color: 'rgba(130,170,200,0.5)', lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>
          Coming soon — AES-256 encrypted local keystore for storing API keys, tokens, and credentials without external services.
        </div>
      </div>

      {/* Env key status */}
      <div className="nexus-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Key style={{ width: 14, height: 14, color: '#c9a84c' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(201,168,76,0.8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Environment Variables</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ENV_KEYS.map(k => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(130,170,200,0.2)' }} />
                <span style={{ fontSize: 12, color: 'rgba(200,225,245,0.8)', fontFamily: 'var(--font-mono)' }}>{k}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: 'rgba(130,170,200,0.4)', fontFamily: 'var(--font-mono)' }}>
                  {revealed[k] ? '••••••••••••' : '[ NOT SET ]'}
                </span>
                <button onClick={() => toggle(k)} style={{ background: 'none', border: 'none', color: 'rgba(130,170,200,0.4)', cursor: 'pointer', padding: 2 }}>
                  {revealed[k] ? <EyeOff style={{ width: 13, height: 13 }} /> : <Eye style={{ width: 13, height: 13 }} />}
                </button>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'rgba(130,170,200,0.35)', marginTop: 12, lineHeight: 1.5 }}>
          Key values are never exposed by Nexus Command. Configure secrets in your environment or .env file.
        </p>
      </div>
    </div>
  );
}
