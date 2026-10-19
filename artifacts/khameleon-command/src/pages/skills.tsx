import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Zap, Download } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { WorkDomainFilterBar, useWorkDomains } from '@/components/WorkDomainFilterBar';
import { type SkillSet, type CreateSkillSetInput, type SkillSetSourceType } from '@/lib/skillSetsApi';
import { useSkillLibrary, SkillConfirmGate } from '@/components/skills/useSkillLibrary';
import { GetSkills } from '@/components/skills/GetSkills';
import { SkillGuide } from '@/components/skills/SkillGuide';
import { CaptureBar, useCaptureTask, type CaptureDraft } from '@/components/skills/CaptureTask';
import { CheckBadge, CheckDetails, useProcedureChecks } from '@/components/procedures/ProcedureCheckView';
import { FromDocument, type DocumentDraft } from '@/components/procedures/FromDocument';
import { ProcedureDocuments } from '@/components/procedures/ProcedureDocuments';
import { SkillLoginPicker } from '@/components/skills/SkillLoginPicker';
import { ReplaySkill } from '@/components/skills/ReplaySkill';
import { useJarvisStore } from '@/store/jarvisStore';

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
  // Same logic as the Overlay's Skills panel (components/skills/useSkillLibrary).
  const lib = useSkillLibrary();
  const skillSets = lib.skills;
  const loading = lib.loading;
  const error = lib.error ?? undefined;
  const [selectedDomain, setSelectedDomain] = useState<number | null>(null);
  const { domains, reload: reloadDomains } = useWorkDomains();
  const requestChatTool = useJarvisStore(s => s.requestChatTool);

  const [form, setForm] = useState<CreateSkillSetInput>(BLANK);
  const [importMode, setImportMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [guiding, setGuiding] = useState(false);
  const [captureDraft, setCaptureDraft] = useState<CaptureDraft | null>(null);
  // Build 5 - same pieces as the Overlay (components/procedures).
  const { checks, reload: reloadChecks } = useProcedureChecks();
  const [openCheck, setOpenCheck] = useState<number | null>(null);
  const [fromDoc, setFromDoc] = useState(false);
  const [docDraft, setDocDraft] = useState<DocumentDraft | null>(null);
  const [docsDomain, setDocsDomain] = useState<number | null>(null);
  const capture = useCaptureTask(useCallback((d: CaptureDraft) => { setCaptureDraft(d); setGuiding(true); }, []));
  // Build 6: opened from a detection offer ("Capture it") - see AppShell.
  useEffect(() => {
    const w = window as unknown as { __khameleonCaptureRequested?: boolean };
    if (w.__khameleonCaptureRequested && capture.available) { w.__khameleonCaptureRequested = false; capture.open(); }
  }, [capture.available, capture.open]);
  const [editDraft, setEditDraft] = useState('');

  const filtered = useMemo(
    () => (selectedDomain === null ? skillSets : skillSets.filter(s => s.workDomainIds.includes(selectedDomain)))
      .filter(s => s.status !== 'uninstalled'),
    [skillSets, selectedDomain],
  );

  const doSubmit = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    await lib.create(form);
    setForm(BLANK);
    setImportMode(false);
    setSubmitting(false);
  };

  return (
    // The whole page scrolls; the skill list keeps a usable height however many panels sit above it.
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%', padding: 8, overflowY: 'auto' }} className="scrollbar-jarvis">
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
              {importMode ? 'AUTHOR INSTEAD' : 'PASTE ONE FROM ELSEWHERE INSTEAD'}
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

      {/* GUIDED - same skill maker as the Overlay's Skills panel (components/skills/SkillGuide). */}
      <div style={{ flexShrink: 0 }}>
        <JPanel title="MAKE YOUR OWN SKILL" icon={<Plus size={13} />}
          action={<div style={{ display: 'flex', gap: 6 }}>
            {capture.available && !guiding && <button className="j-btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 9 }} onClick={capture.open}>CAPTURE A TASK</button>}
            {!guiding && <button className="j-btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 9 }} onClick={() => { setGuiding(true); setFromDoc(true); setDocDraft(null); setCaptureDraft(null); }}>FROM A COMPANY DOCUMENT</button>}
            <button className="j-btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 9 }} onClick={() => { setGuiding(g => !g); setCaptureDraft(null); setFromDoc(false); setDocDraft(null); }}>{guiding ? 'CLOSE' : 'START GUIDE'}</button>
          </div>}>
          {guiding && fromDoc && !docDraft
            ? <FromDocument tone="classic" onDraft={setDocDraft} onCancel={() => { setFromDoc(false); setGuiding(false); }} />
            : guiding
            ? <SkillGuide key={docDraft ? `doc-${docDraft.sourceSectionId}-${docDraft.name}` : captureDraft ? `draft-${captureDraft.name}` : 'new'} tone="classic" initial={docDraft ?? captureDraft ?? undefined}
                onCancel={() => { setGuiding(false); setCaptureDraft(null); setFromDoc(false); setDocDraft(null); }}
                onSave={async input => { await lib.create(input); setGuiding(false); setCaptureDraft(null); setFromDoc(false); setDocDraft(null); setTimeout(() => void reloadChecks(), 4000); }} />
            : <div style={{ fontSize: 11, color: 'var(--j-text-muted)' }}>
                A step-by-step guide: name it, write or draft the steps, check Khameleon would use it, save.
                {capture.available && ' Or capture a task: do it once while Khameleon notes the steps, and it writes the skill up for you.'}
              </div>}
          <CaptureBar capture={capture} tone="classic" onDescribeInstead={() => { setCaptureDraft(null); setGuiding(true); }} />
        </JPanel>
      </div>

      {/* PROCEDURE DOCUMENTS - same as the Overlay's Workspace > Domains & documents (Build 5). */}
      <div style={{ flexShrink: 0 }}>
        <JPanel title="PROCEDURE DOCUMENTS" icon={<Zap size={13} />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--j-text-muted)' }}>Your company's procedures, held in each work area. Skills in that area are checked against them step by step.</div>
            <select className="j-input" aria-label="Work area" value={docsDomain ?? ''} onChange={e => setDocsDomain(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Choose a work area…</option>
              {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {docsDomain !== null && <ProcedureDocuments key={docsDomain} tone="classic" workDomainId={docsDomain} onChange={() => setTimeout(() => void reloadChecks(), 4000)} />}
          </div>
        </JPanel>
      </div>

      {/* GET SKILLS - same module as the Overlay's Skills panel (components/skills/GetSkills). */}
      <div style={{ flexShrink: 0 }}>
        <JPanel title="GET SKILLS FROM GITHUB" icon={<Download size={13} />}>
          <div style={{ maxHeight: 360, overflowY: 'auto' }} className="scrollbar-jarvis">
            <GetSkills tone="classic" onInstall={lib.installFromGithub} />
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

      <div style={{ flex: 1, minHeight: 420, overflowY: 'auto' }} className="scrollbar-jarvis">
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
                  {s.status !== 'available' && <CheckBadge tone="classic" check={checks[s.id]} open={openCheck === s.id} onClick={() => setOpenCheck(o => (o === s.id ? null : s.id))} />}
                </div>
                {openCheck === s.id && checks[s.id] && (
                  <div style={{ marginTop: 8 }}><CheckDetails tone="classic" skillId={s.id} check={checks[s.id]} onRechecked={() => void reloadChecks()} /></div>
                )}
                <div style={{ fontSize: 10, color: 'var(--j-text-muted)', marginTop: 4 }}>{s.description}</div>
                {s.status === 'installed' && <div style={{ marginTop: 6 }}><SkillLoginPicker tone="classic" skillId={s.id} value={s.loginVaultItemId} /></div>}
                {s.status === 'installed' && Array.isArray(s.recording) && s.recording.length > 0 && <div style={{ marginTop: 6 }}><ReplaySkill tone="classic" skillId={s.id} steps={s.recording.length} /></div>}
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
                        onClick={() => void lib.toggleDomain(s, d.id)}
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
                {editingId === s.id && (
                  <textarea className="j-input" aria-label={`Steps for ${s.name}`} value={editDraft} onChange={e => setEditDraft(e.target.value)}
                    style={{ marginTop: 8, height: 120, resize: 'vertical', fontFamily: 'var(--j-font-mono)', fontSize: 11 }} />
                )}
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  {s.status === 'available' && (
                    <button className="j-btn-primary" style={{ height: 26, padding: '0 10px', fontSize: 9 }} onClick={() => void lib.install(s)}>
                      INSTALL
                    </button>
                  )}
                  {s.status === 'pending' && (
                    <button className="j-btn-primary" style={{ height: 26, padding: '0 10px', fontSize: 9 }} onClick={() => lib.reviewPending(s)}>
                      REVIEW & CONFIRM
                    </button>
                  )}
                  {s.status === 'installed' && editingId !== s.id && (
                    <>
                      <button className="j-btn-primary" style={{ height: 26, padding: '0 10px', fontSize: 9 }}
                        onClick={() => requestChatTool('run-skill', { skill: { name: s.name, content: s.content } })}>
                        RUN IN CHAT
                      </button>
                      <button className="j-btn-ghost" style={{ height: 26, padding: '0 10px', fontSize: 9 }} onClick={() => { setEditingId(s.id); setEditDraft(s.content); }}>
                        EDIT STEPS
                      </button>
                      <button className="j-btn-ghost" style={{ height: 26, padding: '0 10px', fontSize: 9, borderColor: 'rgba(192,21,42,0.3)', color: 'var(--j-red)' }} onClick={() => void lib.remove(s)}>
                        UNINSTALL
                      </button>
                    </>
                  )}
                  {editingId === s.id && (
                    <>
                      <button className="j-btn-primary" style={{ height: 26, padding: '0 10px', fontSize: 9 }} disabled={editDraft === s.content}
                        onClick={() => { void lib.saveSteps(s, editDraft); setEditingId(null); }}>
                        SAVE
                      </button>
                      <button className="j-btn-ghost" style={{ height: 26, padding: '0 10px', fontSize: 9 }} onClick={() => setEditingId(null)}>
                        CANCEL
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {lib.gate && <SkillConfirmGate gate={lib.gate} onConfirm={lib.confirmGate} onCancel={lib.cancelGate} />}
    </div>
  );
}
