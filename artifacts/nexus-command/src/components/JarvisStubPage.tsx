import React from 'react';
import JPanel from '@/components/JPanel';

interface Props {
  title: string;
  icon: React.ReactNode;
  connectors: string[];
}

export default function JarvisStubPage({ title, icon, connectors }: Props) {
  return (
    <div style={{ height:'100%', padding:8 }}>
      <JPanel title={title} icon={icon}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:24, padding:'30px 20px' }}>
          {/* Animated radar */}
          <div style={{ position:'relative', width:80, height:80 }}>
            <div style={{ position:'absolute', inset:0, border:'1px solid rgba(0,212,255,0.2)', borderRadius:'50%' }} />
            <div style={{ position:'absolute', inset:8, border:'1px solid rgba(0,212,255,0.15)', borderRadius:'50%' }} />
            <div style={{ position:'absolute', inset:16, border:'1px solid rgba(0,212,255,0.1)', borderRadius:'50%' }} />
            <div style={{
              position:'absolute', inset:0, borderRadius:'50%',
              border:'2px solid transparent',
              borderTop:'2px solid rgba(0,212,255,0.6)',
              animation:'jarvis-spin 3s linear infinite',
            }} />
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {icon}
            </div>
          </div>

          <div style={{ fontFamily:'var(--j-font-head)', fontSize:16, color:'var(--j-cyan)', letterSpacing:'0.12em', textAlign:'center' }}>
            {title}
          </div>
          <div style={{ fontFamily:'var(--j-font-mono)', fontSize:11, color:'var(--j-text-muted)', letterSpacing:'0.12em', animation:'jarvis-pulse 2s ease-in-out infinite' }}>
            CONNECTING TO KHAMELEON NETWORK...
          </div>

          <div style={{ width:'100%', maxWidth:400 }}>
            <div style={{ fontFamily:'var(--j-font-ui)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.2em', color:'var(--j-text-muted)', marginBottom:10 }}>
              REQUIRED CONNECTORS:
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {connectors.map(c => (
                <div key={c} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 10px', background:'rgba(0,212,255,0.03)', border:'1px solid rgba(0,212,255,0.1)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:5, height:5, borderRadius:'50%', background:'rgba(0,212,255,0.3)', animation:'jarvis-pulse 2s ease-in-out infinite' }} />
                    <span style={{ fontFamily:'var(--j-font-ui)', fontSize:12, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--j-text-muted)' }}>{c}</span>
                  </div>
                  <button className="j-btn-ghost" style={{ height:24, padding:'0 10px', fontSize:10 }}>CONNECT</button>
                </div>
              ))}
            </div>
          </div>

          {/* Shimmer skeletons */}
          <div style={{ width:'100%', maxWidth:400, display:'flex', flexDirection:'column', gap:8 }}>
            {[85, 65, 75].map((w, i) => (
              <div key={i} className="j-shimmer" style={{ height:60 }} />
            ))}
          </div>
        </div>
      </JPanel>
    </div>
  );
}
