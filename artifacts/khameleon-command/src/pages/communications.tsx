import React, { useEffect, useState } from 'react';
import { Radio, Database } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { useJarvisStore } from '@/store/jarvisStore';
import { getConnectors, type JarvisConnector } from '@/lib/jarvisApi';

// True messaging-channel integrations (Discord, Telegram, Signal, etc.) have
// no backend of any kind anywhere in this codebase - no OAuth, no bot
// tokens, nothing. This used to show a per-tile "CONNECT" button that just
// flipped local component state to "CONNECTED ✓" with zero backend call -
// a pure UI illusion. Listed here honestly as not-yet-built instead.
const CHANNELS = [
  'Discord','Telegram','Slack','WhatsApp','Gmail','Signal',
  'Matrix','Mattermost','IRC','Reddit','LINE','Webhook','Webchat','Zulip',
];

function ChannelTile({ name }: { name: string }) {
  return (
    <div className="j-tile" style={{ gap: 4, opacity: 0.55 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--j-text-faint)' }} />
      <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--j-text)', letterSpacing: '0.04em', textAlign: 'center' }}>{name}</span>
      <span className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)' }}>NOT AVAILABLE</span>
    </div>
  );
}

// Real connector state from /api/connectors (routes/connectors.ts), which
// genuinely checks OAuth token status for Google/Microsoft/Spotify-backed
// connectors and reports Weather as always-on (no auth needed). The
// connect/disconnect flow itself lives in Settings > Connectors (it needs
// per-provider OAuth start URLs that are only defined there) - this panel
// used to reimplement a fake version of it locally instead of pointing
// there, with a "CONNECT" button that did nothing but toggle local state.
function ConnectorTile({ connector }: { connector: JarvisConnector }) {
  const setActiveTab = useJarvisStore(s => s.setActiveTab);
  const color = connector.connected ? 'var(--j-green)' : 'var(--j-text-faint)';

  return (
    <div className="j-tile" style={{ gap: 4 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: connector.connected ? `0 0 6px ${color}` : 'none' }} />
      <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--j-text)', letterSpacing: '0.04em', textAlign: 'center' }}>{connector.name}</span>
      <span className="j-mono" style={{ fontSize: 8, color }}>
        {connector.connected ? 'CONNECTED' : 'NOT CONNECTED'}
      </span>
      {!connector.connected && (
        <button
          className="j-btn-ghost"
          style={{ height: 22, padding: '0 8px', fontSize: 9, marginTop: 2, width: '100%' }}
          onClick={() => setActiveTab('integrations')}
        >
          VIEW IN INTEGRATIONS
        </button>
      )}
    </div>
  );
}

export default function Communications() {
  const [connectors, setConnectors] = useState<JarvisConnector[]>([]);

  useEffect(() => { getConnectors().then(setConnectors); }, []);

  const connectedCount = connectors.filter(c => c.connected).length;

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, height:'100%', padding:8 }}>
      <JPanel title="CHANNELS" icon={<Radio size={13}/>} badge="PLANNED">
        <div style={{ marginBottom:10, padding:'6px 10px', background:'linear-gradient(90deg, rgba(107,0,0,0.5), transparent)', fontFamily:'var(--j-font-ui)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.18em', color:'var(--j-text-muted)', borderBottom:'1px solid rgba(192,21,42,0.3)' }}>
          KHAMELEON CHANNEL NETWORK — NOT YET BUILT
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6 }}>
          {CHANNELS.map(name => <ChannelTile key={name} name={name} />)}
        </div>
      </JPanel>

      <JPanel title="DATA CONNECTORS" icon={<Database size={13}/>} headerVariant="amber" badge={`${connectedCount}/${connectors.length} CONNECTED`}>
        <div style={{ marginBottom:10, padding:'6px 10px', background:'linear-gradient(90deg, rgba(100,68,0,0.5), transparent)', fontFamily:'var(--j-font-ui)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.18em', color:'var(--j-amber)', borderBottom:'1px solid rgba(201,168,76,0.3)' }}>
          EXTERNAL DATA SOURCES
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6 }}>
          {connectors.map(c => <ConnectorTile key={c.id} connector={c} />)}
        </div>
      </JPanel>
    </div>
  );
}
