export default function Knowledge() {
  return (
    <div className="j-page">
      <div className="j-page-header">
        <div>
          <h1>Knowledge</h1>
          <p>Structured entity graph built from indexed documents</p>
        </div>
      </div>
      <div className="j-page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="j-card">
          <div className="j-card-header">What Jarvis does here</div>
          <p style={{ fontSize: 13, color: '#8b949e', margin: 0, lineHeight: 1.6 }}>
            As Jarvis indexes your documents and notes, it builds an entity graph —
            linking people, concepts, projects, and dates. You can explore these relationships
            visually, and the Memory agent uses the graph to improve long-range recall.
            Index documents in the Memory module to populate the graph.
          </p>
        </div>
        <div className="j-card">
          <div className="j-card-header">Graph preview</div>
          <div className="j-empty">
            <span style={{ fontSize: 20 }}>⬡</span>
            Index documents in Memory to build your knowledge graph
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
