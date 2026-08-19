import React, { useState, useEffect } from 'react';
import { Save, Trash2, Plus } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { getRoster, upsertAgent, deleteAgent, FALLBACK_ROSTER, PROVIDER_LABELS, type AgentConfig, type Provider, type AgentRole } from '@/lib/agentsApi';

const PROVIDERS: Provider[] = ['anthropic','openai','google','openrouter','ollama','minimax','custom'];
const ROLES: AgentRole[] = ['general','research','code','analysis','creative'];
const COLORS = ['#c9a84c','#00d4ff','#3fb950','#a78bfa','#f97316','#ec4899','#14b8a6','#c0152a','#60a5fa','#fbbf24'];

const BLANK: Partial<AgentConfig> = { name:'', provider:'openai', model:'gpt-4o', enabled:true, role:'general', systemPrompt:'You are a helpful AI assistant.', color:'#00d4ff', initials:'', apiKey:'', baseUrl:'' };

export default function AgentSettings() {
  const [roster, setRoster] = useState<AgentConfig[]>(FALLBACK_ROSTER);
  const [editing, setEditing] = useState<Partial<AgentConfig>>(BLANK);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() { getRoster().then(setRoster).catch(() => {}); }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing.name || !editing.provider || !editing.model) {
      setMsg('Name, provider and model are required.'); return;
    }
    setSaving(true);
    try {
      await upsertAgent(editing);
      await load();
      setMsg('✓ Agent saved');
      setEditing(BLANK);
    } catch { setMsg('✗ Failed to save'); }
    finally { setSaving(false); }
  }

  async function del(id: string) {
    try { await deleteAgent(id); await load(); setMsg('✓ Agent removed'); }
    catch { setMsg('✗ Cannot remove built-in agents'); }
  }

  function field(label: string, el: React.ReactNode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontFamily: 'var(--j-font-ui)', fontSize: 9, color: 'var(--j-text-muted)', letterSpacing: '0.06em' }}>{label}</div>
        {el}
      </div>
    );
  }

  const inputStyle: React.CSSProperties = { padding: '5px 8px', background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.15)', color: 'var(--j-text)', fontFamily: 'var(--j-font-mono)', fontSize: 11, outline: 'none' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '40% 1fr', gap: 6, height: '100%', padding: 8 }}>
      {/* roster list */}
      <JPanel title="INSTALLED AGENTS" badge={String(roster.length)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {roster.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'rgba(0,212,255,0.02)', border: '1px solid rgba(0,212,255,0.07)' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--j-font-ui)', fontSize: 9, fontWeight: 700, color: '#000', flexShrink: 0 }}>{a.initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, color: '#fff' }}>{a.name}</div>
                <div className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-muted)' }}>{a.model}</div>
              </div>
              <span className="j-badge" style={{ fontSize: 7, color: 'var(--j-text-faint)' }}>{a.apiKey === 'SET' ? '●KEY' : a.apiKey === 'NOT SET' ? '○KEY' : '●INT'}</span>
              <button className="j-btn-ghost" style={{ height: 22, width: 22, padding: 0 }} onClick={() => setEditing({ ...a })}>✎</button>
              <button className="j-btn-ghost" style={{ height: 22, width: 22, padding: 0, borderColor: 'rgba(192,21,42,0.3)', color: 'var(--j-red)' }} onClick={() => del(a.id)}>
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
        <button className="j-btn-ghost" style={{ width: '100%', marginTop: 8, justifyContent: 'center', fontSize: 10 }} onClick={() => setEditing(BLANK)}>
          <Plus size={11} />NEW AGENT
        </button>
      </JPanel>

      {/* editor */}
      <JPanel title={editing.id ? `EDIT — ${editing.name ?? ''}` : 'ADD AGENT'}>
        {msg && (
          <div style={{ padding: '6px 10px', marginBottom: 8, background: msg.startsWith('✓') ? 'rgba(63,185,80,0.1)' : 'rgba(192,21,42,0.1)', border: `1px solid ${msg.startsWith('✓') ? 'rgba(63,185,80,0.3)' : 'rgba(192,21,42,0.3)'}`, fontFamily: 'var(--j-font-mono)', fontSize: 10, color: msg.startsWith('✓') ? 'var(--j-green)' : 'var(--j-red)' }}>
            {msg}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {field('NAME', <input style={inputStyle} value={editing.name ?? ''} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} placeholder="CLAUDE" />)}
          {field('PROVIDER', (
            <select style={inputStyle} value={editing.provider ?? 'openai'} onChange={e => setEditing(p => ({ ...p, provider: e.target.value as Provider }))}>
              {PROVIDERS.map(p => <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>)}
            </select>
          ))}
          {field('MODEL', <input style={inputStyle} value={editing.model ?? ''} onChange={e => setEditing(p => ({ ...p, model: e.target.value }))} placeholder="gpt-4o" />)}
          {field('ROLE', (
            <select style={inputStyle} value={editing.role ?? 'general'} onChange={e => setEditing(p => ({ ...p, role: e.target.value as AgentRole }))}>
              {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
            </select>
          ))}
          {field('API KEY', <input style={inputStyle} type="password" value={editing.apiKey ?? ''} onChange={e => setEditing(p => ({ ...p, apiKey: e.target.value }))} placeholder="sk-... (leave blank for Replit integration)" />)}
          {field('BASE URL', <input style={inputStyle} value={editing.baseUrl ?? ''} onChange={e => setEditing(p => ({ ...p, baseUrl: e.target.value }))} placeholder="https://api.custom.com/v1" />)}
          {field('INITIALS', <input style={inputStyle} value={editing.initials ?? ''} maxLength={2} onChange={e => setEditing(p => ({ ...p, initials: e.target.value.toUpperCase() }))} placeholder="CL" />)}
          {field('COLOR', (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', paddingTop: 2 }}>
              {COLORS.map(c => (
                <div key={c} onClick={() => setEditing(p => ({ ...p, color: c }))} style={{ width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer', border: editing.color === c ? '2px solid #fff' : '2px solid transparent', transition: 'border 0.1s' }} />
              ))}
            </div>
          ))}
        </div>
        {field('SYSTEM PROMPT', (
          <textarea style={{ ...inputStyle, height: 80, resize: 'none', width: '100%' }} value={editing.systemPrompt ?? ''} onChange={e => setEditing(p => ({ ...p, systemPrompt: e.target.value }))} placeholder="You are a helpful AI assistant." />
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button className="j-btn-primary" style={{ flex: 1, height: 32, fontSize: 10 }} onClick={save} disabled={saving}>
            <Save size={12} />{saving ? 'SAVING...' : 'SAVE AGENT'}
          </button>
          <button className="j-btn-ghost" style={{ height: 32, padding: '0 16px', fontSize: 10 }} onClick={() => { setEditing(BLANK); setMsg(''); }}>CLEAR</button>
        </div>
        <div style={{ marginTop: 12, padding: '8px 10px', background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.08)' }}>
          <div style={{ fontFamily: 'var(--j-font-ui)', fontSize: 9, color: 'var(--j-text-muted)', letterSpacing: '0.05em', lineHeight: 1.8 }}>
            CLAUDE (Anthropic) · GPT-4o (OpenAI) — powered by Replit AI Integrations. No API key needed, billed to your credits.<br/>
            GEMINI: set GEMINI_API_KEY · OPENROUTER: set OPENROUTER_API_KEY<br/>
            LOCAL (Ollama): runs on localhost:11434 · MINIMAX: set MINIMAX_API_KEY
          </div>
        </div>
      </JPanel>
    </div>
  );
}
