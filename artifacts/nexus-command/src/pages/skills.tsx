import { useState } from 'react';
import { useJarvisSkills, useInstallSkill } from '@/hooks/useJarvis';

export default function Skills() {
  const { data: skills, isLoading } = useJarvisSkills();
  const install = useInstallSkill();
  const [source, setSource] = useState('');

  const handleInstall = () => {
    if (!source.trim()) return;
    install.mutate(source.trim(), { onSuccess: () => setSource('') });
  };

  return (
    <div className="j-page">
      <div className="j-page-header">
        <div>
          <h1>Skills</h1>
          <p>Installable capability extensions via Hermes registry</p>
        </div>
      </div>
      <div className="j-page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Install */}
        <div className="j-card">
          <div className="j-card-header">Install Skill</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              className="j-input"
              value={source}
              onChange={e => setSource(e.target.value)}
              placeholder="hermes:arxiv"
              onKeyDown={e => e.key === 'Enter' && handleInstall()}
            />
            <button
              onClick={handleInstall}
              disabled={!source.trim() || install.isPending}
              className="j-btn j-btn-primary"
              style={{ flexShrink: 0 }}
            >
              {install.isPending ? 'Installing…' : 'Install'}
            </button>
          </div>
          <a style={{ fontSize: 12, color: '#58a6ff', textDecoration: 'none' }} href="#" onClick={e => e.preventDefault()}>
            Browse Hermes registry →
          </a>
          {install.isSuccess && (
            <div style={{ marginTop: 8, fontSize: 12, fontFamily: 'var(--font-mono)', color: '#3fb950' }}>✓ Skill installed</div>
          )}
          {install.isError && (
            <div style={{ marginTop: 8, fontSize: 12, fontFamily: 'var(--font-mono)', color: '#f85149' }}>✗ Install failed</div>
          )}
        </div>

        {/* Installed skills table */}
        <div className="j-card">
          <div className="j-card-header">Installed Skills</div>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="j-skeleton" style={{ height: 36, marginBottom: 6 }} />
            ))
          ) : (skills?.length ?? 0) === 0 ? (
            <div className="j-empty">
              No skills installed. Install from the Hermes registry.
            </div>
          ) : (
            <table className="j-table">
              <thead><tr>
                <th>Name</th><th>Source</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {skills?.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#8b949e' }}>{s.source}</td>
                    <td><span className="j-badge j-badge-green">Active</span></td>
                    <td>
                      <button className="j-btn j-btn-danger" style={{ height: 24, fontSize: 11, padding: '0 8px' }}>
                        Uninstall
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
