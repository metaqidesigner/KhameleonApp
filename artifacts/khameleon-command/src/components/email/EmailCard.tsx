import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { helpWithEmail, rewriteReply, saveReplyDraft, type AssistResult, type EmailRef } from '@/lib/emailAssistApi';
import { createTask } from '@/lib/jarvisApi';
import { emailBridge } from '@/lib/desktopBridge';
import { KHAMI_HOME } from '@/lib/where';

/**
 * The email assistant's card (docs/build-review.md, Build 4 answers): a
 * short summary, a suggested reply (Use this reply / Change / Shorter /
 * More formal) and up to three actions. Khami writes it on this computer;
 * Copilot only when the user picks "Ask Copilot". Khameleon never sends:
 * "Use this reply" saves a draft in Outlook/Gmail, or copies the reply when
 * the email was read straight from the mail app. Shared by the Overlay
 * (beside the email window) and Classic's Inbox page.
 */
type Tone = 'overlay' | 'classic';

const TONES: Record<Tone, { text: string; muted: string; glass: string; border: string; accent: string; good: string; bad: string; input: string; radius: number; inner: number }> = {
  overlay: { text: '#d6efee', muted: '#8fb4b6', glass: 'rgba(10,22,26,0.86)', border: 'rgba(255,255,255,0.14)', accent: '#6FE6BD', good: '#6FE6BD', bad: '#ff9b9b', input: 'rgba(0,0,0,0.28)', radius: 14, inner: 8 },
  classic: { text: 'var(--j-text)', muted: 'var(--j-text-muted)', glass: 'rgba(0,10,16,0.6)', border: 'rgba(0,212,255,0.18)', accent: 'var(--j-cyan)', good: 'var(--j-green)', bad: 'var(--j-red)', input: 'rgba(0,4,8,0.6)', radius: 2, inner: 2 },
};

