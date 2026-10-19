import { useCallback, useEffect, useRef, useState } from 'react';
import { listProcedureDocs, addProcedureDoc, replaceProcedureDoc, updateProcedureDoc, deleteProcedureDoc, type ProcedureDocSummary } from '@/lib/proceduresApi';
import { useUi, Hint, Msg, type Tone } from '@/components/settings/ui';
import { KHAMI_HOME } from '@/lib/where';

/**
 * Build 5: a work area's procedure documents (Workspace > Domains &
 * documents in the Overlay; Skill Sets > Procedure documents in Classic).
 * Read on this computer; skills in this area are checked against them.
 */
const ACCEPT = '.pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.tif,.tiff';

export function ProcedureDocuments({ tone, workDomainId, onChange }: { tone: Tone; workDomainId: number; onChange?: () => void }) {
  const { t, btn } = useUi(tone);
  const [docs, setDocs] = useState<ProcedureDocSummary[] | null>(null);
  const [confidential, setConfidential] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const addInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replacing = useRef<number | null>(null);

  const load = useCallback(() => listProcedureDocs(workDomainId).then(setDocs).catch(() => setDocs([])), [workDomainId]);
  useEffect(() => { void load(); }, [load]);

  const run = async (name: string, fn: () => Promise<string>) => {
    setBusy(name); setMsg(null);
    try { setMsg({ ok: true, text: await fn() }); await load(); onChange?.(); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong' }); }
    setBusy(null);
  };

  const add = (file: File) => run('add', async () => {
    const d = await addProcedureDoc(workDomainId, file, confidential);
    return `Added "${d.name}" - ${d.sections.length} section${d.sections.length === 1 ? '' : 's'} found${d.readBy === 'ocr' ? ' (read from a scan)' : ''}. Skills in this area will be checked against it.`;
  });
  const replace = (id: number, file: File) => run(`replace-${id}`, async () => {
    const d = await replaceProcedureDoc(id, file);
    return `Updated "${d.name}". Skills that follow it are being checked again.`;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, color: t.text }}>
      {docs === null && <Hint tone={tone}>Loading…</Hint>}
      {docs?.length === 0 && <Hint tone={tone}>No procedure documents yet. Add your company's procedures (PDF, Word, a photo of the page, or text) and Khameleon will check skills in this area against them.</Hint>}
      {docs?.map(d => (
        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: t.radius, background: t.card, border: `1px solid ${t.border}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
            <div style={{ fontSize: 10.5, color: t.muted }}>
              {d.sections.length} section{d.sections.length === 1 ? '' : 's'}{d.confidential ? ' · confidential - stays with Khami' : ''}
            </div>
          </div>
          {confirmDelete === d.id ? (
            <>
              <span style={{ fontSize: 11, color: t.warn }}>Remove?</span>
              <button type="button" style={btn()} onClick={() => void run(`del-${d.id}`, async () => { await deleteProcedureDoc(d.id); setConfirmDelete(null); return `Removed "${d.name}".`; })}>Yes</button>
              <button type="button" style={btn()} onClick={() => setConfirmDelete(null)}>No</button>
            </>
          ) : (
            <>
              <button type="button" style={btn(d.confidential)} aria-pressed={d.confidential} title="Confidential documents are only ever read by Khami, on this computer"
                onClick={() => void run(`conf-${d.id}`, async () => { await updateProcedureDoc(d.id, { confidential: !d.confidential }); return d.confidential ? `"${d.name}" is no longer marked confidential.` : `"${d.name}" is marked confidential - only Khami reads it.`; })}>
                {d.confidential ? 'Confidential' : 'Mark confidential'}
              </button>
              <button type="button" style={btn()} disabled={!!busy} onClick={() => { replacing.current = d.id; replaceInput.current?.click(); }}>{busy === `replace-${d.id}` ? 'Reading…' : 'New version'}</button>
              <button type="button" style={btn()} onClick={() => setConfirmDelete(d.id)} aria-label={`Remove ${d.name}`}>Remove</button>
            </>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" style={btn(true)} disabled={!!busy} onClick={() => addInput.current?.click()}>{busy === 'add' ? 'Reading the document…' : 'Add a procedure document'}</button>
        <label style={{ fontSize: 11.5, color: t.muted, display: 'inline-flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={confidential} onChange={e => setConfidential(e.target.checked)} /> Confidential
        </label>
      </div>
      <input ref={addInput} type="file" accept={ACCEPT} hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void add(f); }} />
      <input ref={replaceInput} type="file" accept={ACCEPT} hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f && replacing.current) void replace(replacing.current, f); }} />
      {busy === 'add' && <Hint tone={tone}>Scanned pages take a little longer - they're read {KHAMI_HOME}.</Hint>}
      {msg && <Msg tone={tone} ok={msg.ok}>{msg.text}</Msg>}
    </div>
  );
}
