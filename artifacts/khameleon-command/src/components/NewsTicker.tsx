import { Radio } from 'lucide-react';
import { useJarvisAgentFeed } from '@/hooks/useJarvis';
import { useJarvisStore } from '@/store/jarvisStore';

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

const OFFLINE_MSG = 'Khameleon offline — set API keys to connect   ///   awaiting engine connection   ///   system standby';

export default function NewsTicker() {
  const { data: feed } = useJarvisAgentFeed();
  const tickerSpeed    = useJarvisStore(s => s.tickerSpeed);

  let content: string;
  if (!feed || feed.length === 0) {
    content = OFFLINE_MSG;
  } else {
    content = feed.map(item =>
      `${fmtTime(item.ts)}  ${item.agent.toUpperCase()}  →  ${item.prompt.slice(0, 60)}${item.prompt.length > 60 ? '…' : ''}  ·  ${item.latency_ms ?? 0}ms  ·  ${item.tokens ?? 0} tok`
    ).join('   ///   ');
  }

  return (
    <div style={{
      height: 34,
      flexShrink: 0,
      background: 'rgba(6, 9, 20, 0.97)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      position: 'relative',
      zIndex: 50,
    }}>
      {/* Feed label — coral rounded pill */}
      <div className="kc-feed-shortcut" style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'rgba(226, 90, 110, 0.88)',
        color: '#fff',
        fontFamily: 'var(--j-font-ui)',
        fontSize: 11,
        fontWeight: 700,
        padding: '0 12px',
        margin: '0 12px 0 8px',
        height: 22,
        borderRadius: 11,
        flexShrink: 0,
        whiteSpace: 'nowrap',
        boxShadow: '0 0 12px rgba(226,90,110,0.35)',
      }}>
        <Radio size={10} />
        Khameleon feed
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.08)', flexShrink: 0, marginRight: 12 }} />

      {/* Scrolling text */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          position: 'absolute',
          whiteSpace: 'nowrap',
          fontFamily: 'var(--j-font-mono)',
          fontSize: 11,
          color: 'rgba(196,212,236,0.55)',
          top: '50%',
          transform: 'translateY(-50%)',
          animation: `marquee ${tickerSpeed}s linear infinite`,
          letterSpacing: '0.02em',
        }}>
          {content}
        </div>
      </div>
    </div>
  );
}
