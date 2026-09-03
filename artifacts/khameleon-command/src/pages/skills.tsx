import { useEffect, useMemo, useState } from 'react';
import { Plus, Zap, Download } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { ConfirmGate } from '@/components/ConfirmGate';
import { WorkDomainFilterBar, useWorkDomains } from '@/components/WorkDomainFilterBar';
import {
  getSkillSets, createSkillSet, confirmSkillSetInstall, uninstallSkillSet,
  type SkillSet, type CreateSkillSetInput, type SkillSetSourceType,
} from '@/lib/skillSetsApi';
import { setEntityWorkDomains } from '@/lib/workDomainsApi';

const STATUS_LABEL: Record<SkillSet['status'], string> = {
  available: 'AVAILABLE',
  pending: 'AWAITING CONFIRMATION',
  installed: 'INSTALLED',
  uninstalled: 'UNINSTALLED',
};
const STATUS_COLOR: Record<SkillSet['status'], string> = {
  available: 'var(--j-text-muted)',
  pending: 'var(--j-amber)',
  installed: 'var(--j-green)',
  uninstalled: 'var(--j-text-faint)',
};

/** Blank authored form. */
const BLANK: CreateSkillSetInput = { name: '', description: '', content: '', sourceType: 'authored', requestedTools: [], requestedIntegrationIds: [] };

