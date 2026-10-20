import { useEffect, useState, type ReactNode } from 'react';
import { Layers, Clock, Loader2, MessageCircle, Zap, Undo2 } from 'lucide-react';
import type { ChatToolId, ChatToolPayload } from '@/store/khameleonStore';
import { runSkillPrompt } from '@/components/skills/useSkillLibrary';
import { createActionReceipt } from '@/lib/actionReceiptsApi';

/** Writes to the activity log; a logging failure never interrupts the action itself. */
function logActivity(input: Parameters<typeof createActionReceipt>[0]) {
  createActionReceipt(input).catch(() => {});
}
import type { WorkKind } from './types';
import { searchMemory, runResearch, type MemorySearchResult } from '@/lib/khameleonApi';
import { useOpenEmail } from './useOpenEmail';
import type { FoundEmail } from '@/lib/emailAssistApi';
import {
  listOutlookMessages, runOutlookDraftEmail, sendOutlookDraft, rewriteOutlookDraft, rejectOutlookDraft,
  runOutlookSummarizeThread, runOutlookTriageInbox, undoOutlookTriage,
  type OutlookMessagePreview, type OutlookThreadSummary, type TriageResult,
} from '@/lib/outlookSkillsApi';
import {
  listGmailMessages, runGmailTriageInbox, undoGmailTriage, type GmailTriageResult, runGmailDraftEmail, sendGmailDraft, rewriteGmailDraft, rejectGmailDraft,
} from '@/lib/gmailSkillsApi';

/**
 * Toolbar actions as cards in the chat (docs/build-review.md, Builds 2 +
 * 13a). Every card calls an existing, real endpoint - the same ones
 * Classic's pages use. Asks change nothing; Actions confirm before anything
 * is sent, and reversible ones offer Undo.
 */

export const TOOL_KIND: Record<ChatToolId, WorkKind> = {
  'search-memory': 'ask',
  research: 'ask',
  'draft-reply': 'action',
  'summarize-thread': 'action',
  'sort-inbox': 'action',
  polish: 'action',
  'run-skill': 'action',
  notice: 'ask',
};

export const TOOL_TITLE: Record<ChatToolId, string> = {
  'search-memory': 'Search memory',
  research: 'Research a question',
  'draft-reply': 'Draft reply',
  'summarize-thread': 'Summarize email thread',
  'sort-inbox': 'Sort inbox',
  polish: 'Polish wording',
  'run-skill': 'Run skill',
  notice: 'From Khameleon',
};

const KIND_META: Record<WorkKind, { label: string; icon: ReactNode }> = {
  ask: { label: 'Ask', icon: <MessageCircle size={10} /> },
  action: { label: 'Action', icon: <Zap size={10} /> },
  task: { label: 'Task', icon: <Layers size={10} /> },
  scheduled: { label: 'Scheduled', icon: <Clock size={10} /> },
};

export function KindBadge({ kind }: { kind: WorkKind }) {
  const m = KIND_META[kind];
  return (
    <span
      title={m.label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 999,
        fontSize: 9, letterSpacing: '0.04em', color: '#9fc4c6',
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      {m.icon}{m.label}
    </span>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 12,
  background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(95,240,216,0.18)',
  display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, color: '#d6efee',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 9px', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit',
  background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', color: '#d6efee',
};
const mutedStyle: React.CSSProperties = { fontSize: 11, color: '#8fb4b6' };

function Btn({ children, onClick, disabled, primary, danger }: {
  children: ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean; danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 11px', borderRadius: 8, fontSize: 12, fontFamily: 'inherit',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
        background: primary ? 'rgba(95,240,216,0.18)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${primary ? 'rgba(95,240,216,0.45)' : danger ? 'rgba(255,120,120,0.35)' : 'rgba(255,255,255,0.14)'}`,
        color: danger ? '#ffb0b0' : '#d6efee',
        display: 'inline-flex', alignItems: 'center', gap: 5,
      }}
    >
      {children}
    </button>
  );
}

