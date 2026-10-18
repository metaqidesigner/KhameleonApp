import { useCallback, useEffect, useState } from 'react';
import { getVaultItems, createVaultItem, updateVaultItem, deleteVaultItem, type VaultItem } from '@/lib/vaultApi';
import { useUi, Hint, Msg, type Tone } from './ui';

/**
 * Settings > Credentials (gap review Q11): saved logins and secrets, stored
 * encrypted. Adds the missing edit (the server always supported it). Shared
 * by the Overlay's Settings panel and Classic's Vault page.
 */
interface Draft { name: string; category: string; description: string; secretValue: string }
const EMPTY: Draft = { name: '', category: '', description: '', secretValue: '' };

export function CredentialsSettings({ tone }: { tone: Tone }) {
  const { t, input, btn } = useUi(tone);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => getVaultItems().then(setItems), []);
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); await load(); setEditing(null); setDraft(EMPTY); setConfirmDelete(null); setMsg({ ok: true, text: ok }); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong' }); }
    setBusy(false);
  };

  const save = () => {
    if (editing === 'new') {
      return run(() => createVaultItem({ name: draft.name.trim(), category: draft.category.trim() || 'Login', description: draft.description.trim(), secretValue: draft.secretValue }), `Saved "${draft.name.trim()}".`);
    }
    const patch = { name: draft.name.trim(), category: draft.category.trim() || 'Login', description: draft.description.trim(), ...(draft.secretValue ? { secretValue: draft.secretValue } : {}) };
    return run(() => updateVaultItem(editing as number, patch), `Updated "${draft.name.trim()}".`);
  };

  const form = (
    <form style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRadius: t.radius, background: t.card, border: `1px solid ${t.border}` }}
      onSubmit={e => { e.preventDefault(); if (draft.name.trim() && (editing !== 'new' || draft.secretValue)) void save(); }}>
      <input aria-label="Name" placeholder="Name, e.g. Supplier portal" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} style={input} autoFocus />
      <input aria-label="Type" placeholder="Type, e.g. Login" value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} style={input} />
      <input aria-label="Description" placeholder="What it's for (optional)" value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} style={input} />
      <input aria-label="Secret" type="password" autoComplete="new-password" placeholder={editing === 'new' ? 'Password or secret' : 'New password or secret (leave empty to keep the current one)'}
        value={draft.secretValue} onChange={e => setDraft(d => ({ ...d, secretValue: e.target.value }))} style={input} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="submit" style={btn(true)} disabled={busy || !draft.name.trim() || (editing === 'new' && !draft.secretValue)}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" style={btn()} onClick={() => { setEditing(null); setDraft(EMPTY); }}>Cancel</button>
      </div>
    </form>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Hint tone={tone}>Logins and secrets, stored encrypted. Coming next: skills that sign in for you (e.g. to a supplier portal) will use these - always asking you first.</Hint>
      {items.length === 0 && editing !== 'new' && <div style={{ fontSize: 12, color: t.muted }}>Nothing saved yet.</div>}
      {items.map(item => (
        <div key={item.id}>
          {editing === item.id ? form : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: t.radius, background: t.card, border: `1px solid ${t.border}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                <div style={{ fontSize: 11, color: t.muted }}>{item.category}{item.description ? ` · ${item.description}` : ''}</div>
              </div>
              {confirmDelete === item.id ? (
                <>
                  <span style={{ fontSize: 11, color: t.warn }}>Delete?</span>
                  <button type="button" style={btn()} disabled={busy} onClick={() => void run(() => deleteVaultItem(item.id), `Deleted "${item.name}".`)}>Yes</button>
                  <button type="button" style={btn()} onClick={() => setConfirmDelete(null)}>No</button>
                </>
              ) : (
                <>
                  <button type="button" style={btn()} onClick={() => { setEditing(item.id); setDraft({ name: item.name, category: item.category, description: item.description ?? '', secretValue: '' }); setMsg(null); }}>Edit</button>
                  <button type="button" style={btn()} onClick={() => setConfirmDelete(item.id)}>Delete</button>
                </>
              )}
            </div>
          )}
        </div>
      ))}
      {editing === 'new' ? form : <div><button type="button" style={btn(true)} onClick={() => { setEditing('new'); setDraft(EMPTY); setMsg(null); }}>Add a login or secret</button></div>}
      {msg && <Msg tone={tone} ok={msg.ok}>{msg.text}</Msg>}
    </div>
  );
}
