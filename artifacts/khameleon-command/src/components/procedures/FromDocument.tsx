import { useEffect, useState } from 'react';
import { listProcedureDocs, draftSkillFromDocument, type ProcedureDocSummary } from '@/lib/proceduresApi';
import { useUi, Hint, Msg, type Tone } from '@/components/settings/ui';

/**
 * Build 5 addendum - a skill "From a company document": pick a procedure
 * document and the section, Khami drafts the skill (each step noting its
 * source), and the guide opens with the draft to check and save. The saved
 * skill stays linked to that section.
 */
export interface DocumentDraft { name: string; description: string; steps: string; source: string; sourceDocumentId: number; sourceSectionId: string }

export function FromDocument({ tone, onDraft, onCancel }: { tone: Tone; onDraft: (d: DocumentDraft) => void; onCancel: () => void }) {
  const { t, btn, input } = useUi(tone);
  const [docs, setDocs] = useState<ProcedureDocSummary[] | null>(null);
  const [docId, setDocId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { listProcedureDocs().then(d => { setDocs(d); if (d[0]) setDocId(d[0].id); }).catch(() => setDocs([])); }, []);
  const doc = docs?.find(d => d.id === docId);

  const draft = async () => {
    if (!docId || !sectionId) return;
    setBusy(true); setError(null);
    try {
      const d = await draftSkillFromDocument(docId, sectionId);
      onDraft({
        name: d.name, description: d.description, steps: d.steps, sourceDocumentId: d.documentId, sourceSectionId: d.sectionId,
        source: `Drafted by ${d.by} from "${d.documentName}" - ${d.sectionHeading}.`,
      });
    } catch (e) { setError(e instanceof Error ? e.message : 'Couldn\'t draft the skill'); }
    setBusy(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: t.radius, background: t.card, border: `1px solid ${t.border}`, color: t.text }}>
      <div style={{ fontSize: 12.5, fontWeight: 600 }}>From a company document</div>
      {docs?.length === 0 && <Hint tone={tone}>Add a procedure document first (Workspace → Domains &amp; documents).</Hint>}
      {docs && docs.length > 0 && (
        <>
          <select aria-label="Document" value={docId ?? ''} onChange={e => { setDocId(Number(e.target.value)); setSectionId(null); }} style={input}>
            {docs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Hint tone={tone}>Which procedure should the skill follow?</Hint>
          <div role="radiogroup" aria-label="Section" style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
            {doc?.sections.map(s => (
              <button key={s.id} type="button" role="radio" aria-checked={sectionId === s.id} onClick={() => setSectionId(s.id)}
                style={{ ...btn(sectionId === s.id), textAlign: 'left' }}>
                {s.id !== 'all' && !s.id.startsWith('s') ? `${s.id} ` : ''}{s.heading}
              </button>
            ))}
          </div>
          {doc?.confidential && <Hint tone={tone}>This document is confidential - Khami drafts it on this computer.</Hint>}
        </>
      )}
      {error && <Msg tone={tone} ok={false}>{error}</Msg>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" style={btn(true)} disabled={busy || !sectionId} onClick={() => void draft()}>{busy ? 'Khami is drafting… (about a minute)' : 'Draft the skill'}</button>
        <button type="button" style={btn()} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
