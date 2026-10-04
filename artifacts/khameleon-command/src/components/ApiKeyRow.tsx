import { useState } from 'react';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { saveApiKey, clearApiKey } from '@/lib/jarvisApi';
import type { ApiKeyProviderDef } from '@/lib/apiKeyProviders';
import type { QuotaSnapshot } from '@/lib/quotaApi';

function secondsAgo(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

/**
 * Real per-minute rate-limit numbers Anthropic/OpenAI returned on their
 * last actual response (quotaApi.ts/providerQuota.ts) - not a guessed
 * "typical limit" and not overall spend/budget, which neither provider
 * exposes via API. Only rendered when at least one real number came back.
 */
function QuotaLine({ quota }: { quota: QuotaSnapshot }) {
  const parts: string[] = [];
  if (quota.requestsRemaining !== undefined && quota.requestsLimit !== undefined) {
    parts.push(`${quota.requestsRemaining.toLocaleString()} / ${quota.requestsLimit.toLocaleString()} requests`);
  }
  if (quota.tokensRemaining !== undefined && quota.tokensLimit !== undefined) {
    parts.push(`${quota.tokensRemaining.toLocaleString()} / ${quota.tokensLimit.toLocaleString()} tokens`);
  }
  if (parts.length === 0) return null;
  return (
    <div style={{ marginTop: 6, fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-text-faint)' }}>
      RATE LIMIT (per-minute window) — {parts.join(' · ')} remaining, as of {secondsAgo(quota.capturedAt)}
    </div>
  );
}

/**
 * A single provider's API key entry row: status, input, save/clear.
 * Split out of pages/settings.tsx (lazy-loaded) so OnboardingWizard -
 * mounted eagerly at the app root - can reuse it without pulling the
 * whole Settings page bundle into the main chunk.
 */
export function ApiKeyRow({ def, isSet, onSaved, onCleared, quota }: {
  def: ApiKeyProviderDef;
  isSet: boolean;
  onSaved: () => void;
  onCleared: () => void;
  quota?: QuotaSnapshot;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy]   = useState(false);
  const [msg, setMsg]     = useState<string | null>(null);

  const save = async () => {
    if (!value.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await saveApiKey(def.id, value.trim());
      setValue('');
      setMsg('Saved.');
      onSaved();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed to save key');
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await clearApiKey(def.id);
      onCleared();
    } catch {
      setMsg('Failed to clear key');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      padding: '14px 16px', marginBottom: 10,
      background: isSet ? 'rgba(0,212,255,0.04)' : 'rgba(0,4,8,0.6)',
      border: `1px solid ${isSet ? 'rgba(0,212,255,0.25)' : 'rgba(0,212,255,0.1)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 13, fontWeight: 700, color: 'var(--j-text)', letterSpacing: '0.05em' }}>
          {def.label}
        </span>
        {isSet ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--j-font-ui)', fontSize: 10, color: 'var(--j-green)' }}>
            <CheckCircle size={12} /> KEY SET
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--j-font-ui)', fontSize: 10, color: 'var(--j-text-faint)' }}>
            <XCircle size={12} /> NOT SET
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="password"
          className="j-input"
          placeholder={isSet ? 'Enter a new key to replace it' : def.placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ flex: 1 }}
        />
        <button onClick={save} disabled={busy || !value.trim()} className="j-btn-primary"
          style={{ height: 32, padding: '0 14px', fontSize: 11, opacity: busy || !value.trim() ? 0.5 : 1 }}>
          {busy ? <Loader size={11} /> : 'SAVE'}
        </button>
        {isSet && (
          <button onClick={clear} disabled={busy} style={{
            height: 32, padding: '0 14px', fontSize: 10, fontFamily: 'var(--j-font-ui)',
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
            background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.35)',
            color: '#f87171', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1,
          }}>
            CLEAR
          </button>
        )}
      </div>
      <div style={{ marginTop: 6, fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-text-faint)' }}>
        Get a key at {def.helpUrl}
      </div>
      {isSet && quota && <QuotaLine quota={quota} />}
      {msg && (
        <div style={{ marginTop: 6, fontFamily: 'var(--j-font-mono)', fontSize: 11, color: msg === 'Saved.' ? 'var(--j-green)' : '#f87171' }}>
          {msg}
        </div>
      )}
    </div>
  );
}
