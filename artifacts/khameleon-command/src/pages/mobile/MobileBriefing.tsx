import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Mic, Send, SkipForward, Wand2, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useVoice } from '@/components/orb/useVoice';
import { ConfirmGate } from '@/components/ConfirmGate';
import { getMorningBriefing, logBriefingTurn, type MorningBriefing, type BriefingUrgentItem } from '@/lib/briefingApi';
import { sendOutlookDraft, rejectOutlookDraft, rewriteOutlookDraft } from '@/lib/outlookSkillsApi';
import { sendGmailDraft, rejectGmailDraft } from '@/lib/gmailSkillsApi';

/**
 * Mobile Morning Briefing (KHAMELEON_SPEC.md §5) - V1, PWA-only (no native
 * wrapper yet). Audio-predominant: narrates each urgent item, listens for
 * a spoken "send it" / "skip" / "change the tone", and falls back to a
 * real on-screen ConfirmGate review - voice is the primary path here,
 * never the only path. Real data only, from GET /api/briefing/today.
 */

type Phase = 'idle' | 'loading' | 'narrating' | 'fyi' | 'headsup' | 'done' | 'error';

function narrationFor(item: BriefingUrgentItem): string {
  if (item.draft) {
    return `${item.title}. I've drafted a reply: ${item.draft.body}. Say send it, skip, or change the tone.`;
  }
  return item.detail ? `${item.title}. ${item.detail}` : item.title;
}

