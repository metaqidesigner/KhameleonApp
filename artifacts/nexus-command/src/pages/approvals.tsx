export default function Approvals() {
  return (
    <div className="j-page">
      <div className="j-page-header">
        <div>
          <h1>Approvals</h1>
          <p>Human-in-the-loop decision queue for autonomous agent actions</p>
        </div>
      </div>
      <div className="j-page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="j-card">
          <div className="j-card-header">What Jarvis does here</div>
          <p style={{ fontSize: 13, color: '#8b949e', margin: 0, lineHeight: 1.6 }}>
            When the Operative or Orchestrator agent wants to take a consequential action —
            sending an email, modifying a file, running a command — it pauses and queues
            an approval request here. You review and approve or reject before execution continues.
          </p>
        </div>
        <div className="j-card">
          <div className="j-card-header">Pending approvals</div>
          <div className="j-empty">No pending approvals — queue is clear</div>
        </div>
      </div>
    </div>
  );
}
