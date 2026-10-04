import { useEffect, useState } from 'react';
import { getIntegrations, type IntegrationEntry } from '@/lib/integrationsApi';

/**
 * The mockup's "Connected" tool-chip row (khameleon-home-implemented.html's
 * .tools-row), but real: the actual connected integrations from
 * /api/integrations (the same data pages/integrations.tsx shows), not the
 * mockup's fixed Slack/Notion/Drive/Calendar/Gmail placeholders. Reuses
 * AssistantCard's existing pill/add-button classes - already an exact
 * match for the mockup's tool-chip proportions - rather than new CSS.
 */

const CHIP_COLORS = ['#6FE6BD', '#8C7CF0', '#9fd0e0', '#F0A34C', '#E77A7A'];

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function ConnectedToolsRow() {
  const [entries, setEntries] = useState<IntegrationEntry[]>([]);

  useEffect(() => {
    getIntegrations().then(setEntries).catch(() => {});
  }, []);

  const connected = entries.filter(e => e.connected);

  return (
    <div className="ac-agents-row">
      <span className="ac-connected-label">Connected</span>
      {connected.length === 0 ? (
        <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'var(--j-text-faint)' }}>
          No integrations connected yet
        </span>
      ) : (
        connected.slice(0, 6).map((entry, i) => {
          const color = CHIP_COLORS[i % CHIP_COLORS.length];
          return (
            <button
              key={entry.id}
              className="ac-agent-pill"
              title={entry.name}
              style={{ borderColor: color, color }}
            >
              {initials(entry.name)}
            </button>
          );
        })
      )}
      <span className="ac-tool-add" title="Connect a tool">+</span>
    </div>
  );
}
