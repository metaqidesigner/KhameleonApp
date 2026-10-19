import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { getLoginRequests, answerLoginRequest, type LoginRequest, type LoginChoice } from '@/lib/savedLoginsApi';
import { TONES, type Tone } from '@/components/settings/ui';

/**
 * Build 7: "Use your Supplier portal login?" - shown while a skill waits to
 * sign in. Once / Always for this skill / No. The password is typed by the
 * desktop app; nothing here (or in the AI) ever sees it.
 */
export function LoginRequests({ tone, style }: { tone: Tone; style?: React.CSSProperties }) {
  const t = TONES[tone];
  const [requests, setRequests] = useState<LoginRequest[]>([]);
  useEffect(() => {
    const load = () => getLoginRequests().then(setRequests).catch(() => {});
    void load();
    const id = window.setInterval(load, 3000);
    return () => window.clearInterval(id);
  }, []);
  if (!requests.length) return null;

  const answer = (r: LoginRequest, c: LoginChoice) => { setRequests(list => list.filter(x => x.id !== r.id)); void answerLoginRequest(r.id, c); };
  const btn = (primary?: boolean): React.CSSProperties => ({ padding: '4px 10px', borderRadius: t.radius === 2 ? 2 : 7, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', color: t.text, background: primary ? 'rgba(111,230,189,0.14)' : 'transparent', border: `1px solid ${primary ? t.accent : t.border}` });

  return (
    <div data-overlay-hit style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
      {requests.map(r => (
        <div key={r.id} role="alertdialog" aria-label={`Use your ${r.loginName} login?`} style={{
          width: 320, padding: '10px 12px', borderRadius: tone === 'overlay' ? 12 : 2, color: t.text, fontSize: 12.5,
          background: tone === 'overlay' ? 'rgba(10,22,26,0.92)' : 'rgba(0,10,16,0.96)', border: `1px solid ${t.accent}`,
          backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxShadow: '0 8px 26px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <KeyRound size={15} color={t.accent} />
            <strong>Use your "{r.loginName}" login?</strong>
          </div>
          <div style={{ fontSize: 11, color: t.muted, lineHeight: 1.4 }}>
            {r.skillName ? `For the skill "${r.skillName}". ` : ''}Khameleon will type it into the sign-in page - the AI never sees the password.
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" style={btn(true)} onClick={() => answer(r, 'once')}>Once</button>
            {r.canAlways && <button type="button" style={btn()} onClick={() => answer(r, 'always')}>Always for this skill</button>}
            <button type="button" style={btn()} onClick={() => answer(r, 'no')}>No</button>
          </div>
        </div>
      ))}
    </div>
  );
}
