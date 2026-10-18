import { useEffect, useState } from 'react';
import { getWorkDomains, type WorkDomain } from '@/lib/workDomainsApi';
import type { CreateSkillSetInput } from '@/lib/skillSetsApi';

/**
 * Guided "make your own skill" (Build 3 follow-up): five short steps with
 * tips, AI help to draft the steps (Khami first), and a check that a typical
 * request would actually pick the skill. Shared by the Overlay's Skills
 * panel and Classic's Skill Sets page.
 */
type Tone = 'overlay' | 'classic';

const TONES: Record<Tone, { text: string; muted: string; card: string; border: string; accent: string; good: string; warn: string; bad: string; input: string; radius: number }> = {
  overlay: { text: '#d6efee', muted: '#8fb4b6', card: 'rgba(255,255,255,0.035)', border: 'rgba(255,255,255,0.12)', accent: '#6FE6BD', good: '#6FE6BD', warn: '#ffb36b', bad: '#ff9b9b', input: 'rgba(0,0,0,0.25)', radius: 10 },
  classic: { text: 'var(--j-text)', muted: 'var(--j-text-muted)', card: 'rgba(0,212,255,0.03)', border: 'rgba(0,212,255,0.15)', accent: 'var(--j-cyan)', good: 'var(--j-green)', warn: 'var(--j-amber)', bad: 'var(--j-red)', input: 'rgba(0,4,8,0.6)', radius: 2 },
};

const BASE = import.meta.env.VITE_API_URL || '/api';
async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const b = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(b.error ?? `Request failed (HTTP ${res.status})`);
  }
  return res.json();
}

const STEPS = ['What it is', 'The steps', 'The result', 'Try it', 'Save'] as const;