export default function MobileBriefing() {
  const [briefing, setBriefing] = useState<MorningBriefing | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [lastHeard, setLastHeard] = useState<string | null>(null);

  const briefingRef = useRef(briefing);
  briefingRef.current = briefing;
  const indexRef = useRef(index);
  indexRef.current = index;

  // One real session per briefing run, so the desktop Chat Window can
  // later resume this exact conversation (KHAMELEON_SPEC.md's Mobile
  // Morning Briefing continuity gap). Generated once, when the briefing
  // actually starts playing - not on mount, so merely opening the page
  // without pressing play never creates an empty session.
  const sessionIdRef = useRef<string | null>(null);
  const log = useCallback((role: 'user' | 'assistant', content: string) => {
    if (!sessionIdRef.current) return;
    void logBriefingTurn(sessionIdRef.current, role, content);
  }, []);

  const handleTranscript = useCallback((text: string) => {
    setLastHeard(text);
    handleVoiceCommand(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const voice = useVoice(handleTranscript);
  const wasSpeakingRef = useRef(false);

  useEffect(() => {
    if (wasSpeakingRef.current && !voice.isSpeaking && phase === 'narrating') {
      voice.startListening();
    }
    wasSpeakingRef.current = voice.isSpeaking;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.isSpeaking, phase]);

  const currentItem = briefing?.urgent[index];

  async function handleVoiceCommand(text: string) {
    const b = briefingRef.current;
    const item = b?.urgent[indexRef.current];
    log('user', text);
    if (!item?.draft) { advanceUrgent(); return; }

    const lower = text.toLowerCase();
    const { draft } = item;
    try {
      if (/\b(send|yes)\b/.test(lower)) {
        setBusy(true);
        if (draft.provider === 'outlook') await sendOutlookDraft(draft.approvalId);
        else await sendGmailDraft(draft.approvalId);
        log('assistant', `Sent the reply to ${draft.to}.`);
        advanceUrgent();
      } else if (/\b(skip|no|discard|cancel)\b/.test(lower)) {
        setBusy(true);
        if (draft.provider === 'outlook') await rejectOutlookDraft(draft.approvalId);
        else await rejectGmailDraft(draft.approvalId);
        log('assistant', `Skipped - discarded the drafted reply to ${draft.to}.`);
        advanceUrgent();
      } else if (/\b(tone|change|rewrite|different|shorter|casual|formal|friendlier)\b/.test(lower) && draft.supportsRewrite) {
        setBusy(true);
        const updated = await rewriteOutlookDraft(draft.approvalId, text);
        updateCurrentDraft(updated.body);
        const reply = `Here's the new version: ${updated.body}. Say send it, skip, or change the tone again.`;
        voice.speak(reply);
        log('assistant', reply);
      } else {
        const reply = "Sorry, say send it, skip, or change the tone.";
        voice.speak(reply);
        log('assistant', reply);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  function updateCurrentDraft(body: string) {
    setBriefing(b => {
      if (!b) return b;
      const urgent = b.urgent.map((u, i) => (i === indexRef.current && u.draft ? { ...u, draft: { ...u.draft, body } } : u));
      return { ...b, urgent };
    });
  }

  function advanceUrgent() {
    const b = briefingRef.current;
    if (!b) return;
    const next = indexRef.current + 1;
    if (next < b.urgent.length) {
      setIndex(next);
      narrate(b.urgent[next]);
    } else {
      log('assistant', "That's your briefing. Have a good one.");
      setPhase('fyi');
    }
  }

  function narrate(item: BriefingUrgentItem) {
    setPhase('narrating');
    const text = narrationFor(item);
    voice.speak(text);
    log('assistant', text);
  }

  const start = useCallback(async () => {
    setPhase('loading');
    setError(null);
    sessionIdRef.current = crypto.randomUUID();
    try {
      const data = await getMorningBriefing();
      setBriefing(data);
      setIndex(0);
      if (data.urgent.length > 0) {
        narrate(data.urgent[0]);
      } else {
        log('assistant', 'No urgent items this morning.');
        setPhase('fyi');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your briefing');
      setPhase('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualSend = async (editedBody?: string) => {
    if (!currentItem?.draft) return;
    const { draft } = currentItem;
    log('user', editedBody ? `Edited and sent: ${editedBody}` : 'Reviewed and sent as drafted.');
    if (draft.provider === 'outlook') await sendOutlookDraft(draft.approvalId, editedBody);
    else await sendGmailDraft(draft.approvalId, editedBody);
    log('assistant', `Sent the reply to ${draft.to}.`);
    setReviewing(false);
    advanceUrgent();
  };

  const handleManualDiscard = async () => {
    if (!currentItem?.draft) return;
    const { draft } = currentItem;
    log('user', 'Reviewed and discarded the draft.');
    if (draft.provider === 'outlook') await rejectOutlookDraft(draft.approvalId);
    else await rejectGmailDraft(draft.approvalId);
    log('assistant', `Skipped - discarded the drafted reply to ${draft.to}.`);
    setReviewing(false);
    advanceUrgent();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--j-bg)', color: 'var(--j-text)', fontFamily: 'var(--j-font-ui)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 20px', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>
        <header style={{ textAlign: 'center', marginTop: 12 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--j-text-muted)' }}>Khameleon</div>
          <h1 style={{ fontFamily: 'var(--j-font-head)', fontSize: 24, fontWeight: 700, margin: '6px 0 0' }}>Morning Briefing</h1>
          {briefing && (
            <div style={{ fontSize: 11, color: 'var(--j-text-muted)', marginTop: 6 }}>
              {briefing.emailConnected.outlook || briefing.emailConnected.gmail
                ? `Connected: ${[briefing.emailConnected.outlook && 'Outlook', briefing.emailConnected.gmail && 'Gmail'].filter(Boolean).join(', ')}`
                : 'No email connected — connect Outlook or Gmail in Settings for full briefings'}
            </div>
          )}
        </header>

        {phase === 'idle' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={start}
              aria-label="Play briefing"
              style={{
                width: 140, height: 140, borderRadius: '50%', border: '1px solid var(--j-border)',
                background: 'radial-gradient(circle, rgba(111,230,189,0.16), rgba(111,230,189,0.04))',
                color: 'var(--j-teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <Play size={44} fill="currentColor" />
            </button>
          </div>
        )}

        {phase === 'loading' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--j-text-muted)' }}>
            <Loader2 size={28} className="j-spin-briefing" />
            <style>{'@keyframes briefing-spin{to{transform:rotate(360deg)}} .j-spin-briefing{animation:briefing-spin 1s linear infinite}'}</style>
          </div>
        )}

        {phase === 'error' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--j-coral)', textAlign: 'center' }}>
            <AlertTriangle size={28} />
            <div style={{ fontSize: 13 }}>{error}</div>
            <button type="button" onClick={start} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--j-border)', background: 'transparent', color: 'var(--j-text)', cursor: 'pointer' }}>Try again</button>
          </div>
        )}

        {phase === 'narrating' && currentItem && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--j-amber)' }}>
              Urgent · {index + 1} of {briefing?.urgent.length}
            </div>
            <div style={{ padding: 16, borderRadius: 14, border: '1px solid var(--j-border)', background: 'var(--j-surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: currentItem.draft ? 10 : 0 }}>{currentItem.title}</div>
              {currentItem.draft && (
                <div style={{ fontSize: 13, color: 'var(--j-text-muted)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{currentItem.draft.body}</div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: voice.isSpeaking ? 'var(--j-teal)' : voice.isListening ? 'var(--j-amber)' : 'var(--j-text-muted)', fontSize: 12 }}>
              {busy ? <Loader2 size={14} className="j-spin-briefing" /> : <Mic size={14} />}
              {busy ? 'Working…' : voice.isSpeaking ? 'Speaking…' : voice.isListening ? 'Listening…' : 'Ready'}
            </div>
            {lastHeard && <div style={{ fontSize: 11, color: 'var(--j-text-faint)', textAlign: 'center' }}>Heard: "{lastHeard}"</div>}

            {currentItem.draft && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => handleVoiceCommand('send it')} disabled={busy} style={pillBtnStyle('var(--j-green)')}><Send size={13} /> Send</button>
                {currentItem.draft.supportsRewrite && (
                  <button type="button" onClick={() => setReviewing(true)} disabled={busy} style={pillBtnStyle('var(--j-violet)')}><Wand2 size={13} /> Review / edit</button>
                )}
                <button type="button" onClick={() => handleVoiceCommand('skip')} disabled={busy} style={pillBtnStyle('var(--j-text-muted)')}><SkipForward size={13} /> Skip</button>
              </div>
            )}
            {!currentItem.draft && (
              <button type="button" onClick={advanceUrgent} style={{ ...pillBtnStyle('var(--j-text-muted)'), alignSelf: 'center' }}><SkipForward size={13} /> Next</button>
            )}

            {error && <div style={{ fontSize: 12, color: 'var(--j-coral)', textAlign: 'center' }}>{error}</div>}
          </div>
        )}

        {(phase === 'fyi' || phase === 'headsup' || phase === 'done') && briefing && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {phase === 'fyi' && (
              <>
                <Section title="FYI / already handled" empty={briefing.fyi.length === 0}>
                  {briefing.fyi.map(f => (
                    <ListRow key={f.id} title={f.subject} sub={`${f.from} · ${f.actionTaken}`} />
                  ))}
                </Section>
                <button type="button" onClick={() => setPhase('headsup')} style={{ ...pillBtnStyle('var(--j-teal)'), alignSelf: 'center' }}>Continue</button>
              </>
            )}
            {phase === 'headsup' && (
              <>
                <Section title="Heads up / brewing" empty={briefing.headsUp.length === 0}>
                  {briefing.headsUp.map(h => (
                    <ListRow key={h.id} title={h.title} sub={h.detail} />
                  ))}
                </Section>
                <button type="button" onClick={() => setPhase('done')} style={{ ...pillBtnStyle('var(--j-teal)'), alignSelf: 'center' }}>Done</button>
              </>
            )}
            {phase === 'done' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--j-teal)' }}>
                <CheckCircle2 size={32} />
                <div style={{ fontSize: 13, color: 'var(--j-text-muted)' }}>That's your briefing. Have a good one.</div>
              </div>
            )}
          </div>
        )}
      </div>

      {reviewing && currentItem?.draft && (
        <ConfirmGate
          title={currentItem.draft.provider === 'outlook' ? 'Send Outlook reply' : 'Send Gmail reply'}
          category="email_send"
          target={currentItem.draft.to}
          scope={currentItem.draft.provider === 'outlook' ? 'mail.send' : 'gmail.send'}
          payload={<div>Subject: {currentItem.draft.subject}{'\n\n'}{currentItem.draft.body}</div>}
          allowEdit
          editableContent={currentItem.draft.body}
          onConfirm={handleManualSend}
          onCancel={handleManualDiscard}
          severity="high"
        />
      )}
    </div>
  );
}

function pillBtnStyle(color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999,
    border: `1px solid ${color}`, background: 'transparent', color, fontSize: 12, fontWeight: 600,
    cursor: 'pointer',
  };
}

function Section({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--j-text-muted)', marginBottom: 8 }}>{title}</div>
      {empty ? (
        <div style={{ fontSize: 12, color: 'var(--j-text-faint)' }}>Nothing here right now.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
      )}
    </div>
  );
}

function ListRow({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--j-border)', background: 'var(--j-surface-alt)' }}>
      <div style={{ fontSize: 13 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--j-text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
