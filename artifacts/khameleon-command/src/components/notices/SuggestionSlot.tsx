import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, MailWarning, X } from 'lucide-react';
import { getSuggestions, dismissSuggestion, openedSuggestion, type Suggestion } from '@/lib/workNoticesApi';
import { useJarvisStore } from '@/store/jarvisStore';
import { TONES, type Tone } from '@/components/settings/ui';

/**
 * The suggestion slot (gap review Q17; Builds 10-11): one small card at the
 * top of the screen for the rare things worth an interruption - a meeting
 * brief before a meeting, genuinely urgent mail. Several at once are
 * grouped. "Open" shows it in the chat; "Dismiss" hides it.
 */
export function SuggestionSlot({ tone, style }: { tone: Tone; style?: React.CSSProperties }) {
  const t = TONES[tone];
  const [items, setItems] = useState<Suggestion[]>([]);
  const [expanded, setExpanded] = useState(false);
  const requestChatTool = useJarvisStore(s => s.requestChatTool);
  const setChatOpen = useJarvisStore(s => s.setChatOpen);

  const load = useCallback(() => getSuggestions().then(setItems).catch(() => {}), []);
  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  if (!items.length) return null;

  const open = (s: Suggestion) => {
    requestChatTool('notice', { notice: { title: s.title, body: s.body, why: s.why } });
    setChatOpen(true);
    void openedSuggestion(s.id).then(load);
  };
  const dismiss = (s: Suggestion) => { setItems(list => list.filter(x => x.id !== s.id)); void dismissSuggestion(s.id); };
  const icon = (s: Suggestion) => (s.kind === 'urgent_mail' ? <MailWarning size={14} color={t.warn} /> : <CalendarClock size={14} color={t.accent} />);
  const btn: React.CSSProperties = { padding: '3px 9px', borderRadius: t.radius === 2 ? 2 : 7, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', border: `1px solid ${t.border}`, color: t.text };
  const shown = expanded ? items : items.slice(0, 1);

  return (
    <div data-overlay-hit role="region" aria-label="Suggestions" style={{
      width: 320, padding: '9px 11px', borderRadius: tone === 'overlay' ? 12 : 2, color: t.text, fontSize: 12,
      background: tone === 'overlay' ? 'rgba(10,22,26,0.86)' : 'rgba(0,10,16,0.94)', border: `1px solid ${t.border}`,
      backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxShadow: '0 8px 26px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', gap: 8, ...style,
    }}>
      {items.length > 1 && (
        <button type="button" onClick={() => setExpanded(e => !e)} style={{ ...btn, border: 'none', padding: 0, textAlign: 'left', color: t.muted }}>
          {items.length} things for you {expanded ? '- show fewer' : '- show all'}
        </button>
      )}
      {shown.map(s => (
        <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ marginTop: 1 }}>{icon(s)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, lineHeight: 1.35 }}>{s.title}</div>
            {s.why && <div style={{ fontSize: 11, color: t.muted, lineHeight: 1.4, marginTop: 2 }}>{s.why}</div>}
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button type="button" style={{ ...btn, borderColor: t.accent }} onClick={() => open(s)}>Open</button>
              <button type="button" style={btn} onClick={() => dismiss(s)}>Dismiss</button>
            </div>
          </div>
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(s)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: t.muted }}><X size={13} /></button>
        </div>
      ))}
    </div>
  );
}
