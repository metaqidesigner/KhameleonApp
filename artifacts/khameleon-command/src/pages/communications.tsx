import React, { useState } from 'react';
import { Radio, Database } from 'lucide-react';
import JPanel from '@/components/JPanel';

const CHANNELS = [
  'Discord','Telegram','Slack','WhatsApp','Gmail','Signal',
  'Matrix','Mattermost','IRC','Reddit','LINE','Webhook','Webchat','Zulip',
];
const CONNECTORS = [
  'Gmail','Google Calendar','Google Drive','Google Contacts','Notion','Slack',
  'Obsidian','GitHub','Spotify','Strava','Oura','Apple Health','Apple Notes',
  'HackerNews','News RSS','Outlook','Weather','Granola','Dropbox','TickTick',
  'WhatsApp','iMessage',
];

type Status = 'ACTIVE'|'STANDBY'|'OFFLINE';
const STATUS_COLORS: Record<Status, string> = { ACTIVE:'var(--j-green)', STANDBY:'var(--j-amber)', OFFLINE:'var(--j-text-faint)' };
function mockStatus(name: string): Status {
  const h = name.split('').reduce((a,c) => a + c.charCodeAt(0), 0);
  return (['ACTIVE','STANDBY','OFFLINE'] as Status[])[h % 3];
}

function TileGrid({ items, connected: isConnectors }: { items:string[]; connected?:boolean }) {
  const [states, setStates] = useState<Record<string,boolean>>({});
  const toggle = (name:string) => setStates(s => ({ ...s, [name]: !s[name] }));
  const st = mockStatus;

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6 }}>
      {items.map(name => {
        const connected = states[name] ?? false;
        const status = st(name);
        return (
          <div key={name} className="j-tile" style={{ gap:4 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background: connected ? 'var(--j-green)' : STATUS_COLORS[status] }} />
            <span style={{ fontFamily:'var(--j-font-ui)', fontSize:10, fontWeight:600, textTransform:'uppercase', color:'var(--j-text)', letterSpacing:'0.04em', textAlign:'center' }}>{name}</span>
            <span className="j-mono" style={{ fontSize:8, color: connected ? 'var(--j-green)' : STATUS_COLORS[status] }}>
              {connected ? 'ACTIVE' : status}
            </span>
            <button
              className="j-btn-ghost"
              style={{ height:22, padding:'0 8px', fontSize:9, marginTop:2, width:'100%' }}
              onClick={() => toggle(name)}
            >
              {connected ? 'CONNECTED ✓' : 'CONNECT'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function Communications() {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, height:'100%', padding:8 }}>
      <JPanel title="CHANNELS" icon={<Radio size={13}/>}>
        <div style={{ marginBottom:10, padding:'6px 10px', background:'linear-gradient(90deg, rgba(107,0,0,0.5), transparent)', fontFamily:'var(--j-font-ui)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.18em', color:'var(--j-text-muted)', borderBottom:'1px solid rgba(192,21,42,0.3)' }}>
          KHAMELEON CHANNEL NETWORK
        </div>
        <TileGrid items={CHANNELS} />
      </JPanel>

      <JPanel title="DATA CONNECTORS" icon={<Database size={13}/>} headerVariant="amber" badge="22 AVAILABLE">
        <div style={{ marginBottom:10, padding:'6px 10px', background:'linear-gradient(90deg, rgba(100,68,0,0.5), transparent)', fontFamily:'var(--j-font-ui)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.18em', color:'var(--j-amber)', borderBottom:'1px solid rgba(201,168,76,0.3)' }}>
          EXTERNAL DATA SOURCES
        </div>
        <TileGrid items={CONNECTORS} connected />
      </JPanel>
    </div>
  );
}
