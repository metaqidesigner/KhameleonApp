import React from 'react';
import { Lock } from 'lucide-react';
import JPanel from '@/components/JPanel';

const SET_KEYS = ['ANTHROPIC_API_KEY', 'KHAMELEON_ENGINE', 'SESSION_SECRET'];

export default function Vault() {
  return (
    <div style={{ height:'100%', padding:8 }}>
      <JPanel title="SECURE VAULT" icon={<Lock size={13}/>}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 20px', gap:20, textAlign:'center' }}>
          <Lock size={64} color="var(--j-red)" style={{ filter:'drop-shadow(0 0 16px rgba(192,21,42,0.6))' }} />
          <div style={{ fontFamily:'var(--j-font-head)', fontSize:18, fontWeight:700, color:'var(--j-cyan)', letterSpacing:'0.1em' }}>
            ENCRYPTED LOCAL VAULT
          </div>
          <div style={{ fontFamily:'var(--j-font-ui)', fontSize:13, color:'var(--j-text-muted)', letterSpacing:'0.08em', maxWidth:400 }}>
            On-device secret storage · Coming in next release
          </div>
          <div style={{ width:320, height:1, background:'linear-gradient(90deg, transparent, rgba(0,212,255,0.3), transparent)' }} />

          <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%', maxWidth:400 }}>
            <div style={{ fontFamily:'var(--j-font-ui)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.2em', color:'var(--j-text-muted)', textAlign:'left', marginBottom:4 }}>
              SET ENVIRONMENT KEYS
            </div>
            {SET_KEYS.map(k => (
              <div key={k} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'rgba(0,212,255,0.03)', border:'1px solid rgba(0,212,255,0.1)' }}>
                <span style={{ color:'var(--j-cyan)', fontFamily:'var(--j-font-mono)', fontSize:12 }}>◈</span>
                <span className="j-mono" style={{ fontSize:12, color:'var(--j-text)' }}>{k}</span>
              </div>
            ))}
          </div>

          <div style={{ display:'flex', gap:16, marginTop:10 }}>
            {['ENCRYPTING', 'ISOLATED', 'LOCAL-ONLY'].map(tag => (
              <span key={tag} className="j-badge j-badge-cyan" style={{ fontSize:9, letterSpacing:'0.12em' }}>{tag}</span>
            ))}
          </div>
        </div>
      </JPanel>
    </div>
  );
}
