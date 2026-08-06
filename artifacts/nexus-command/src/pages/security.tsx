import React, { useState } from 'react';
import { Shield, Lock } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { useJarvisStore } from '@/store/jarvisStore';

const GUARDRAILS = [
  'Injection Scanner',
  'Rate Limiter',
  'File Policy',
  'SSRF Protection',
  'Audit Log',
];

const KEYS = [
  { id: 'ANTHROPIC_API_KEY', label: 'ANTHROPIC_API_KEY' },
  { id: 'OPENAI_API_KEY',    label: 'OPENAI_API_KEY' },
  { id: 'KHAMELEON_ENGINE',  label: 'KHAMELEON_ENGINE' },
];

export default function Security() {
  const agentHistory = useJarvisStore(s => s.agentHistory);
  const [keySet] = useState<Record<string, boolean>>({ ANTHROPIC_API_KEY: false, OPENAI_API_KEY: false, KHAMELEON_ENGINE: true });

  return (
    <div style={{ display:'grid', gridTemplateColumns:'40% 60%', gap:6, height:'100%', padding:8 }}>
      {/* Left */}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <JPanel title="CREDENTIAL VAULT STATUS" icon={<Lock size={13}/>}>
          <table className="j-table">
            <thead className="j-table-header">
              <tr><th>KEY</th><th>STATUS</th><th>ACTION</th></tr>
            </thead>
            <tbody>
              {KEYS.map(k => (
                <tr key={k.id}>
                  <td className="j-mono" style={{ fontSize:10 }}>{k.label}</td>
                  <td>
                    <span className={`j-badge ${keySet[k.id] ? 'j-badge-green' : 'j-badge-red'}`}>
                      {keySet[k.id] ? '● SET' : '✕ NOT SET'}
                    </span>
                  </td>
                  <td>
                    {keySet[k.id] && (
                      <button className="j-btn-ghost" style={{ height:22, padding:'0 8px', fontSize:9 }}>REVOKE</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </JPanel>

        <JPanel title="GUARDRAILS" icon={<Shield size={13}/>} headerVariant="amber" badge="ACTIVE">
          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            {GUARDRAILS.map(g => (
              <div key={g} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid rgba(0,212,255,0.06)' }}>
                <span style={{ fontFamily:'var(--j-font-ui)', fontSize:12, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--j-text)' }}>{g}</span>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--j-green)', animation:'jarvis-pulse 2s ease-in-out infinite' }}/>
                  <span className="j-mono" style={{ fontSize:10, color:'var(--j-green)' }}>ACTIVE</span>
                </div>
              </div>
            ))}
          </div>
        </JPanel>
      </div>

      {/* Right: Audit log */}
      <JPanel title="SECURITY AUDIT LOG — LAST 24H" icon={<Shield size={13}/>}>
        {agentHistory.length === 0 ? (
          <div className="j-empty">NO AUDIT EVENTS — ACTIVITY WILL APPEAR HERE</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table className="j-table">
              <thead className="j-table-header">
                <tr><th>TIMESTAMP</th><th>AGENT</th><th>ACTION</th><th>TOKENS</th><th>STATUS</th></tr>
              </thead>
              <tbody>
                {agentHistory.map(ev => (
                  <tr key={ev.id} style={{ animation:'jarvis-fadein 0.25s ease both' }}>
                    <td className="j-mono" style={{ fontSize:9, color:'var(--j-text-muted)' }}>
                      {new Date(ev.ts).toLocaleTimeString('en-US',{ hour12:false })}
                    </td>
                    <td><span className="j-badge j-badge-red" style={{ fontSize:8 }}>{ev.agent}</span></td>
                    <td style={{ fontFamily:'var(--j-font-ui)', fontSize:11, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.prompt}</td>
                    <td className="j-mono" style={{ fontSize:10 }}>{ev.tokens ?? '—'}</td>
                    <td><span className="j-badge j-badge-green" style={{ fontSize:8 }}>SUCCESS</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </JPanel>
    </div>
  );
}
