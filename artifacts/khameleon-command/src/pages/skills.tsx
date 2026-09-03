import React, { useState } from 'react';
import { Play, Zap } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { useJarvisSkills, useInstallSkill } from '@/hooks/useJarvis';

export default function Skills() {
  const { data: skills = [] } = useJarvisSkills();
  const { mutateAsync: install, isPending } = useInstallSkill();
  const [source, setSource] = useState('');
  const [status, setStatus] = useState<string|null>(null);

  const doInstall = async () => {
    if (!source.trim()) return;
    setStatus(null);
    try {
      await install(source.trim());
      setStatus('● SKILL INSTALLED SUCCESSFULLY');
      setSource('');
    } catch (error) {
      setStatus(`✕ ${error instanceof Error ? error.message : 'INSTALL FAILED'}`);
    }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6, height:'100%', padding:8 }}>
      {/* INSTALL */}
      <div style={{ flexShrink:0 }}>
        <JPanel title="INSTALL SKILL" icon={<Play size={13}/>}>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input
              className="j-input"
              style={{ flex:1 }}
              placeholder="SKILL SOURCE — e.g. hermes:arxiv"
              value={source}
              onChange={e => setSource(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doInstall()}
            />
            <button className="j-btn-primary" style={{ height:34, padding:'0 16px', fontSize:11 }} onClick={doInstall} disabled={isPending || !source.trim()}>
              {isPending ? <div style={{ width:10, height:10, border:'1.5px solid rgba(255,255,255,0.3)', borderTop:'1.5px solid #fff', borderRadius:'50%', animation:'jarvis-spin 0.7s linear infinite' }}/> : <Play size={12}/>}
              ▶ INSTALL
            </button>
          </div>
          {status && (
            <div style={{ marginTop:8, fontFamily:'var(--j-font-mono)', fontSize:10, color: status.startsWith('●') ? 'var(--j-green)' : 'var(--j-red)', animation:'jarvis-fadein 0.2s ease both' }}>{status}</div>
          )}
        </JPanel>
      </div>

      {/* INSTALLED SKILLS */}
      <div style={{ flex:1, minHeight:0 }}>
        <JPanel title="INSTALLED SKILLS" icon={<Zap size={13}/>}>
          {skills.length === 0 ? (
            <div className="j-empty">
              NO SKILLS INSTALLED — USE HERMES REGISTRY TO EXTEND KHAMELEON
            </div>
          ) : (
            <table className="j-table">
              <thead className="j-table-header">
                {/* No ACTIONS column - there's no removeSkill API or backend
                    route yet to back a REMOVE button (see installSkill's
                    comment in jarvisApi.ts: /skills/install doesn't exist
                    on the server either). A button with no handler and
                    nothing to call is worse than no button. */}
                <tr><th>NAME</th><th>SOURCE</th><th>STATUS</th><th>INSTALLED</th></tr>
              </thead>
              <tbody>
                {skills.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontFamily:'var(--j-font-ui)', fontSize:11 }}>{s.name.toUpperCase()}</td>
                    <td className="j-mono" style={{ fontSize:10, color:'var(--j-cyan)' }}>{s.source}</td>
                    <td><span className="j-badge j-badge-green" style={{ fontSize:8 }}>ACTIVE</span></td>
                    <td className="j-mono" style={{ fontSize:10, color:'var(--j-text-muted)' }}>—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </JPanel>
      </div>
    </div>
  );
}