export function SkillGuide({ tone, onSave, onCancel, initial }: {
  tone: Tone;
  onSave: (input: CreateSkillSetInput) => Promise<void>;
  onCancel: () => void;
  /** A draft to start from - e.g. one written up from a Capture recording. */
  initial?: { name: string; description: string; steps: string; source?: string };
}) {
  const t = TONES[tone];
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [task, setTask] = useState('');
  const [steps, setSteps] = useState(initial?.steps ?? '');
  const [result, setResult] = useState('');
  const [tryRequest, setTryRequest] = useState('');
  const [match, setMatch] = useState<{ picked: string | null; isThisSkill: boolean; suggestWords: string[] } | null>(null);
  const [domains, setDomains] = useState<WorkDomain[]>([]);
  const [domainIds, setDomainIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { getWorkDomains().then(setDomains).catch(() => {}); }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
    setBusy(false);
  };

  const draft = () => run(async () => {
    const r = await post<{ steps: string; by: string }>('/skill-sets/guide/draft-steps', { name, description, task, result });
    setSteps(r.steps);
    setNote(`Drafted by ${r.by === 'KHAMI' ? 'Khami' : r.by}. Read them through and change anything that isn't right.`);
  });

  const test = () => run(async () => {
    setMatch(await post('/skill-sets/guide/test-match', { name, description, request: tryRequest }));
  });

  const content = () => [
    `When asked for ${name.trim().replace(/^\w/, c => c.toLowerCase())}:`,
    steps.trim(),
    result.trim() ? `\nThe finished result should look like this: ${result.trim()}` : '',
    'If something you need is missing, ask for it instead of guessing.',
  ].filter(Boolean).join('\n');

  const canNext = [name.trim() && description.trim(), steps.trim(), true, true, true][step];

  const input: React.CSSProperties = { width: '100%', padding: '7px 9px', borderRadius: t.radius, fontSize: 12.5, fontFamily: 'inherit', background: t.input, border: `1px solid ${t.border}`, color: t.text };
  const btn = (primary?: boolean): React.CSSProperties => ({
    padding: '6px 12px', borderRadius: t.radius, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
    background: primary ? 'rgba(111,230,189,0.14)' : 'transparent', border: `1px solid ${primary ? t.accent : t.border}`, color: t.text,
  });
  const tip = (text: string) => <div style={{ fontSize: 11, color: t.muted, lineHeight: 1.45 }}>{text}</div>;
  const label = (text: string) => <div style={{ fontSize: 12, fontWeight: 600 }}>{text}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, color: t.text, padding: 10, borderRadius: t.radius, background: t.card, border: `1px solid ${t.border}` }}>
      <div style={{ display: 'flex', gap: 4 }} aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1 }}>
            <div style={{ height: 3, borderRadius: 2, background: i <= step ? t.accent : t.border }} />
            <div style={{ fontSize: 9.5, color: i === step ? t.text : t.muted, marginTop: 3 }}>{s}</div>
          </div>
        ))}
      </div>

      {step === 0 && (
        <>
          {initial?.source && <div style={{ fontSize: 11.5, color: t.good }}>{initial.source} Check each step - anything marked "(check this)" wasn't clear from the recording.</div>}
          {label('Name your skill')}
          <input aria-label="Skill name" placeholder="e.g. Supplier statement reconciliation" value={name} onChange={e => setName(e.target.value)} style={input} />
          {label('What is it for, and when should it be used?')}
          <textarea aria-label="What the skill is for" rows={3} value={description} onChange={e => setDescription(e.target.value)} style={{ ...input, resize: 'vertical' }}
            placeholder="e.g. Matches a supplier statement against our ledger and lists the differences. Use when reconciling supplier accounts." />
          {tip('Khameleon picks skills by the words in the name and this description - so use the words people actually say when they need it (e.g. "supplier", "statement", "reconcile").')}
        </>
      )}

      {step === 1 && (
        <>
          {label('Describe the task in your own words')}
          <textarea aria-label="Describe the task" rows={3} value={task} onChange={e => setTask(e.target.value)} style={{ ...input, resize: 'vertical' }}
            placeholder="e.g. I export the statement from the portal, compare each invoice to our ledger, and list anything missing or different." />
          <div><button type="button" style={btn()} disabled={busy || !task.trim()} onClick={() => void draft()}>{busy ? 'Drafting…' : 'Draft the steps for me'}</button></div>
          {label('The steps')}
          <textarea aria-label="Skill steps" rows={8} value={steps} onChange={e => setSteps(e.target.value)} style={{ ...input, resize: 'vertical', lineHeight: 1.45 }}
            placeholder={'1. Ask for the supplier statement and the ledger export.\n2. Match each line by invoice number.\n3. ...'} />
          {note && <div style={{ fontSize: 11, color: t.good }}>{note}</div>}
          {tip('Write numbered steps someone new could follow. Say why a step matters when it isn\'t obvious - it helps the skill cope with unusual cases.')}
        </>
      )}

      {step === 2 && (
        <>
          {label('What should the finished result look like? (optional)')}
          <textarea aria-label="What the result looks like" rows={3} value={result} onChange={e => setResult(e.target.value)} style={{ ...input, resize: 'vertical' }}
            placeholder="e.g. A table of differences (invoice, our amount, their amount, difference), then a one-line total." />
          {tip('Being specific here gives you consistent results every time the skill runs.')}
        </>
      )}

      {step === 3 && (
        <>
          {label('Type a request the way someone would ask')}
          <div style={{ display: 'flex', gap: 6 }}>
            <input aria-label="Example request" placeholder="e.g. Reconcile the Acme statement for September" value={tryRequest} onChange={e => setTryRequest(e.target.value)} style={input} />
            <button type="button" style={btn(true)} disabled={busy || !tryRequest.trim()} onClick={() => void test()}>Try</button>
          </div>
          {match?.isThisSkill && <div style={{ fontSize: 12, color: t.good }}>Khameleon would use your skill for this request.</div>}
          {match && !match.isThisSkill && (
            <div style={{ fontSize: 12, color: t.warn, lineHeight: 1.45 }}>
              {match.picked ? `Khameleon would use "${match.picked}" instead.` : 'Khameleon wouldn\'t use any skill for this request.'}
              {match.suggestWords.length > 0 && <> Try adding these words to the description: <strong>{match.suggestWords.join(', ')}</strong>.</>}
              {' '}<button type="button" style={{ ...btn(), padding: '2px 8px', fontSize: 11 }} onClick={() => setStep(0)}>Edit description</button>
            </div>
          )}
          {tip('Try two or three different ways of asking. You can skip this step.')}
        </>
      )}

      {step === 4 && (
        <>
          {label('Which area of work is it for?')}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {domains.map(d => {
              const on = domainIds.includes(d.id);
              return (
                <button key={d.id} type="button" aria-pressed={on} onClick={() => setDomainIds(ids => (on ? ids.filter(x => x !== d.id) : [...ids, d.id]))}
                  style={{ ...btn(on), padding: '4px 10px', fontSize: 11, color: on ? t.accent : t.muted }}>
                  {d.name}
                </button>
              );
            })}
          </div>
          {label('Your skill')}
          <div style={{ fontSize: 11.5, whiteSpace: 'pre-wrap', lineHeight: 1.45, padding: '8px 9px', borderRadius: t.radius, background: t.input, maxHeight: 200, overflowY: 'auto' }}>
            <strong>{name}</strong>{'\n'}{description}{'\n\n'}{content()}
          </div>
        </>
      )}

      {error && <div role="alert" style={{ fontSize: 12, color: t.bad }}>{error}</div>}

      <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
        <button type="button" style={btn()} onClick={step === 0 ? onCancel : () => setStep(s => s - 1)}>{step === 0 ? 'Cancel' : 'Back'}</button>
        {step < STEPS.length - 1
          ? <button type="button" style={btn(true)} disabled={!canNext} onClick={() => setStep(s => s + 1)}>{step === 3 ? 'Next (or skip)' : 'Next'}</button>
          : <button type="button" style={btn(true)} disabled={busy} onClick={() => void run(async () => {
              await onSave({ name: name.trim(), description: description.trim(), content: content(), sourceType: 'authored', requestedTools: [], requestedIntegrationIds: [], workDomainIds: domainIds });
            })}>{busy ? 'Saving…' : 'Save skill'}</button>}
      </div>
    </div>
  );
}