function Busy({ label }: { label: string }) {
  return <div style={{ ...mutedStyle, display: 'flex', alignItems: 'center', gap: 6 }}><Loader2 size={12} className="chat-spin" />{label}</div>;
}

function ErrorLine({ message }: { message: string }) {
  // Server errors for a missing connection include an internal setup URL;
  // say it in plain words instead.
  const notConnected = message.match(/^(Outlook|Gmail|Microsoft|Google)\b.*not connected/i);
  const text = notConnected
    ? `${notConnected[1] === 'Microsoft' ? 'Outlook' : notConnected[1] === 'Google' ? 'Gmail' : notConnected[1]} isn't connected yet.`
    : message;
  return (
    <div role="alert" style={{ fontSize: 12, color: '#ffb0b0' }}>
      {text}
      {(notConnected || /token|auth|401|403/i.test(message)) && (
        <div style={{ ...mutedStyle, marginTop: 3 }}>Connect it from Integrations in the Classic window, then try again.</div>
      )}
    </div>
  );
}

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

type Provider = 'outlook' | 'gmail';
type MessagePreview = OutlookMessagePreview;

/** Picks a recent email - used when Khameleon can't tell which email is open, or the user wants another (Build 9). */
function MessagePicker({ provider, onPick }: { provider: Provider; onPick: (m: MessagePreview) => void }) {
  const [messages, setMessages] = useState<MessagePreview[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMessages(null);
    setError(null);
    (provider === 'outlook' ? listOutlookMessages() : listGmailMessages())
      .then(setMessages)
      .catch(e => setError(errText(e)));
  }, [provider]);

  if (error) return <ErrorLine message={error} />;
  if (!messages) return <Busy label="Loading recent emails…" />;
  if (messages.length === 0) return <div style={mutedStyle}>No recent emails found.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
      {messages.slice(0, 8).map(m => (
        <button
          key={m.id}
          type="button"
          onClick={() => onPick(m)}
          style={{
            textAlign: 'left', padding: '7px 9px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
            background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', color: '#d6efee',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.subject || '(no subject)'}</div>
          <div style={{ fontSize: 10.5, color: '#8fb4b6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.from}</div>
        </button>
      ))}
    </div>
  );
}

function ProviderSwitch({ value, onChange }: { value: Provider; onChange: (p: Provider) => void }) {
  return (
    <div role="radiogroup" aria-label="Email account" style={{ display: 'flex', gap: 6 }}>
      {(['outlook', 'gmail'] as const).map(p => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={value === p}
          onClick={() => onChange(p)}
          className="chat-domain-chip"
          data-active={value === p}
        >
          {p === 'outlook' ? 'Outlook' : 'Gmail'}
        </button>
      ))}
    </div>
  );
}

/**
 * Build 9 safeguard: names the open email before anything is done with it,
 * with one click to choose another instead.
 */
function OpenEmailChoice({ email, verb, onUse, onChoose }: { email: FoundEmail; verb: string; onUse: () => void; onChoose: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 12, lineHeight: 1.45 }}>
        <span style={{ color: '#8fb4b6' }}>{verb}: </span><strong>{email.subject || '(no subject)'}</strong>
        <span style={{ color: '#8fb4b6' }}> - {email.fromName || email.from}</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" className="chat-domain-chip" data-active onClick={onUse}>{verb === 'Replying to' ? 'Draft reply to this' : 'Summarize this'}</button>
        <button type="button" className="chat-domain-chip" onClick={onChoose}>Choose another</button>
      </div>
    </div>
  );
}

// ── Asks ─────────────────────────────────────────────────────────────────────

