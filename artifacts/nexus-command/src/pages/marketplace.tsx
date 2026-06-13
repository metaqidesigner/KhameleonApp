export default function Marketplace() {
  return (
    <div className="j-page">
      <div className="j-page-header">
        <div>
          <h1>Marketplace</h1>
          <p>Community agents, workflows, and connectors</p>
        </div>
      </div>
      <div className="j-page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="j-card">
          <div className="j-card-header">What Jarvis does here</div>
          <p style={{ fontSize: 13, color: '#8b949e', margin: 0, lineHeight: 1.6 }}>
            The Marketplace is where the community shares pre-built agents, automation workflows,
            and connector bundles. Browse, install, and share — all running locally on your hardware,
            never sending data to third-party clouds.
          </p>
        </div>
        <div className="j-grid-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="j-skeleton" style={{ height: 100 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
