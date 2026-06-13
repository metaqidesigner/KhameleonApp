import { useJarvisConnectors } from '@/hooks/useJarvis';

const CHANNELS = [
  'Discord', 'Telegram', 'Slack', 'WhatsApp', 'Gmail', 'iMessage',
  'Signal', 'IRC', 'Matrix', 'Mattermost', 'Reddit', 'Twitter',
  'Twitch', 'Nostr', 'LINE', 'Viber', 'XMPP', 'Zulip',
  'Google Chat', 'Webchat', 'Webhook',
];

const CONNECTOR_LIST = [
  'Gmail', 'Google Calendar', 'Google Drive', 'Google Contacts', 'Google Tasks',
  'Notion', 'Slack', 'Obsidian', 'Dropbox', 'Spotify', 'Strava',
  'Oura', 'Apple Notes', 'Apple Music', 'Apple Health', 'Apple Contacts',
  'GitHub Notifications', 'HackerNews', 'News RSS', 'iMessage', 'WhatsApp',
  'Outlook', 'Granola', 'Weather',
];

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#484f58', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
      {children}
    </div>
  );
}

function ConnectorTile({ name, connected }: { name: string; connected?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 10px',
      background: '#161b22', border: '1px solid #30363d', borderRadius: 4,
      gap: 8,
    }}>
      <span style={{ fontSize: 12, color: '#e6edf3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      {connected
        ? <span className="j-badge j-badge-green">Connected</span>
        : <button className="j-btn" style={{ height: 22, padding: '0 8px', fontSize: 11, flexShrink: 0 }}>Connect</button>
      }
    </div>
  );
}

export default function Communications() {
  const { data: connectors } = useJarvisConnectors();
  const connectedMap = Object.fromEntries((connectors ?? []).map(c => [c.name.toLowerCase(), c.connected]));

  return (
    <div className="j-page">
      <div className="j-page-header">
        <div>
          <h1>Channels & Connectors</h1>
          <p>Connect Jarvis to your communication channels</p>
        </div>
      </div>
      <div className="j-page-content" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Channels */}
        <div>
          <SectionLabel>Channels</SectionLabel>
          <div className="j-grid-3">
            {CHANNELS.map(ch => (
              <ConnectorTile key={ch} name={ch} connected={connectedMap[ch.toLowerCase()]} />
            ))}
          </div>
        </div>

        <div className="j-divider" />

        {/* Connectors */}
        <div>
          <SectionLabel>Connectors</SectionLabel>
          <div className="j-grid-3">
            {CONNECTOR_LIST.map(c => (
              <ConnectorTile key={c} name={c} connected={connectedMap[c.toLowerCase()]} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