export default function Skills() {
  const [skillSets, setSkillSets] = useState<SkillSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [selectedDomain, setSelectedDomain] = useState<number | null>(null);
  const { domains, reload: reloadDomains } = useWorkDomains();

  const [form, setForm] = useState<CreateSkillSetInput>(BLANK);
  const [importMode, setImportMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // A pending Skill Set + the approval it's waiting on - drives the ConfirmGate.
  const [gateFor, setGateFor] = useState<{ skillSet: SkillSet; approvalId: number | null; fullContentGate?: boolean } | null>(null);

  const load = () => { getSkillSets().then(rows => { setSkillSets(rows); setLoading(false); }); };
  useEffect(load, []);

  const filtered = useMemo(
    () => (selectedDomain === null ? skillSets : skillSets.filter(s => s.workDomainIds.includes(selectedDomain)))
      .filter(s => s.status !== 'uninstalled'),
    [skillSets, selectedDomain],
  );

  const doSubmit = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const { skillSet, approvalId } = await createSkillSet(form);
      if (approvalId) {
        // §15.3/§15.5: scope-affecting or externally-sourced - hard gate
        // before it counts as installed. The full content is shown for
        // an external import, never a summary.
        setGateFor({ skillSet, approvalId, fullContentGate: form.sourceType !== 'authored' });
      }
      setForm(BLANK);
      setImportMode(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create skill set');
    } finally {
      setSubmitting(false);
    }
  };

  const doConfirmInstall = async () => {
    if (!gateFor) return;
    try {
      await confirmSkillSetInstall(gateFor.skillSet.id, gateFor.approvalId);
      setGateFor(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm install');
      throw err; // keeps the gate open so the user can retry, matching approvals.tsx's convention
    }
  };

  const doUninstall = async (id: number) => {
    setError(undefined);
    try {
      await uninstallSkillSet(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to uninstall');
    }
  };

  const toggleDomainTag = async (s: SkillSet, domainId: number) => {
    const next = s.workDomainIds.includes(domainId) ? s.workDomainIds.filter(id => id !== domainId) : [...s.workDomainIds, domainId];
    try {
      await setEntityWorkDomains('skill_set', String(s.id), next);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tags');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%', padding: 8 }}>
      {/* ADD / IMPORT */}
      <div style={{ flexShrink: 0 }}>
        <JPanel
          title={importMode ? 'IMPORT SKILL SET' : 'AUTHOR A SKILL SET'}
          icon={importMode ? <Download size={13} /> : <Plus size={13} />}
          action={
            <button
              className="j-btn-ghost"
              style={{ height: 24, padding: '0 8px', fontSize: 9 }}
              onClick={() => {
                // Switching to import mode must set a real non-'authored'
                // sourceType, not just reset to BLANK - the <select> below
                // defaults visually to its first option (GitHub) but that
                // never gets written back into form.sourceType unless the
                // user explicitly touches it, so a submit without touching
                // the dropdown would silently go through as 'authored' and
                // skip the mandatory §15.5 hard gate for external imports.
                const nowImporting = !importMode;
                setImportMode(nowImporting);
                setForm(nowImporting ? { ...BLANK, sourceType: 'github' } : BLANK);
              }}
            >
              {importMode ? 'AUTHOR INSTEAD' : 'IMPORT FROM GITHUB/URL INSTEAD'}
            </button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input className="j-input" placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <input className="j-input" placeholder="One-line description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            {importMode ? (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select className="j-input" style={{ width: 140 }} value={form.sourceType} onChange={e => setForm(f => ({ ...f, sourceType: e.target.value as SkillSetSourceType }))}>
                    <option value="github">GitHub</option>
                    <option value="url">URL</option>
                    <option value="marketplace">Marketplace</option>
                  </select>
                  <input className="j-input" style={{ flex: 1 }} placeholder="Source URL (e.g. github.com/user/repo/path)" value={form.sourceUrl ?? ''} onChange={e => setForm(f => ({ ...f, sourceUrl: e.target.value }))} />
                </div>
                <input className="j-input" placeholder="Author (optional)" value={form.sourceAuthor ?? ''} onChange={e => setForm(f => ({ ...f, sourceAuthor: e.target.value }))} />
              </>
            ) : null}
            <textarea
              className="j-input"
              style={{ height: 90, resize: 'none', fontFamily: 'var(--j-font-mono)', fontSize: 11 }}
              placeholder={importMode ? 'Paste the imported instructions/content here' : 'Instructions the agent should follow for this task pattern…'}
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="j-input"
                style={{ flex: 1 }}
                placeholder="Requested tools, comma-separated (leave blank for instructions-only)"
                value={(form.requestedTools ?? []).join(', ')}
                onChange={e => setForm(f => ({ ...f, requestedTools: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))}
              />
              <button className="j-btn-primary" style={{ height: 34, padding: '0 16px', fontSize: 11 }} onClick={doSubmit} disabled={submitting || !form.name.trim()}>
                {submitting ? '…' : importMode ? 'IMPORT' : 'CREATE'}
              </button>
            </div>
            {!importMode && (
              <div style={{ fontSize: 9, color: 'var(--j-text-faint)' }}>
                No requested tools → installs immediately. Any requested tool → requires your confirmation.
              </div>
            )}
            {importMode && (
              <div style={{ fontSize: 9, color: 'var(--j-text-faint)' }}>
                Imported Skill Sets always require your confirmation, regardless of requested scope (design-spec.md §15.5) — untrusted content can't be pre-verified against what it claims to need.
              </div>
            )}
          </div>
        </JPanel>
      </div>

      {/* CATALOG — .j-panel hardcodes height:100%, so without flexShrink:0
          this panel inflates and starves the scrollable list below to 0
          height (documented gotcha, hit earlier this session). */}
      <div style={{ flexShrink: 0 }}>
        <JPanel title="SKILL SETS" icon={<Zap size={13} />} badge={`${skillSets.filter(s => s.status === 'installed').length} INSTALLED`}>
          <WorkDomainFilterBar domains={domains} selected={selectedDomain} onSelect={setSelectedDomain} onDomainsChanged={reloadDomains} />
        </JPanel>
      </div>

      {error && <div style={{ fontSize: 11, color: '#E77A7A' }}>{error}</div>}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} className="scrollbar-jarvis">
        {loading ? (
          <div className="j-empty">LOADING…</div>
        ) : filtered.length === 0 ? (
          <div className="j-empty">NO SKILL SETS IN THIS DOMAIN</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map(s => (
              <div key={s.id} style={{ padding: '10px 12px', background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, color: '#fff', flex: 1 }}>{s.name}</span>
                  <span className="j-badge" style={{ fontSize: 8, color: STATUS_COLOR[s.status], borderColor: STATUS_COLOR[s.status] }}>{STATUS_LABEL[s.status]}</span>
                  {s.sourceType !== 'authored' && <span className="j-badge j-badge-cyan" style={{ fontSize: 8 }}>{s.sourceType.toUpperCase()}</span>}
                </div>
                <div style={{ fontSize: 10, color: 'var(--j-text-muted)', marginTop: 4 }}>{s.description}</div>
                {(s.requestedTools.length > 0 || s.requestedIntegrationIds.length > 0) && (
                  <div style={{ fontSize: 9, color: 'var(--j-amber)', marginTop: 4, fontFamily: 'var(--j-font-mono)' }}>
                    Requests: {[...s.requestedTools, ...s.requestedIntegrationIds].join(', ')}
                  </div>
                )}
                {domains.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                    {domains.map(d => (
                      <button
                        key={d.id}
                        onClick={() => toggleDomainTag(s, d.id)}
                        className="j-badge"
                        style={{
                          fontSize: 8, cursor: 'pointer', padding: '2px 6px',
                          background: s.workDomainIds.includes(d.id) ? 'rgba(0,212,255,0.12)' : 'transparent',
                          border: `1px solid ${s.workDomainIds.includes(d.id) ? 'var(--j-cyan)' : 'rgba(0,212,255,0.12)'}`,
                          color: s.workDomainIds.includes(d.id) ? 'var(--j-cyan)' : 'var(--j-text-faint)',
                        }}
                      >
                        {d.name}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  {s.status === 'pending' && (
                    <button className="j-btn-primary" style={{ height: 26, padding: '0 10px', fontSize: 9 }} onClick={() => setGateFor({ skillSet: s, approvalId: s.pendingApprovalId, fullContentGate: s.sourceType !== 'authored' })}>
                      REVIEW & CONFIRM
                    </button>
                  )}
                  {s.status === 'installed' && (
                    <button className="j-btn-ghost" style={{ height: 26, padding: '0 10px', fontSize: 9, borderColor: 'rgba(192,21,42,0.3)', color: 'var(--j-red)' }} onClick={() => doUninstall(s.id)}>
                      UNINSTALL
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {gateFor && (
        <ConfirmGate
          title={`Install "${gateFor.skillSet.name}"`}
          category="skill_set_install"
          target={gateFor.skillSet.name}
          scope={JSON.stringify({ tools: gateFor.skillSet.requestedTools, integrations: gateFor.skillSet.requestedIntegrationIds })}
          severity={gateFor.fullContentGate ? 'high' : 'medium'}
          confirmLabel="Confirm & Install"
          warning={gateFor.fullContentGate
            ? `Imported from ${gateFor.skillSet.sourceType}${gateFor.skillSet.sourceUrl ? ` (${gateFor.skillSet.sourceUrl})` : ''}${gateFor.skillSet.sourceAuthor ? ` by ${gateFor.skillSet.sourceAuthor}` : ''}. Review the full content below before installing.`
            : undefined}
          payload={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(gateFor.skillSet.requestedTools.length > 0 || gateFor.skillSet.requestedIntegrationIds.length > 0) && (
                <div><strong>Requested access:</strong> {[...gateFor.skillSet.requestedTools, ...gateFor.skillSet.requestedIntegrationIds].join(', ') || 'none'}</div>
              )}
              <div><strong>Full content:</strong></div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{gateFor.skillSet.content || '(no content)'}</div>
            </div>
          }
          onConfirm={doConfirmInstall}
          onCancel={() => setGateFor(null)}
        />
      )}
    </div>
  );
}
