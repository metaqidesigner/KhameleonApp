import React, { useCallback, useEffect, useState } from 'react';
import { Shield, Lock, LogOut } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { useJarvisStore } from '@/store/jarvisStore';
import { getApiKeyStatus, clearApiKey, type ApiKeyProvider, type ApiKeyStatus } from '@/lib/jarvisApi';
import { getSessionStatus, logout, signup, type SessionStatus } from '@/lib/sessionApi';

/**
 * Real guardrails only get an ACTIVE badge - this page used to show all
 * five as unconditionally ACTIVE regardless of what existed, which is a
 * security status page fabricating security status. All five are real as
 * of 2026-10-01 (khameleon-decisions-log.md): File Policy and a rate
 * limiter were added to agents/tools/{shell,rateLimiter}.ts guarding
 * dispatcher.ts (the one choke point every agent tool call passes
 * through), and an injection-content wrapper was added to webFetch.ts.
 * `note` is shown for the three that are real-but-bounded mitigations,
 * not absolute guarantees - so the badge doesn't overclaim either.
 */
const GUARDRAILS: { label: string; implemented: boolean; note?: string }[] = [
  { label: 'Injection Scanner', implemented: true, note: 'Pattern-based heuristic on fetched web content, not a complete defense' },
  { label: 'Rate Limiter', implemented: true, note: '20 write/command calls, 100 read calls, per 5 min (global)' },
  { label: 'File Policy', implemented: true, note: 'Path/size restrictions on agent file read/write and shell commands' },
  { label: 'SSRF Protection', implemented: true },
  { label: 'Audit Log', implemented: true },
];

interface KeyDef { id: ApiKeyProvider; label: string }
const KEYS: KeyDef[] = [
  { id: 'anthropic', label: 'ANTHROPIC_API_KEY' },
  { id: 'openai', label: 'OPENAI_API_KEY' },
  { id: 'google', label: 'GOOGLE_API_KEY' },
  { id: 'openrouter', label: 'OPENROUTER_API_KEY' },
  { id: 'minimax', label: 'MINIMAX_API_KEY' },
];

