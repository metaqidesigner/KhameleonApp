import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import {
  getWorkDomains, createWorkDomain, renameWorkDomain, deleteWorkDomain,
  type WorkDomain,
} from '@/lib/workDomainsApi';

/**
 * design-spec.md §17 Work Domains — a shared filter/organizing layer for
 * both Skill Sets and Integrations. Deliberately not a mode switch
 * (§17.3): selecting a domain here only narrows the list below, it
 * never changes which agent or persona is active.
 */
export function useWorkDomains() {
  const [domains, setDomains] = useState<WorkDomain[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => { getWorkDomains().then(d => { setDomains(d); setLoading(false); }); };
  useEffect(reload, []);

  return { domains, loading, reload };
}

export function WorkDomainFilterBar({
  domains, selected, onSelect, onDomainsChanged,
}: {
  domains: WorkDomain[];
  selected: number | null;
  onSelect: (id: number | null) => void;
  onDomainsChanged: () => void;
}) {
  const [managing, setManaging] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string>();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  const doCreate = async () => {
    if (!newName.trim()) return;
    setError(undefined);
    try {
      await createWorkDomain(newName.trim());
      setNewName('');
      onDomainsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create domain');
    }
  };

  const doRename = async (id: number) => {
    if (!editingName.trim()) return;
    setError(undefined);
    try {
      await renameWorkDomain(id, editingName.trim());
      setEditingId(null);
      onDomainsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename domain');
    }
  };

  const doDelete = async (id: number) => {
    setError(undefined);
    try {
      await deleteWorkDomain(id);
      if (selected === id) onSelect(null);
      onDomainsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete domain');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => onSelect(null)}
          className="j-badge"
          style={{
            cursor: 'pointer', fontSize: 10, padding: '4px 10px',
            background: selected === null ? 'rgba(0,212,255,0.12)' : 'transparent',
            border: `1px solid ${selected === null ? 'var(--j-cyan)' : 'rgba(0,212,255,0.15)'}`,
            color: selected === null ? 'var(--j-cyan)' : 'var(--j-text-muted)',
          }}
        >
          ALL
        </button>
        {domains.map(d => (
          <button
            key={d.id}
            onClick={() => onSelect(d.id)}
            title={d.description}
            className="j-badge"
            style={{
              cursor: 'pointer', fontSize: 10, padding: '4px 10px',
              background: selected === d.id ? 'rgba(0,212,255,0.12)' : 'transparent',
              border: `1px solid ${selected === d.id ? 'var(--j-cyan)' : 'rgba(0,212,255,0.15)'}`,
              color: selected === d.id ? 'var(--j-cyan)' : 'var(--j-text-muted)',
            }}
          >
            {d.name}
          </button>
        ))}
        <button
          onClick={() => setManaging(m => !m)}
          className="j-btn-ghost"
          style={{ height: 24, padding: '0 8px', fontSize: 9 }}
        >
          {managing ? <X size={10} /> : <Pencil size={10} />} {managing ? 'DONE' : 'MANAGE DOMAINS'}
        </button>
      </div>

      {managing && (
        <div style={{ padding: '8px 10px', background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.1)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {domains.map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {editingId === d.id ? (
                <>
                  <input className="j-input" style={{ height: 26, fontSize: 11, flex: 1 }} value={editingName} onChange={e => setEditingName(e.target.value)} onKeyDown={e => e.key === 'Enter' && doRename(d.id)} autoFocus />
                  <button className="j-btn-ghost" style={{ height: 26, padding: '0 8px', fontSize: 9 }} onClick={() => doRename(d.id)}>SAVE</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'var(--j-text)' }}>
                    {d.name} {d.isBuiltIn && <span style={{ color: 'var(--j-text-faint)', fontSize: 9 }}>(built-in)</span>}
                  </span>
                  <button className="j-btn-ghost" style={{ height: 24, width: 24, padding: 0 }} onClick={() => { setEditingId(d.id); setEditingName(d.name); }}><Pencil size={10} /></button>
                  <button className="j-btn-ghost" style={{ height: 24, width: 24, padding: 0, borderColor: 'rgba(192,21,42,0.3)', color: 'var(--j-red)' }} onClick={() => doDelete(d.id)}><Trash2 size={10} /></button>
                </>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <input className="j-input" style={{ height: 28, fontSize: 11, flex: 1 }} placeholder="New domain name…" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && doCreate()} />
            <button className="j-btn-ghost" style={{ height: 28, padding: '0 10px', fontSize: 9 }} onClick={doCreate}><Plus size={10} /> ADD</button>
          </div>
          {error && <div style={{ fontSize: 10, color: '#E77A7A' }}>{error}</div>}
        </div>
      )}
    </div>
  );
}
