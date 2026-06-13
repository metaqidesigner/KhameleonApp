export default function Projects() {
  return (
    <div className="j-page">
      <div className="j-page-header">
        <div>
          <h1>Projects</h1>
          <p>Task boards and project tracking powered by Jarvis</p>
        </div>
        <button className="j-btn j-btn-primary">+ New Project</button>
      </div>
      <div className="j-page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="j-card">
          <div className="j-card-header">What Jarvis does here</div>
          <p style={{ fontSize: 13, color: '#8b949e', margin: 0, lineHeight: 1.6 }}>
            Jarvis connects to your project management tools to surface blockers,
            summarise progress, generate status updates, and proactively flag deadlines.
            Connect a source to populate your boards.
          </p>
        </div>
        <div className="j-card">
          <div className="j-card-header">Required connectors</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['GitHub Issues', 'Linear', 'Notion', 'Jira', 'TickTick'].map(c => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #30363d' }}>
                <span style={{ fontSize: 13 }}>{c}</span>
                <button className="j-btn" style={{ height: 26, fontSize: 11 }}>Connect</button>
              </div>
            ))}
          </div>
        </div>
        <div className="j-grid-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="j-skeleton" style={{ height: 100 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
