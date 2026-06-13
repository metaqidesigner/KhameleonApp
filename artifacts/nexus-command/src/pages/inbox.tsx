export default function Inbox() {
  return (
    <div className="j-page">
      <div className="j-page-header">
        <div>
          <h1>Inbox</h1>
          <p>Unified message triage across all connected channels</p>
        </div>
      </div>
      <div className="j-page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="j-card">
          <div className="j-card-header">What Jarvis does here</div>
          <p style={{ fontSize: 13, color: '#8b949e', margin: 0, lineHeight: 1.6 }}>
            When connected to your messaging channels, Jarvis aggregates emails, Slack messages,
            Discord DMs, and other notifications into a single prioritised inbox.
            It can summarise threads, draft replies, and surface action items — automatically.
          </p>
        </div>
        <div className="j-card">
          <div className="j-card-header">Required connectors</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['Gmail', 'Slack', 'Discord', 'iMessage', 'WhatsApp'].map(c => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #30363d' }}>
                <span style={{ fontSize: 13 }}>{c}</span>
                <button className="j-btn" style={{ height: 26, fontSize: 11 }}>Connect</button>
              </div>
            ))}
          </div>
        </div>
        <div className="j-grid-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="j-skeleton" style={{ height: 80 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
