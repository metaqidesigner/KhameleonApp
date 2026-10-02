import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { getSessionStatus, login, loginWithAccount, type SessionStatus } from '@/lib/sessionApi';

/**
 * Account isolation: renders nothing of the real app until whichever gate
 * is active passes. A no-op wrapper - children mount immediately - unless
 * an operator has set KHAMELEON_APP_PASSWORD (Option A,
 * khameleon-decisions-log.md, 2026-10-01) or created a real account
 * (Option B, 2026-10-03) - matching the server-side gate's same opt-in
 * default either way (lib/session.ts). Option B wins once any account
 * exists, so the form here switches from a single shared password to a
 * real email/password login the same way the server does.
 */
export function LoginGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'locked' | 'open'>('checking');
  const [mode, setMode] = useState<SessionStatus['mode']>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSessionStatus()
      .then(s => {
        setMode(s.mode);
        setStatus(!s.authRequired || s.authenticated ? 'open' : 'locked');
      })
      .catch(() => setStatus('open')); // fail open - matches the server gate's own fail-open default when unconfigured
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'accounts') await loginWithAccount(email, password);
      else await login(password);
      setStatus('open');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'checking') return null;
  if (status === 'open') return <>{children}</>;

  const canSubmit = mode === 'accounts' ? email.trim().length > 0 && password.length > 0 : password.length > 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(4px)',
    }}>
      <form onSubmit={submit} style={{
        position: 'relative', width: 360, padding: 28,
        background: 'rgba(2,10,22,0.98)', border: '1px solid rgba(0,212,255,0.35)',
        boxShadow: '0 0 40px rgba(0,212,255,0.12), inset 0 0 60px rgba(0,212,255,0.03)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <Lock size={14} color="var(--j-cyan)" />
          <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: 'var(--j-cyan)' }}>
            KHAMELEON LOCKED
          </span>
        </div>
        <p style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, color: '#b8d4e8', lineHeight: 1.6, marginBottom: 14 }}>
          {mode === 'accounts' ? 'Log in with your account to continue.' : 'This instance requires a password to continue.'}
        </p>
        {mode === 'accounts' && (
          <input
            className="j-input"
            type="email"
            placeholder="Email"
            autoFocus
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ marginBottom: 10 }}
          />
        )}
        <input
          className="j-input"
          type="password"
          placeholder="Password"
          autoFocus={mode !== 'accounts'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        {error && (
          <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 10, color: 'var(--j-red)', marginBottom: 10 }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={busy || !canSubmit}
          style={{
            width: '100%', padding: '10px 0',
            background: busy || !canSubmit ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, rgba(0,212,255,0.8) 0%, rgba(0,150,200,0.8) 100%)',
            border: '1px solid rgba(0,212,255,0.6)', color: '#fff', fontFamily: 'var(--j-font-mono)',
            fontSize: 10, letterSpacing: '0.15em', fontWeight: 700,
            cursor: busy || !canSubmit ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? 'CHECKING…' : 'UNLOCK'}
        </button>
      </form>
    </div>
  );
}
