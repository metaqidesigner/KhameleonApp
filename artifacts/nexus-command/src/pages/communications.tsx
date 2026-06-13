import { motion } from 'framer-motion';
import { Radio, ExternalLink, CheckCircle, Circle } from 'lucide-react';
import { useJarvisConnectors } from '@/hooks/useJarvis';

const CONNECTOR_ICONS: Record<string, string> = {
  gmail: '📧', gcalendar: '📅', slack: '💬', notion: '📓',
  gdrive: '📁', github: '⚙️', discord: '🎮', telegram: '✈️',
  whatsapp: '💚', ticktick: '✅',
};

const CONNECTOR_DESCRIPTIONS: Record<string, string> = {
  gmail: 'Read, compose, and manage your emails',
  gcalendar: 'View and create calendar events',
  slack: 'Send and receive Slack messages',
  notion: 'Read and write Notion pages',
  gdrive: 'Access and manage Google Drive files',
  github: 'Manage repos, issues, and PRs',
  discord: 'Monitor and respond in Discord servers',
  telegram: 'Send and receive Telegram messages',
  whatsapp: 'WhatsApp messaging integration',
  ticktick: 'Task and to-do management',
};

export default function Communications() {
  const { data: connectors, isLoading } = useJarvisConnectors();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Connectors</h2>
        <p style={{ fontSize: 12, color: 'rgba(130,170,200,0.55)', lineHeight: 1.5 }}>Connect your tools and services to give Nexus access to your digital world. Each connector unlocks new agent capabilities.</p>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Radio style={{ width: 14, height: 14, color: '#38bdf8' }} />
        <span style={{ fontSize: 12, color: 'rgba(130,170,200,0.6)' }}>
          {isLoading ? 'Loading…' : `${(connectors ?? []).filter(c => c.connected).length} of ${(connectors ?? []).length} connected`}
        </span>
      </div>

      {/* Connector grid */}
      {isLoading ? (
        <div className="nexus-grid-2">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="nexus-card nexus-shimmer" style={{ height: 100 }} />)}
        </div>
      ) : (
        <div className="nexus-grid-2">
          {(connectors ?? []).map((connector, i) => (
            <motion.div key={connector.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="nexus-card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 24, lineHeight: 1 }}>{CONNECTOR_ICONS[connector.id] ?? '🔌'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(220,240,255,0.95)', marginBottom: 2 }}>{connector.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(130,170,200,0.55)', lineHeight: 1.4 }}>{CONNECTOR_DESCRIPTIONS[connector.id] ?? 'External integration'}</div>
                </div>
                {connector.connected ? (
                  <CheckCircle style={{ width: 18, height: 18, color: '#10b981', flexShrink: 0 }} />
                ) : (
                  <Circle style={{ width: 18, height: 18, color: 'rgba(130,170,200,0.25)', flexShrink: 0 }} />
                )}
              </div>
              <button
                className={connector.connected ? 'nexus-btn-ghost' : 'nexus-btn'}
                style={connector.connected ? {} : { borderColor: 'rgba(56,189,248,0.4)', color: '#38bdf8', background: 'rgba(56,189,248,0.08)', width: '100%', justifyContent: 'center' }}
                onClick={() => { /* stub OAuth flow */ }}
              >
                {connector.connected ? (
                  <span style={{ fontSize: 11, color: '#10b981' }}>✓ Connected</span>
                ) : (
                  <><ExternalLink style={{ width: 12, height: 12 }} /> Connect via OpenJarvis</>
                )}
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div style={{ padding: 16, background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.12)', borderRadius: 12 }}>
        <p style={{ fontSize: 12, color: 'rgba(130,170,200,0.6)', lineHeight: 1.6, margin: 0 }}>
          Connectors require a running OpenJarvis backend with the appropriate credentials configured. Start with <code style={{ fontSize: 11, color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '1px 5px', borderRadius: 4 }}>OPENAI_API_KEY</code> or <code style={{ fontSize: 11, color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '1px 5px', borderRadius: 4 }}>ANTHROPIC_API_KEY</code> in your .env file.
        </p>
      </div>
    </div>
  );
}
