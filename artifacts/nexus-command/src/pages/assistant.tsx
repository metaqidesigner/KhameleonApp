import React from 'react';

// Concept mode pills shown in the center-left of the Assistant home view.
// The orb + chat card is rendered separately as AssistantCard (fixed right).

const PILLS = [
  {
    id: 'command',
    label: 'COMMAND',
    sub: 'You ask. I execute.',
    dot: '#38cf8a',    // green
  },
  {
    id: 'context',
    label: 'CONTEXT',
    sub: 'I understand what matters.',
    dot: '#F0A34C',   // amber
  },
  {
    id: 'status',
    label: 'STATUS',
    sub: 'I keep you in the loop.',
    dot: '#8C7CF0',  // violet
  },
];

export default function AssistantHome() {
  return (
    <div className="ac-home">
      {/* ── Three concept pills ─────────────────────────────── */}
      <div className="ac-concept-pills">
        {PILLS.map(pill => (
          <div key={pill.id} className="ac-pill">
            <div className="ac-pill-label">
              <span className="ac-pill-dot" style={{ background: pill.dot }} />
              <span style={{ color: pill.dot }}>{pill.label}</span>
            </div>
            <div className="ac-pill-sub">{pill.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