function SearchMemoryCard() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<MemorySearchResult[] | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setResults(await searchMemory(q.trim()));
    setBusy(false);
  };

  return (
    <>
      <form onSubmit={e => { e.preventDefault(); void run(); }} style={{ display: 'flex', gap: 6 }}>
        <input autoFocus aria-label="Search memory for" placeholder="What are you looking for?" value={q} onChange={e => setQ(e.target.value)} style={inputStyle} />
        <Btn primary onClick={() => void run()} disabled={busy || !q.trim()}>Search</Btn>
      </form>
      {busy && <Busy label="Searching…" />}
      {results && results.length === 0 && <div style={mutedStyle}>No matches found.</div>}
      {results && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {results.slice(0, 6).map((r, i) => (
            <div key={r.chunk_id ?? i} style={{ padding: '7px 9px', borderRadius: 8, background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ fontSize: 10.5, color: '#8fb4b6', marginBottom: 3 }}>{r.source}</div>
              <div style={{ fontSize: 12, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.content}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ResearchCard() {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    setAnswer(null);
    const res = await runResearch(q.trim());
    // runResearch returns a canned "offline" text when the server can't be
    // reached; show a plain error instead of presenting that as an answer.
    if (res.model === 'offline') setError("Couldn't reach Khameleon's server to run the research.");
    else setAnswer(res.content);
    setBusy(false);
  };

  return (
    <>
      <form onSubmit={e => { e.preventDefault(); void run(); }} style={{ display: 'flex', gap: 6 }}>
        <input autoFocus aria-label="Research question" placeholder="What should I look into?" value={q} onChange={e => setQ(e.target.value)} style={inputStyle} />
        <Btn primary onClick={() => void run()} disabled={busy || !q.trim()}>Research</Btn>
      </form>
      {busy && <Busy label="Researching - this can take a minute…" />}
      {error && <ErrorLine message={error} />}
      {answer && <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{answer}</div>}
    </>
  );
}

// ── Actions ──────────────────────────────────────────────────────────────────

type DraftState = { approvalId: number; to: string; subject: string; body: string };

function DraftReplyCard() {
  const open = useOpenEmail();
  const [choosing, setChoosing] = useState(false);
  const [provider, setProvider] = useState<Provider>('outlook');
  useEffect(() => { if (open.email) setProvider(open.email.source); }, [open.email]);
  const [stage, setStage] = useState<'pick' | 'drafting' | 'review' | 'confirm' | 'sending' | 'sent' | 'discarded'>('pick');
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [body, setBody] = useState('');
  const [tone, setTone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const api = provider === 'outlook'
    ? { run: runOutlookDraftEmail, send: sendOutlookDraft, rewrite: rewriteOutlookDraft, reject: rejectOutlookDraft }
    : { run: runGmailDraftEmail, send: sendGmailDraft, rewrite: rewriteGmailDraft, reject: rejectGmailDraft };

  const pick = async (m: MessagePreview) => {
    setStage('drafting');
    setError(null);
    try {
      const d = await api.run(m.id);
      setDraft(d);
      setBody(d.body);
      setStage('review');
    } catch (e) {
      setError(errText(e));
      setStage('pick');
    }
  };

  const rewrite = async () => {
    if (!draft) return;
    setStage('drafting');
    try {
      const d = await api.rewrite(draft.approvalId, tone.trim() || undefined);
      setDraft(d);
      setBody(d.body);
      setTone('');
    } catch (e) {
      setError(errText(e));
    }
    setStage('review');
  };

  // Outlook: Khameleon never sends (it doesn't ask Microsoft for that) - the reply is kept in Outlook's Drafts.
  const savesOnly = provider === 'outlook';

  const send = async () => {
    if (!draft) return;
    setStage('sending');
    try {
      await api.send(draft.approvalId, body !== draft.body ? body : undefined);
      logActivity(savesOnly
        ? { description: `Reply to ${draft.to} saved in Outlook Drafts`, category: 'email_draft_saved', scope: 'mail.readwrite', outcome: 'success', target: draft.to, detail: draft.subject, canUndo: false }
        : { description: `Email sent to ${draft.to}`, category: 'email_sent', scope: 'gmail.send', outcome: 'success', target: draft.to, detail: draft.subject, canUndo: false });
      setStage('sent');
    } catch (e) {
      logActivity({ description: savesOnly ? `Reply to ${draft.to} wasn't saved` : `Email to ${draft.to} wasn't sent`, category: savesOnly ? 'email_draft_saved' : 'email_sent', scope: savesOnly ? 'mail.readwrite' : 'gmail.send', outcome: 'failure', target: draft.to, detail: errText(e), canUndo: false });
      setError(errText(e));
      setStage('review');
    }
  };

  const discard = async () => {
    if (draft) await api.reject(draft.approvalId).catch(() => {});
    setStage('discarded');
  };

  if (stage === 'sent') return <div>{savesOnly ? <>Saved in your Outlook Drafts - open Outlook to check and send it to {draft?.to}.</> : <>Sent to {draft?.to}.</>}</div>;
  if (stage === 'discarded') return <div style={mutedStyle}>Draft discarded - nothing was sent.</div>;

  return (
    <>
      {stage === 'pick' && open.looking && <Busy label="Looking for the open email…" />}
      {stage === 'pick' && !open.looking && open.email && !choosing && (
        <OpenEmailChoice email={open.email} verb="Replying to" onChoose={() => setChoosing(true)}
          onUse={() => void pick({ id: open.email!.id, subject: open.email!.subject, from: open.email!.from, preview: '', receivedDateTime: open.email!.receivedAt ?? '' })} />
      )}
      {stage === 'pick' && !open.looking && (!open.email || choosing) && (
        <>
          <ProviderSwitch value={provider} onChange={setProvider} />
          <div style={mutedStyle}>Which email are you replying to?</div>
          <MessagePicker provider={provider} onPick={m => void pick(m)} />
        </>
      )}
      {stage === 'drafting' && <Busy label="Writing a draft…" />}
      {(stage === 'review' || stage === 'confirm' || stage === 'sending') && draft && (
        <>
          <div style={mutedStyle}>To {draft.to} · {draft.subject}</div>
          <textarea aria-label="Draft reply" value={body} onChange={e => setBody(e.target.value)} rows={7} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.45 }} />
          {stage === 'review' && (
            <>
              <div style={{ display: 'flex', gap: 6 }}>
                <input aria-label="Change the tone" placeholder="Change the tone (e.g. shorter, warmer)" value={tone} onChange={e => setTone(e.target.value)} style={inputStyle} />
                <Btn onClick={() => void rewrite()}>Rewrite</Btn>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {savesOnly
                  ? <Btn primary onClick={() => void send()}>Save to Outlook Drafts</Btn>
                  : <Btn primary onClick={() => setStage('confirm')}>Send…</Btn>}
                <Btn danger onClick={() => void discard()}>Discard</Btn>
              </div>
            </>
          )}
          {stage === 'confirm' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, borderRadius: 8, background: 'rgba(255,179,107,0.08)', border: '1px solid rgba(255,179,107,0.3)' }}>
              <div>Send this reply to <strong>{draft.to}</strong> now?</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn primary onClick={() => void send()}>Yes, send</Btn>
                <Btn onClick={() => setStage('review')}>Back</Btn>
              </div>
            </div>
          )}
          {stage === 'sending' && <Busy label={savesOnly ? 'Saving…' : 'Sending…'} />}
        </>
      )}
      {error && <ErrorLine message={error} />}
    </>
  );
}

function SummarizeThreadCard() {
  const open = useOpenEmail();
  const [choosing, setChoosing] = useState(false);
  const [summary, setSummary] = useState<OutlookThreadSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (m: MessagePreview) => {
    setBusy(true);
    setError(null);
    try { setSummary(await runOutlookSummarizeThread(m.id)); } catch (e) { setError(errText(e)); }
    setBusy(false);
  };

  if (summary) {
    return (
      <>
        <div style={mutedStyle}>{summary.messageCount} messages · {summary.participants.join(', ')}</div>
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{summary.summary}</div>
      </>
    );
  }
  return (
    <>
      {busy ? <Busy label="Summarizing…" />
        : open.looking ? <Busy label="Looking for the open email…" />
        : open.email?.source === 'outlook' && !choosing
          ? <OpenEmailChoice email={open.email} verb="Summarizing" onUse={() => void pick({ id: open.email!.id, subject: open.email!.subject, from: open.email!.from, preview: '', receivedDateTime: open.email!.receivedAt ?? '' })} onChoose={() => setChoosing(true)} />
          : <><div style={mutedStyle}>Outlook only for now. Which thread?</div><MessagePicker provider="outlook" onPick={m => void pick(m)} /></>}
      {error && <ErrorLine message={error} />}
    </>
  );
}

const CLASS_LABEL: Record<string, string> = { urgent: 'Urgent', action_needed: 'Needs action', fyi: 'FYI', low_priority: 'Low priority' };

function SortInboxCard() {
  const [provider, setProvider] = useState<Provider>('outlook');
  const [stage, setStage] = useState<'ready' | 'sorting' | 'done' | 'undoing' | 'undone'>('ready');
  const [result, setResult] = useState<TriageResult | GmailTriageResult | null>(null);
  const label = provider === 'outlook' ? 'Outlook' : 'Gmail';
  const [error, setError] = useState<string | null>(null);
  const [undoNote, setUndoNote] = useState<string | null>(null);

  const sort = async () => {
    setStage('sorting');
    setError(null);
    try {
      const r = provider === 'outlook' ? await runOutlookTriageInbox() : await runGmailTriageInbox();
      // Undo for a sort lives on its card (it needs the per-message details);
      // the log records that it happened (Gmail's sort logs itself on the server).
      if (provider === 'outlook') logActivity({ description: `Sorted ${r.items.length} Outlook email${r.items.length === 1 ? '' : 's'}`, category: 'inbox_sorted', scope: 'mail.readwrite', outcome: 'success', target: 'Outlook', canUndo: false });
      setResult(r);
      setStage('done');
    } catch (e) {
      logActivity({ description: "Inbox sort didn't finish", category: 'inbox_sorted', scope: 'mail.readwrite', outcome: 'failure', target: label, detail: errText(e), canUndo: false });
      setError(errText(e));
      setStage('ready');
    }
  };

  const undo = async () => {
    if (!result) return;
    setStage('undoing');
    try {
      const taskIds = result.actionItems.map(a => a.taskId).filter((id): id is number => id !== null);
      const r = provider === 'outlook'
        ? await undoOutlookTriage((result as TriageResult).items.map(i => i.undo), taskIds)
        : await undoGmailTriage((result as GmailTriageResult).items.map(i => i.undo), taskIds);
      setUndoNote(`Restored ${r.restored} email${r.restored === 1 ? '' : 's'}${r.failed ? `, ${r.failed} couldn't be restored` : ''}.`);
      setStage('undone');
    } catch (e) {
      setError(errText(e));
      setStage('done');
    }
  };

  return (
    <>
      {stage === 'ready' && (
        <>
          <ProviderSwitch value={provider} onChange={setProvider} />
          <div style={mutedStyle}>{provider === 'outlook'
            ? 'Sorts unread Outlook mail into Urgent / Needs action / FYI / Low priority - flags, categorises and archives. Everything can be undone.'
            : 'Sorts unread Gmail into Urgent / Needs action / FYI / Low priority - adds Khameleon labels, stars urgent mail, archives FYI and low priority. Everything can be undone.'}</div>
          <div><Btn primary onClick={() => void sort()}>Sort my inbox</Btn></div>
        </>
      )}
      {stage === 'sorting' && <Busy label="Sorting your inbox…" />}
      {(stage === 'done' || stage === 'undoing') && result && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {Object.entries(result.counts).map(([k, n]) => (
              <span key={k} style={{ fontSize: 12 }}><strong>{n}</strong> <span style={mutedStyle}>{CLASS_LABEL[k] ?? k}</span></span>
            ))}
          </div>
          {result.items.filter(i => i.classification === 'urgent').slice(0, 4).map(i => (
            <div key={i.id} style={{ fontSize: 12 }}>⚑ {i.subject} <span style={mutedStyle}>- {i.from}</span></div>
          ))}
          {result.actionItems.length > 0 && <div style={mutedStyle}>{result.actionItems.length} action item{result.actionItems.length === 1 ? '' : 's'} added to your tasks.</div>}
          <div><Btn onClick={() => void undo()} disabled={stage === 'undoing'}><Undo2 size={12} />Undo</Btn></div>
        </>
      )}
      {stage === 'undone' && <div style={mutedStyle}>{undoNote}</div>}
      {error && <ErrorLine message={error} />}
    </>
  );
}

function PolishCard({ onSend }: { onSend: (prompt: string, display?: string) => void }) {
  const [text, setText] = useState('');
  const [how, setHow] = useState('');
  const [sent, setSent] = useState(false);

  const paste = async () => {
    try { setText(await navigator.clipboard.readText()); } catch { /* clipboard blocked - user can paste manually */ }
  };

  if (sent) return <div style={mutedStyle}>Sent to the chat - the polished version is below.</div>;
  return (
    <>
      <textarea autoFocus aria-label="Text to polish" placeholder="Paste the text to polish" value={text} onChange={e => setText(e.target.value)} rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
      <input aria-label="How to polish it" placeholder="Any direction? (e.g. more formal, shorter)" value={how} onChange={e => setHow(e.target.value)} style={inputStyle} />
      <div style={{ display: 'flex', gap: 6 }}>
        <Btn onClick={() => void paste()}>Paste from clipboard</Btn>
        <Btn primary disabled={!text.trim()} onClick={() => {
          onSend(
            `Polish the wording of the text below${how.trim() ? ` (${how.trim()})` : ''}. Keep the meaning, return only the improved text.\n\n${text.trim()}`,
            `Polish${how.trim() ? ` (${how.trim()})` : ''}: ${text.trim()}`,
          );
          setSent(true);
        }}>Polish</Btn>
      </div>
    </>
  );
}

function RunSkillCard({ skill, onSend }: { skill?: { name: string; content: string }; onSend: (prompt: string, display?: string) => void }) {
  const [task, setTask] = useState('');
  const [sent, setSent] = useState(false);
  if (!skill) return <ErrorLine message="This skill couldn't be loaded." />;
  if (sent) return <div style={mutedStyle}>Running "{skill.name}" - Khameleon's reply is below.</div>;
  return (
    <>
      <div style={{ fontWeight: 600 }}>{skill.name}</div>
      <textarea autoFocus aria-label="What should the skill work on?" placeholder="What should it work on? (e.g. this month's statement, the Acme account)" value={task} onChange={e => setTask(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
      <div><Btn primary disabled={!task.trim()} onClick={() => { onSend(runSkillPrompt(skill, task), `Run "${skill.name}": ${task.trim()}`); setSent(true); }}>Run</Btn></div>
    </>
  );
}

// ── Card frame ───────────────────────────────────────────────────────────────

export function ToolCard({ tool, payload, onSend }: { tool: ChatToolId; payload?: ChatToolPayload; onSend: (prompt: string, display?: string) => void }) {
  const body = (() => {
    switch (tool) {
      case 'search-memory': return <SearchMemoryCard />;
      case 'research': return <ResearchCard />;
      case 'draft-reply': return <DraftReplyCard />;
      case 'summarize-thread': return <SummarizeThreadCard />;
      case 'sort-inbox': return <SortInboxCard />;
      case 'polish': return <PolishCard onSend={onSend} />;
      case 'run-skill': return <RunSkillCard skill={payload?.skill} onSend={onSend} />;
      case 'notice': return payload?.notice ? (
        <>
          <div style={{ fontWeight: 600 }}>{payload.notice.title}</div>
          {payload.notice.why && <div style={mutedStyle}>{payload.notice.why}</div>}
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{payload.notice.body}</div>
        </>
      ) : null;
    }
  })();
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{TOOL_TITLE[tool]}</span>
        <KindBadge kind={TOOL_KIND[tool]} />
      </div>
      {body}
    </div>
  );
}