export function EmailCard({ tone, emailRef, subject, fromName, copilotAvailable, onClose, onReadingChange, style }: {
  tone: Tone;
  emailRef: EmailRef;
  subject: string;
  fromName?: string;
  copilotAvailable: boolean;
  onClose: () => void;
  /** True while an AI is reading the email (the email window glows light blue). */
  onReadingChange?: (reading: boolean) => void;
  style?: React.CSSProperties;
}) {
  const t = TONES[tone];
  const [agent, setAgent] = useState<'copilot' | undefined>(undefined);
  const [result, setResult] = useState<AssistResult | null>(null);
  const [reply, setReply] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>('reading');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [added, setAdded] = useState<number[]>([]);
  const readingCb = useRef(onReadingChange);
  readingCb.current = onReadingChange;

  const read = useCallback(async (which?: 'copilot') => {
    setBusy('reading'); setError(null); setDone(null); setResult(null); setAdded([]);
    readingCb.current?.(true);
    try {
      const r = await helpWithEmail(emailRef, which);
      setResult(r); setReply(r.reply); setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
    readingCb.current?.(false);
    setBusy(null);
  }, [emailRef]);

  useEffect(() => { void read(undefined); }, [read]);

  const askCopilot = () => { setAgent('copilot'); void read('copilot'); };

  const change = async (how: string) => {
    setBusy(how); setError(null); setDone(null);
    try { setReply(await rewriteReply(emailRef, reply, how, agent)); setEditing(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
    setBusy(null);
  };

  const use = async () => {
    setBusy('use'); setError(null);
    try {
      if ('source' in emailRef) {
        const r = await saveReplyDraft(emailRef.source, emailRef.id, reply);
        setDone(`Saved as a draft reply in ${r.where} - open it there to check and send it yourself.`);
      } else {
        const bridge = emailBridge();
        if (bridge) await bridge.copyText(reply); else await navigator.clipboard.writeText(reply);
        setDone('Copied - press Reply in your email and paste it in. Nothing has been sent.');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
    setBusy(null);
  };

  const addTask = async (i: number, label: string) => {
    try {
      await createTask({ title: label, description: `From the email "${subject}"${fromName ? ` from ${fromName}` : ''}.` });
      setAdded(a => [...a, i]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
  };

  const btn = (primary?: boolean): React.CSSProperties => ({
    padding: '4px 10px', borderRadius: t.inner, fontSize: 11.5, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
    background: primary ? 'rgba(111,230,189,0.14)' : 'transparent', border: `1px solid ${primary ? t.accent : t.border}`, color: t.text,
  });
  const heading = (text: string) => <div style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.muted }}>{text}</div>;
  const who = result?.by ?? (agent === 'copilot' ? 'Copilot' : 'Khami');

  return (
    <div role="dialog" aria-label={`Help with the email "${subject}"`} style={{
      width: 320, maxHeight: 'min(560px, calc(100vh - 32px))', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10,
      padding: 14, borderRadius: t.radius, background: t.glass, border: `1px solid ${t.border}`, color: t.text, fontSize: 12.5,
      backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxShadow: tone === 'overlay' ? '0 10px 32px rgba(0,0,0,0.38)' : undefined, ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subject || '(no subject)'}</div>
          {fromName && <div style={{ fontSize: 11, color: t.muted }}>from {fromName}</div>}
        </div>
        <button type="button" aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: t.muted }}><X size={14} /></button>
      </div>

      {busy === 'reading' && <div role="status" style={{ color: t.muted }}>{who} is reading this email{who === 'Khami' ? ` ${KHAMI_HOME}` : ''}… this can take a minute.</div>}

      {result && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {heading('Summary')}
            <div style={{ lineHeight: 1.45 }}>{result.summary || 'No summary.'}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {heading('Suggested reply')}
            {!reply && !editing ? (
              <div style={{ color: t.muted }}>No reply needed. <button type="button" style={{ ...btn(), padding: '2px 8px' }} onClick={() => setEditing(true)}>Write one</button></div>
            ) : editing ? (
              <textarea aria-label="Your reply" rows={7} value={reply} onChange={e => setReply(e.target.value)} autoFocus
                style={{ width: '100%', padding: '7px 9px', borderRadius: t.inner, fontSize: 12, lineHeight: 1.45, fontFamily: 'inherit', background: t.input, border: `1px solid ${t.border}`, color: t.text, resize: 'vertical' }} />
            ) : (
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.45, padding: '7px 9px', borderRadius: t.inner, background: t.input, maxHeight: 200, overflowY: 'auto' }}>{reply}</div>
            )}
            {(reply || editing) && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <button type="button" style={btn(true)} disabled={!!busy || !reply.trim()} onClick={() => void use()}>{busy === 'use' ? 'Saving…' : 'Use this reply'}</button>
                <button type="button" style={btn()} disabled={!!busy} onClick={() => setEditing(e => !e)}>{editing ? 'Done' : 'Change'}</button>
                <button type="button" style={btn()} disabled={!!busy || !reply.trim()} onClick={() => void change('shorter')}>{busy === 'shorter' ? 'Shortening…' : 'Shorter'}</button>
                <button type="button" style={btn()} disabled={!!busy || !reply.trim()} onClick={() => void change('more-formal')}>{busy === 'more-formal' ? 'Rewriting…' : 'More formal'}</button>
              </div>
            )}
            {done && <div role="status" style={{ fontSize: 11.5, color: t.good, lineHeight: 1.4 }}>{done}</div>}
          </div>

          {result.actions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {heading('Things to do')}
              {result.actions.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, lineHeight: 1.4 }}>{a.kind === 'calendar' ? 'Date: ' : ''}{a.label}</span>
                  {added.includes(i)
                    ? <span style={{ fontSize: 11, color: t.good }}>Added</span>
                    : <button type="button" style={btn()} onClick={() => void addTask(i, a.label)}>Add to my tasks</button>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {error && <div role="alert" style={{ fontSize: 12, color: t.bad, lineHeight: 1.4 }}>{error}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: t.muted, lineHeight: 1.4 }}>
        <span style={{ flex: 1 }}>
          {who === 'Khami' ? `By Khami, ${KHAMI_HOME}.` : `By ${who}.`} Khameleon never sends anything.
        </span>
        {copilotAvailable && agent !== 'copilot' && busy !== 'reading' && (
          <button type="button" style={{ ...btn(), padding: '2px 8px', fontSize: 10.5 }} onClick={askCopilot}>Ask Copilot</button>
        )}
      </div>
    </div>
  );
}
