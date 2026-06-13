export default function Calendar() {
  return (
    <div className="j-page">
      <div className="j-page-header">
        <div>
          <h1>Calendar</h1>
          <p>Intelligent scheduling and event management</p>
        </div>
      </div>
      <div className="j-page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="j-card">
          <div className="j-card-header">What Jarvis does here</div>
          <p style={{ fontSize: 13, color: '#8b949e', margin: 0, lineHeight: 1.6 }}>
            Jarvis reads your calendar to schedule meetings, prepare briefings before events,
            summarise post-meeting notes, and proactively remind you of upcoming deadlines —
            all without giving up control of your data.
          </p>
        </div>
        <div className="j-card">
          <div className="j-card-header">Required connectors</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['Google Calendar', 'Outlook', 'Apple Calendar'].map(c => (
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
