import React from 'react';

export default function NotFound() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:20 }}>
      <div style={{ fontFamily:'var(--j-font-head)', fontSize:48, color:'var(--j-red)', letterSpacing:'0.1em', textShadow:'0 0 20px rgba(192,21,42,0.5)' }}>404</div>
      <div style={{ fontFamily:'var(--j-font-mono)', fontSize:13, color:'var(--j-text-muted)', letterSpacing:'0.15em' }}>MODULE NOT FOUND</div>
    </div>
  );
}
