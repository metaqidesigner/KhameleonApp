import { useState } from 'react';
import { Puzzle, Download, Trash2, Package } from 'lucide-react';
import { useJarvisSkills, useInstallSkill } from '@/hooks/useJarvis';

export default function Skills() {
  const [installInput, setInstallInput] = useState('');
  const { data: skills, isLoading, refetch } = useJarvisSkills();
  const { mutate: install, isPending: installing } = useInstallSkill();

  const handleInstall = () => {
    if (!installInput.trim()) return;
    install(installInput.trim(), {
      onSuccess: () => {
        setInstallInput('');
        refetch();
      },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
          Installed Skills
        </h2>
        <p style={{ fontSize: 12, color: 'rgba(130,170,200,0.6)', lineHeight: 1.5 }}>
          Extend Nexus Command with OpenJarvis-compatible skills. Install from the Hermes registry or a custom source.
        </p>
      </div>

      {/* Install box */}
      <div className="nexus-card" style={{ padding: 18 }}>
        <div style={{ fontSize: 11, color: 'rgba(245,158,11,0.7)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: 12, textTransform: 'uppercase' }}>
          Install Skill
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            className="nexus-input"
            value={installInput}
            onChange={e => setInstallInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleInstall()}
            placeholder="e.g. hermes:arxiv or https://github.com/org/skill"
          />
          <button
            className="nexus-btn"
            onClick={handleInstall}
            disabled={installing || !installInput.trim()}
            style={{ flexShrink: 0, borderColor: 'rgba(245,158,11,0.4)', color: '#f59e0b', background: 'rgba(245,158,11,0.1)' }}
          >
            <Download style={{ width: 13, height: 13 }} />
            {installing ? 'Installing…' : 'Install'}
          </button>
        </div>
      </div>

      {/* Skills grid */}
      {isLoading ? (
        <div className="nexus-grid-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="nexus-card nexus-shimmer" style={{ height: 110 }} />
          ))}
        </div>
      ) : (
        <div className="nexus-grid-2">
          {(skills ?? []).map(skill => (
            <div key={skill.id} className="nexus-card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Puzzle style={{ width: 16, height: 16, color: '#f59e0b' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(220,240,255,0.95)', marginBottom: 2 }}>
                      {skill.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(130,170,200,0.6)', lineHeight: 1.4 }}>
                      {skill.description}
                    </div>
                  </div>
                </div>
                <button
                  className="nexus-btn-ghost"
                  style={{ padding: '5px 8px', flexShrink: 0 }}
                  title="Uninstall (stub)"
                >
                  <Trash2 style={{ width: 13, height: 13, color: 'rgba(239,68,68,0.6)' }} />
                </button>
              </div>
              <div style={{
                marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(0,212,255,0.07)',
                fontSize: 10, color: 'rgba(0,212,255,0.4)', fontFamily: 'var(--font-mono)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Package style={{ width: 10, height: 10 }} />
                {skill.source}
              </div>
            </div>
          ))}
          {(skills ?? []).length === 0 && (
            <div style={{
              gridColumn: '1 / -1', padding: 40, textAlign: 'center',
              color: 'rgba(130,170,200,0.4)', fontSize: 13,
            }}>
              No skills installed. Use the install box above to add your first skill.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
