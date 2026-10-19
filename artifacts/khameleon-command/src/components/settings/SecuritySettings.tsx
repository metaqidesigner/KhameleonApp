import { useEffect, useState } from 'react';
import { GUARDRAILS } from '@/lib/guardrails';
import { getSessionStatus, logout, type SessionStatus } from '@/lib/sessionApi';
import { listAccounts, setAccountActive, type Account } from '@/lib/accountsApi';
import { useUi, Label, Hint, Msg, Group, type Tone } from './ui';
import { KHAMI_HOME } from '@/lib/where';

/**
 * Settings > Security and Account (gap review Q10, Q1): the protections
 * Khameleon runs (read-only), and - only when team accounts are on - who's
 * signed in, signing out, and (admins) turning accounts on or off.
 */
export function SecuritySettings({ tone }: { tone: Tone }) {
  const { t, btn } = useUi(tone);
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    getSessionStatus().then(s => {
      setSession(s);
      if (s.mode === 'accounts' && s.user?.isAdmin) listAccounts().then(setAccounts).catch(() => {});
    }).catch(() => {});
  }, []);

  const toggle = async (a: Account) => {
    setMsg(null);
    try { const u = await setAccountActive(a.id, !a.active); setAccounts(list => list.map(x => (x.id === u.id ? u : x))); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Couldn\'t change the account' }); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {session?.mode === 'accounts' && session.user && (
        <Group>
          <Label tone={tone}>Account</Label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, fontSize: 12.5 }}>{session.user.displayName || session.user.email}{session.user.isAdmin ? ' (admin)' : ''}</span>
            <button type="button" style={btn()} onClick={() => void logout().then(() => window.location.reload())}>Sign out</button>
          </div>
          {accounts.length > 0 && (
            <>
              <Hint tone={tone}>Team accounts - turn one off to stop it signing in.</Hint>
              {accounts.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ flex: 1, color: a.active ? t.text : t.muted }}>{a.displayName || a.email}{a.isAdmin ? ' (admin)' : ''}</span>
                  {a.id !== session.user!.id && <button type="button" style={btn()} onClick={() => void toggle(a)}>{a.active ? 'Turn off' : 'Turn on'}</button>}
                </div>
              ))}
            </>
          )}
        </Group>
      )}
      {session?.mode === 'password' && session.authRequired && (
        <Group>
          <Label tone={tone}>Sign-in</Label>
          <div><button type="button" style={btn()} onClick={() => void logout().then(() => window.location.reload())}>Sign out</button></div>
        </Group>
      )}
      <Group>
        <Label tone={tone}>Protections</Label>
        {GUARDRAILS.map(g => (
          <div key={g.label} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span style={{ fontSize: 12, color: g.implemented ? t.good : t.muted, flexShrink: 0 }}>{g.implemented ? 'On' : 'Not built'}</span>
            <div>
              <div style={{ fontSize: 12.5 }}>{g.label}</div>
              {g.note && <div style={{ fontSize: 11, color: t.muted }}>{g.note}</div>}
            </div>
          </div>
        ))}
        <Hint tone={tone}>Khami works {KHAMI_HOME}, so what it reads stays there. Actions Khameleon takes for you are recorded in the activity log.</Hint>
      </Group>
      {msg && <Msg tone={tone} ok={msg.ok}>{msg.text}</Msg>}
    </div>
  );
}