export default function Security() {
  const agentHistory = useJarvisStore(s => s.agentHistory);
  const [keySet, setKeySet] = useState<ApiKeyStatus>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupBusy, setSignupBusy] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupDone, setSignupDone] = useState(false);

  const refresh = useCallback(() => {
    getApiKeyStatus().then(setKeySet);
    getSessionStatus().then(setSession).catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      window.location.reload();
    } finally {
      setLoggingOut(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupBusy(true);
    setSignupError(null);
    try {
      await signup(signupEmail, signupPassword, signupName);
      setSignupEmail(''); setSignupPassword(''); setSignupName('');
      setSignupDone(true);
      refresh();
      // Bootstrapping the very first account logs the browser in as that
      // account immediately (routes/auth.ts) - reload so the rest of the
      // app (now gated by Option B) mounts in its logged-in state.
      if (session?.mode === 'password') window.location.reload();
    } catch (err) {
      setSignupError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setSignupBusy(false);
    }
  };

  const revoke = async (id: ApiKeyProvider) => {
    setBusy(b => ({ ...b, [id]: true }));
    try {
      await clearApiKey(id);
      refresh();
    } finally {
      setBusy(b => ({ ...b, [id]: false }));
    }
  };

  return (
    <div style={{ display:'grid', gridTemplateColumns:'40% 60%', gap:6, height:'100%', padding:8 }}>
      {/* Left */}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <JPanel title="ACCESS CONTROL" icon={<Lock size={13}/>}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: session?.authRequired ? 10 : 0 }}>
            <span style={{ fontFamily:'var(--j-font-ui)', fontSize:12, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--j-text)' }}>
              {session?.mode === 'accounts' ? 'Real accounts' : 'Shared password gate'}
            </span>
            <span className={`j-badge ${session?.authRequired ? 'j-badge-green' : 'j-badge-red'}`}>
              {session === null ? '…' : session.authRequired ? '● ON' : '✕ OFF'}
            </span>
          </div>
          <p style={{ fontFamily:'var(--j-font-ui)', fontSize:11, color:'var(--j-text-muted)', lineHeight:1.5, margin:0 }}>
            {session?.mode === 'accounts'
              ? `Logged in as ${session.user?.email ?? '…'}${session.user?.isAdmin ? ' (admin)' : ''}. OAuth connections, API keys, and Vault items are isolated per account — the shared task/project workspace is still common to everyone on this instance (see khameleon-decisions-log.md, 2026-10-03).`
              : session?.authRequired
                ? 'Anyone without the password is refused access. Everyone who logs in shares the same data — this is not per-account separation (see SELF_HOSTING.md).'
                : 'No password set — anyone who reaches this URL has full access. Set KHAMELEON_APP_PASSWORD (see SELF_HOSTING.md) before exposing this beyond your own network.'}
          </p>
          {session?.authRequired && (
            <button
              className="j-btn-ghost"
              style={{ height:26, padding:'0 10px', fontSize:9, marginTop:10, display:'flex', alignItems:'center', gap:6, opacity: loggingOut ? 0.5 : 1 }}
              disabled={loggingOut}
              onClick={handleLogout}
            >
              <LogOut size={10} />{loggingOut ? 'LOGGING OUT…' : 'LOG OUT'}
            </button>
          )}

          {(session?.mode === 'password' || (session?.mode === 'accounts' && session.user?.isAdmin)) && (
            <form onSubmit={handleSignup} style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontFamily:'var(--j-font-ui)', fontSize:11, fontWeight:600, color:'var(--j-text)', marginBottom: 8 }}>
                {session.mode === 'password' ? 'Set up real accounts' : 'Add another account'}
              </div>
              {session.mode === 'password' && (
                <p style={{ fontFamily:'var(--j-font-ui)', fontSize:10, color:'var(--j-text-muted)', lineHeight:1.5, margin:'0 0 8px' }}>
                  Replaces the shared password with named logins. The first account created here becomes this instance's admin.
                </p>
              )}
              <input className="j-input" type="text" placeholder="Display name" value={signupName} onChange={e => setSignupName(e.target.value)} style={{ marginBottom: 6, height: 28, fontSize: 11 }} />
              <input className="j-input" type="email" placeholder="Email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} style={{ marginBottom: 6, height: 28, fontSize: 11 }} />
              <input className="j-input" type="password" placeholder="Password (min. 8 characters)" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} style={{ marginBottom: 8, height: 28, fontSize: 11 }} />
              {signupError && <div style={{ fontFamily:'var(--j-font-mono)', fontSize:10, color:'var(--j-red)', marginBottom:8 }}>{signupError}</div>}
              {signupDone && session.mode === 'accounts' && <div style={{ fontFamily:'var(--j-font-mono)', fontSize:10, color:'var(--j-green)', marginBottom:8 }}>Account created.</div>}
              <button
                type="submit"
                className="j-btn-ghost"
                disabled={signupBusy || !signupEmail.trim() || signupPassword.length < 8}
                style={{ height:26, padding:'0 10px', fontSize:9, opacity: signupBusy || !signupEmail.trim() || signupPassword.length < 8 ? 0.5 : 1 }}
              >
                {signupBusy ? 'CREATING…' : session.mode === 'password' ? 'CREATE ADMIN ACCOUNT' : 'CREATE ACCOUNT'}
              </button>
            </form>
          )}
        </JPanel>

        <JPanel title="CREDENTIAL VAULT STATUS" icon={<Lock size={13}/>}>
          <table className="j-table">
            <thead className="j-table-header">
              <tr><th>KEY</th><th>STATUS</th><th>ACTION</th></tr>
            </thead>
            <tbody>
              {KEYS.map(k => (
                <tr key={k.id}>
                  <td className="j-mono" style={{ fontSize:10 }}>{k.label}</td>
                  <td>
                    <span className={`j-badge ${keySet[k.id] ? 'j-badge-green' : 'j-badge-red'}`}>
                      {keySet[k.id] ? '● SET' : '✕ NOT SET'}
                    </span>
                  </td>
                  <td>
                    {keySet[k.id] && (
                      <button
                        className="j-btn-ghost"
                        style={{ height:22, padding:'0 8px', fontSize:9, opacity: busy[k.id] ? 0.5 : 1 }}
                        disabled={busy[k.id]}
                        onClick={() => revoke(k.id)}
                      >
                        {busy[k.id] ? '…' : 'REVOKE'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </JPanel>

        <JPanel
          title="GUARDRAILS"
          icon={<Shield size={13}/>}
          headerVariant="amber"
          badge={`${GUARDRAILS.filter(g => g.implemented).length}/${GUARDRAILS.length} ACTIVE`}
        >
          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            {GUARDRAILS.map(g => (
              <div key={g.label} style={{ padding:'8px 0', borderBottom:'1px solid rgba(0,212,255,0.06)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontFamily:'var(--j-font-ui)', fontSize:12, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--j-text)' }}>{g.label}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{
                      width:6, height:6, borderRadius:'50%',
                      background: g.implemented ? 'var(--j-green)' : 'var(--j-text-faint)',
                      animation: g.implemented ? 'jarvis-pulse 2s ease-in-out infinite' : 'none',
                    }}/>
                    <span className="j-mono" style={{ fontSize:10, color: g.implemented ? 'var(--j-green)' : 'var(--j-text-faint)' }}>
                      {g.implemented ? 'ACTIVE' : 'NOT IMPLEMENTED'}
                    </span>
                  </div>
                </div>
                {g.note && (
                  <div style={{ marginTop:4, fontFamily:'var(--j-font-mono)', fontSize:9, color:'var(--j-text-faint)' }}>
                    {g.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        </JPanel>
      </div>

      {/* Right: Audit log */}
      <JPanel title="SECURITY AUDIT LOG — LAST 24H" icon={<Shield size={13}/>}>
        {agentHistory.length === 0 ? (
          <div className="j-empty">NO AUDIT EVENTS — ACTIVITY WILL APPEAR HERE</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table className="j-table">
              <thead className="j-table-header">
                <tr><th>TIMESTAMP</th><th>AGENT</th><th>ACTION</th><th>TOKENS</th><th>STATUS</th></tr>
              </thead>
              <tbody>
                {agentHistory.map(ev => (
                  <tr key={ev.id} style={{ animation:'jarvis-fadein 0.25s ease both' }}>
                    <td className="j-mono" style={{ fontSize:9, color:'var(--j-text-muted)' }}>
                      {new Date(ev.ts).toLocaleTimeString('en-US',{ hour12:false })}
                    </td>
                    <td><span className="j-badge j-badge-red" style={{ fontSize:8 }}>{ev.agent}</span></td>
                    <td style={{ fontFamily:'var(--j-font-ui)', fontSize:11, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.prompt}</td>
                    <td className="j-mono" style={{ fontSize:10 }}>{ev.tokens ?? '—'}</td>
                    <td><span className="j-badge j-badge-green" style={{ fontSize:8 }}>SUCCESS</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </JPanel>
    </div>
  );
}
