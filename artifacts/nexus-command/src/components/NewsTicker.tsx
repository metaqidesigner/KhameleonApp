import { useJarvisAgentFeed } from '@/hooks/useJarvis';
import { useJarvisStore } from '@/store/jarvisStore';

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
}

const OFFLINE_MSG = '/// JARVIS OFFLINE — RUN `jarvis serve` OR SET API KEYS /// AWAITING ENGINE CONNECTION /// SYSTEM STANDBY ///';

export default function NewsTicker() {
  const { data: feed } = useJarvisAgentFeed();
  const tickerSpeed = useJarvisStore(s => s.tickerSpeed);

  let content: string;
  if (!feed || feed.length === 0) {
    content = OFFLINE_MSG;
  } else {
    content = feed.map(item =>
      `◈ ${fmtTime(item.ts)}  ${item.agent.toUpperCase()}  →  ${item.prompt.slice(0, 50)}${item.prompt.length > 50 ? '…' : ''}  |  ⚡ ${item.latency_ms ?? 0}ms  ·  ${item.tokens ?? 0} tok  ·  $${(item.cost_usd ?? 0).toFixed(4)}`
    ).join('   ///   ');
  }

  return (
    <div style={{
      height: 32, flexShrink: 0,
      background: 'rgba(0,4,8,0.98)',
      borderTop: '1px solid rgba(192,21,42,0.55)',
      display: 'flex', alignItems: 'stretch',
      overflow: 'hidden',
      position: 'relative', zIndex: 50,
    }}>
      {/* Badge */}
      <div style={{
        background: '#8b0000',
        color: '#fff',
        fontFamily: 'var(--j-font-ui)',
        fontSize: 11, fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        padding: '0 12px',
        display: 'flex', alignItems: 'center',
        borderRight: '1px solid rgba(192,21,42,0.55)',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}>
        JARVIS FEED
      </div>

      {/* Scrolling content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          position: 'absolute',
          whiteSpace: 'nowrap',
          fontFamily: 'var(--j-font-mono)',
          fontSize: 11,
          color: 'var(--j-text)',
          top: '50%', transform: 'translateY(-50%)',
          animation: `marquee ${tickerSpeed}s linear infinite`,
        }}>
          {content}
        </div>
      </div>
    </div>
  );
}
