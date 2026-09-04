import { useEffect, useState } from 'react';
import { Lock, Plus, Eye, EyeOff, Trash2, History, ShieldOff } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { getOnboardingStatus } from '@/lib/jarvisApi';
import {
  getVaultItems, createVaultItem, revealVaultItem, deleteVaultItem, getVaultAccessLog,
  type VaultItem, type VaultAccessLogEntry, type CreateVaultItemInput,
} from '@/lib/vaultApi';

const BLANK: CreateVaultItemInput = { name: '', category: '', permissionLevel: 'read', owner: '', description: '', secretValue: '' };

export default function Vault() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [encryptionConfigured, setEncryptionConfigured] = useState<boolean | null>(null);

  const [form, setForm] = useState<CreateVaultItemInput>(BLANK);
  const [submitting, setSubmitting] = useState(false);

  // Per-item UI state: revealed value (cleared on hide, never cached beyond that),
  // the second click a delete needs, and an expanded access log.
  const [revealed, setRevealed] = useState<Record<number, string>>({});
  const [revealing, setRevealing] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [logFor, setLogFor] = useState<number | null>(null);
  const [logEntries, setLogEntries] = useState<VaultAccessLogEntry[]>([]);

  const load = () => { getVaultItems().then(rows => { setItems(rows); setLoading(false); }); };
  useEffect(() => {
    load();
    getOnboardingStatus().then(s => setEncryptionConfigured(s.encryptionConfigured));
  }, []);

  const doSubmit = async () => {
    if (!form.name.trim() || !form.category.trim() || !form.secretValue.trim()) return;
    setSubmitting(true);
    setError(undefined);
    try {
      await createVaultItem(form);
      setForm(BLANK);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save secret');
    } finally {
      setSubmitting(false);
    }
  };

  const doReveal = async (id: number) => {
    if (revealed[id] !== undefined) {
      // Hide - don't keep the decrypted value around once the user is done with it.
      setRevealed(r => { const next = { ...r }; delete next[id]; return next; });
      return;
    }
    setRevealing(id);
    setError(undefined);
    try {
      const { value } = await revealVaultItem(id);
      setRevealed(r => ({ ...r, [id]: value }));
      load(); // lastAccessed just changed server-side
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reveal secret');
    } finally {
      setRevealing(null);
    }
  };

  const doDelete = async (id: number) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    setError(undefined);
    try {
      await deleteVaultItem(id);
      setConfirmDelete(null);
      setRevealed(r => { const next = { ...r }; delete next[id]; return next; });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete secret');
    }
  };

  const toggleLog = async (id: number) => {
    if (logFor === id) { setLogFor(null); return; }
    setLogFor(id);
    setLogEntries(await getVaultAccessLog(id));
  };

  if (encryptionConfigured === false) {
    return (
      <div style={{ height: '100%', padding: 8 }}>
        <JPanel title="SECURE VAULT" icon={<Lock size={13} />}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: 16, textAlign: 'center' }}>
            <ShieldOff size={48} color="var(--j-amber)" />
            <div style={{ fontFamily: 'var(--j-font-head)', fontSize: 16, fontWeight: 700, color: 'var(--j-amber)', letterSpacing: '0.08em' }}>
              ENCRYPTION NOT CONFIGURED
            </div>
            <div style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, color: 'var(--j-text-muted)', maxWidth: 420 }}>
              KHAMELEON_ENCRYPTION_KEY isn't set on the server, so secrets can't be encrypted at rest. Saving is refused rather than storing them as plaintext — set that environment variable and reload this page.
            </div>
          </div>
        </JPanel>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%', padding: 8 }}>
      {/* ADD SECRET — .j-panel hardcodes height:100%, so without flexShrink:0
          this panel inflates and starves the scrollable list below to 0
          height (documented gotcha, hit earlier this session). */}
      <div style={{ flexShrink: 0 }}>
        <JPanel title="ADD A SECRET" icon={<Plus size={13} />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="j-input" style={{ flex: 1 }} placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <input className="j-input" style={{ width: 160 }} placeholder="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
              <select className="j-input" style={{ width: 140 }} value={form.permissionLevel} onChange={e => setForm(f => ({ ...f, permissionLevel: e.target.value }))}>
                <option value="read">Read</option>
                <option value="read-write">Read-write</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <input className="j-input" placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="password"
                className="j-input"
                style={{ flex: 1 }}
                placeholder="Secret value"
                value={form.secretValue}
                onChange={e => setForm(f => ({ ...f, secretValue: e.target.value }))}
              />
              <button
                className="j-btn-primary"
                style={{ height: 34, padding: '0 16px', fontSize: 11 }}
                onClick={doSubmit}
                disabled={submitting || !form.name.trim() || !form.category.trim() || !form.secretValue.trim()}
              >
                {submitting ? '…' : 'SAVE'}
              </button>
            </div>
            <div style={{ fontSize: 9, color: 'var(--j-text-faint)' }}>
              Encrypted at rest (AES-256-GCM). Every save, reveal, and delete is recorded in that item's access log below.
            </div>
          </div>
        </JPanel>
      </div>

      <div style={{ flexShrink: 0 }}>
        <JPanel title="SECURE VAULT" icon={<Lock size={13} />} badge={`${items.length} ITEM${items.length === 1 ? '' : 'S'}`}>{null}</JPanel>
      </div>

      {error && <div style={{ fontSize: 11, color: '#E77A7A' }}>{error}</div>}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} className="scrollbar-jarvis">
        {loading ? (
          <div className="j-empty">LOADING…</div>
        ) : items.length === 0 ? (
          <div className="j-empty">NO SECRETS STORED YET</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map(item => (
              <div key={item.id} style={{ padding: '10px 12px', background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, color: '#fff', flex: 1 }}>{item.name}</span>
                  <span className="j-badge" style={{ fontSize: 8 }}>{item.category.toUpperCase()}</span>
                  <span className="j-badge j-badge-cyan" style={{ fontSize: 8 }}>{item.permissionLevel.toUpperCase()}</span>
                </div>
                {item.description && <div style={{ fontSize: 10, color: 'var(--j-text-muted)', marginTop: 4 }}>{item.description}</div>}
                <div style={{ fontSize: 9, color: 'var(--j-text-faint)', marginTop: 4, fontFamily: 'var(--j-font-mono)' }}>
                  Last accessed: {item.lastAccessed || 'never'}
                </div>

                {revealed[item.id] !== undefined && (
                  <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--j-cyan)', fontFamily: 'var(--j-font-mono)', fontSize: 12, color: 'var(--j-cyan)', wordBreak: 'break-all' }}>
                    {revealed[item.id]}
                  </div>
                )}

                {logFor === item.id && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {logEntries.length === 0 ? (
                      <div style={{ fontSize: 9, color: 'var(--j-text-faint)' }}>No access history.</div>
                    ) : logEntries.map(e => (
                      <div key={e.id} style={{ fontSize: 9, color: 'var(--j-text-faint)', fontFamily: 'var(--j-font-mono)' }}>
                        {e.action.toUpperCase()} — {new Date(e.createdAt).toLocaleString()}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button className="j-btn-ghost" style={{ height: 26, padding: '0 10px', fontSize: 9, display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => doReveal(item.id)} disabled={revealing === item.id}>
                    {revealed[item.id] !== undefined ? <EyeOff size={11} /> : <Eye size={11} />}
                    {revealing === item.id ? '…' : revealed[item.id] !== undefined ? 'HIDE' : 'REVEAL'}
                  </button>
                  <button className="j-btn-ghost" style={{ height: 26, padding: '0 10px', fontSize: 9, display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => toggleLog(item.id)}>
                    <History size={11} /> {logFor === item.id ? 'HIDE LOG' : 'ACCESS LOG'}
                  </button>
                  <button
                    className="j-btn-ghost"
                    style={{ height: 26, padding: '0 10px', fontSize: 9, display: 'flex', alignItems: 'center', gap: 4, borderColor: 'rgba(192,21,42,0.3)', color: 'var(--j-red)' }}
                    onClick={() => doDelete(item.id)}
                  >
                    <Trash2 size={11} /> {confirmDelete === item.id ? 'CONFIRM DELETE' : 'DELETE'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
