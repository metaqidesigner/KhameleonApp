import { useEffect, useState } from 'react';
import { Inbox as InboxIcon, Mail, MailOpen } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { getInbox, updateInboxItem, type InboxItem } from '@/lib/inboxApi';

const PRIORITY_COLOR: Record<string, string> = {
  high: 'var(--j-red)', urgent: 'var(--j-red)',
  normal: 'var(--j-text-muted)', medium: 'var(--j-amber)',
  low: 'var(--j-text-faint)',
};

/**
 * Real inbox backend (routes/inbox.ts) has existed since well before
 * this pass - live Gmail / Outlook fetch with a local DB fallback - but
 * the page itself was a 7-line JarvisStubPage. This is the real page.
 *
 * "Mark as read" only appears when source === 'local': PATCH /:id only
 * ever writes to the local DB table (a serial int id), and Gmail/Outlook
 * ids are opaque provider strings that will never match a DB row - the
 * backend response tells us which case we're in (see lib/inboxApi.ts's
 * doc comment) rather than the frontend guessing or offering a control
 * that would silently 404.
 */
export default function Inbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [source, setSource] = useState<'gmail' | 'outlook' | 'local'>('local');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = () => {
    getInbox().then(r => { setItems(r.items); setSource(r.source); setLoading(false); });
  };
  useEffect(load, []);

  const toggleRead = async (item: InboxItem) => {
    setError(undefined);
    try {
      await updateInboxItem(item.id, { isRead: !item.isRead });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const unreadCount = items.filter(i => !i.isRead).length;

  return (
    <div style={{ height: '100%', padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <JPanel title="INBOX" icon={<InboxIcon size={13} />} badge={loading ? 'LOADING' : `${unreadCount} UNREAD`}>
        {source !== 'local' && !loading && items.length > 0 && (
          <div style={{ marginBottom: 10, fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-text-faint)' }}>
            Live from {source === 'gmail' ? 'Gmail' : 'Outlook'} — read/unread here reflects your real mailbox but can't be changed from this view yet.
          </div>
        )}
        {error && <div style={{ marginBottom: 8, fontSize: 11, color: '#E77A7A' }}>{error}</div>}

        {loading ? (
          <div className="j-empty">LOADING…</div>
        ) : items.length === 0 ? (
          <div className="j-empty">
            NOTHING HERE — CONNECT GMAIL OR OUTLOOK IN INTEGRATIONS TO SEE YOUR REAL INBOX
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {items.map(item => (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                  background: item.isRead ? 'rgba(0,212,255,0.02)' : 'rgba(0,212,255,0.05)',
                  border: `1px solid ${item.isRead ? 'rgba(0,212,255,0.06)' : 'rgba(0,212,255,0.15)'}`,
                }}
              >
                {source === 'local' ? (
                  <button
                    onClick={() => toggleRead(item)}
                    title={item.isRead ? 'Mark as unread' : 'Mark as read'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: item.isRead ? 'var(--j-text-faint)' : 'var(--j-cyan)', flexShrink: 0, marginTop: 1 }}
                  >
                    {item.isRead ? <MailOpen size={14} /> : <Mail size={14} />}
                  </button>
                ) : (
                  <span style={{ color: item.isRead ? 'var(--j-text-faint)' : 'var(--j-cyan)', flexShrink: 0, marginTop: 1 }}>
                    {item.isRead ? <MailOpen size={14} /> : <Mail size={14} />}
                  </span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, fontWeight: item.isRead ? 400 : 700, color: '#fff', flex: 1 }}>
                      {item.subject}
                    </span>
                    <span className="j-mono" style={{ fontSize: 9, color: 'var(--j-text-faint)' }}>
                      {new Date(item.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 10, color: 'var(--j-text-muted)', marginTop: 2 }}>{item.sender}</div>
                  <div style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'var(--j-text-muted)', marginTop: 4 }}>{item.summary}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <span className="j-badge" style={{ fontSize: 8, color: PRIORITY_COLOR[item.priority] ?? 'var(--j-text-faint)', borderColor: PRIORITY_COLOR[item.priority] ?? 'var(--j-text-faint)' }}>
                      {item.priority.toUpperCase()}
                    </span>
                    <span className="j-badge" style={{ fontSize: 8, color: 'var(--j-text-faint)' }}>{item.source.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </JPanel>
    </div>
  );
}
