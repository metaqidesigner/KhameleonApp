import { useState } from 'react';

type Section = 'general' | 'engine' | 'appearance' | 'memory' | 'telemetry' | 'advanced';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'general',    label: 'General' },
  { id: 'engine',     label: 'Engine' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'memory',     label: 'Memory' },
  { id: 'telemetry',  label: 'Telemetry' },
  { id: 'advanced',   label: 'Advanced' },
];

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #30363d', gap: 16 }}>
      <span style={{ fontSize: 13, color: '#e6edf3', flex: 1 }}>{label}</span>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: checked ? 'rgba(88,166,255,0.3)' : '#21262d',
        border: `1px solid ${checked ? '#58a6ff' : '#30363d'}`,
        cursor: 'pointer', padding: 0, position: 'relative', transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 2,
        left: checked ? 16 : 2, width: 14, height: 14,
        background: checked ? '#58a6ff' : '#484f58',
        borderRadius: '50%', transition: 'left 0.2s',
      }} />
    </button>
  );
}

export default function Settings() {
  const [section, setSection] = useState<Section>('general');
  const [mode, setMode] = useState('work');
  const [engine, setEngine] = useState('ollama');
  const [model, setModel] = useState('llama3.2');
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434');
  const [fontSize, setFontSize] = useState<12 | 13 | 14>(13);
  const [railExpanded, setRailExpandedLocal] = useState(true);
  const [indexPath, setIndexPath] = useState('');
  const [autoIndex, setAutoIndex] = useState(false);
  const [chunkSize, setChunkSize] = useState(512);
  const [anonymousTelemetry, setAnonymousTelemetry] = useState(false);
  const [showCost, setShowCost] = useState(true);
  const [showEnergy, setShowEnergy] = useState(true);
  const [connResult, setConnResult] = useState<string | null>(null);

  const testConnection = async () => {
    try {
      const r = await fetch('/api/health');
      const d = await r.json() as { status: string; engine: string; model: string };
      setConnResult(`✓ ${d.status} — ${d.engine} / ${d.model}`);
    } catch {
      setConnResult('✗ Connection failed — backend unreachable');
    }
  };

  return (
    <div className="j-page">
      <div className="j-page-header">
        <div>
          <h1>Settings</h1>
          <p>Configure Jarvis behaviour and connections</p>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left nav */}
        <div style={{
          width: 160, flexShrink: 0, padding: '12px 0',
          borderRight: '1px solid #30363d', background: '#0d1117',
          overflow: 'auto',
        }}>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              style={{
                width: '100%', height: 34, display: 'flex', alignItems: 'center',
                padding: '0 14px', background: section === s.id ? '#21262d' : 'none',
                border: 'none', borderLeft: section === s.id ? '2px solid #58a6ff' : '2px solid transparent',
                color: section === s.id ? '#e6edf3' : '#8b949e',
                fontSize: 13, cursor: 'pointer', textAlign: 'left',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }} className="scrollbar-thin">
          {section === 'general' && (
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px', color: '#e6edf3' }}>General</h2>
              <SettingRow label="Mode">
                <select className="j-input" value={mode} onChange={e => setMode(e.target.value)} style={{ width: 140 }}>
                  {['work', 'research', 'creative', 'focused'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </SettingRow>
              <SettingRow label="Username">
                <input className="j-input" style={{ width: 180 }} defaultValue="Jarvis User" />
              </SettingRow>
            </div>
          )}

          {section === 'engine' && (
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px', color: '#e6edf3' }}>Engine</h2>
              <SettingRow label="Engine">
                <select className="j-input" value={engine} onChange={e => setEngine(e.target.value)} style={{ width: 160 }}>
                  {['ollama', 'vllm', 'sglang', 'llama.cpp', 'openai', 'anthropic'].map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </SettingRow>
              <SettingRow label="Model">
                <input className="j-input" value={model} onChange={e => setModel(e.target.value)} style={{ width: 180 }} />
              </SettingRow>
              <SettingRow label="Base URL">
                <input className="j-input" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} style={{ width: 240 }} />
              </SettingRow>
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={testConnection} className="j-btn j-btn-primary">Test Connection</button>
                {connResult && (
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: connResult.startsWith('✓') ? '#3fb950' : '#f85149' }}>
                    {connResult}
                  </span>
                )}
              </div>
            </div>
          )}

          {section === 'appearance' && (
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px', color: '#e6edf3' }}>Appearance</h2>
              <SettingRow label="Theme">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="j-badge j-badge-blue">Dark</span>
                  <span style={{ fontSize: 11, color: '#484f58' }}>OpenJarvis is dark by design</span>
                </div>
              </SettingRow>
              <SettingRow label="Font size">
                <div style={{ display: 'flex', gap: 6 }}>
                  {([12, 13, 14] as const).map(s => (
                    <button key={s} onClick={() => setFontSize(s)} className={`j-pill ${fontSize === s ? 'j-pill-active' : ''}`}>
                      {s}px
                    </button>
                  ))}
                </div>
              </SettingRow>
              <SettingRow label="Rail expanded by default">
                <Toggle checked={railExpanded} onChange={setRailExpandedLocal} />
              </SettingRow>
            </div>
          )}

          {section === 'memory' && (
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px', color: '#e6edf3' }}>Memory</h2>
              <SettingRow label="Default index path">
                <input className="j-input" value={indexPath} onChange={e => setIndexPath(e.target.value)} placeholder="~/documents" style={{ width: 220 }} />
              </SettingRow>
              <SettingRow label="Auto-index on startup">
                <Toggle checked={autoIndex} onChange={setAutoIndex} />
              </SettingRow>
              <SettingRow label="Chunk size">
                <input type="number" className="j-input" value={chunkSize} onChange={e => setChunkSize(+e.target.value)} min={128} max={4096} style={{ width: 80 }} />
              </SettingRow>
            </div>
          )}

          {section === 'telemetry' && (
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px', color: '#e6edf3' }}>Telemetry</h2>
              <SettingRow label="Send anonymous telemetry">
                <Toggle checked={anonymousTelemetry} onChange={setAnonymousTelemetry} />
              </SettingRow>
              <SettingRow label="Show cost estimates">
                <Toggle checked={showCost} onChange={setShowCost} />
              </SettingRow>
              <SettingRow label="Show energy estimates">
                <Toggle checked={showEnergy} onChange={setShowEnergy} />
              </SettingRow>
            </div>
          )}

          {section === 'advanced' && (
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px', color: '#e6edf3' }}>Advanced</h2>
              <p style={{ fontSize: 12, color: '#8b949e', marginBottom: 16 }}>
                Advanced configuration options for Jarvis runtime behaviour.
              </p>
              <SettingRow label="Max concurrent agents">
                <input type="number" className="j-input" defaultValue={3} min={1} max={10} style={{ width: 80 }} />
              </SettingRow>
              <SettingRow label="WebSocket reconnect interval">
                <input type="number" className="j-input" defaultValue={5000} style={{ width: 100 }} />
                <span style={{ fontSize: 11, color: '#484f58', marginLeft: 6 }}>ms</span>
              </SettingRow>
              <SettingRow label="Debug logging">
                <Toggle checked={false} onChange={() => {}} />
              </SettingRow>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
