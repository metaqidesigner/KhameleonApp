import React, { useCallback, useEffect, useState } from 'react';
import { Settings as SettingsIcon, Plug, CheckCircle, XCircle, Loader, Clock, KeyRound, MapPin, Music, Play, Pause, SkipForward, SkipBack, Mic } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { useJarvisStore } from '@/store/jarvisStore';
import { MIC_KEY } from '@/components/orb/VoiceController';
import { ConnectIntegrationGate } from '@/components/ConnectIntegrationGate';
import { ApiKeyRow } from '@/components/ApiKeyRow';
import { API_KEY_PROVIDER_DEFS, PROVIDERS, type ProviderDef } from '@/lib/apiKeyProviders';
import {
  getHealth, getSchedulerStatus, saveSchedulerConfig, type SchedulerStatus,
  getApiKeyStatus, type ApiKeyStatus,
  getWeatherDefault, saveWeatherDefault, getWeatherCurrent, type WeatherCurrent,
  getSpotifyNowPlaying, spotifyPlay, spotifyPause, spotifyNext, spotifyPrevious, type SpotifyNowPlaying,
  getOnboardingStatus, saveProfile, type Profile,
} from '@/lib/jarvisApi';

type Section = 'GENERAL' | 'ENGINE' | 'API KEYS' | 'APPEARANCE' | 'VOICE' | 'CONNECTORS' | 'MEMORY' | 'TELEMETRY' | 'ADVANCED';
const SECTIONS: Section[] = ['GENERAL', 'ENGINE', 'API KEYS', 'APPEARANCE', 'VOICE', 'CONNECTORS', 'MEMORY', 'TELEMETRY', 'ADVANCED'];

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      fontFamily: 'var(--j-font-ui)', fontSize: 11, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.12em',
      color: 'var(--j-text-muted)', display: 'block', marginBottom: 4,
    }}>
      {children}
    </label>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 16 }}>{children}</div>;
}
/**
 * A handful of fields on this page (workspace name/language, the local-
 * engine picker, font size, memory/telemetry/advanced tuning) had no
 * onChange or save path at all - `defaultValue`/`defaultChecked` inputs
 * that accepted keystrokes into a void, styled identically to the real,
 * store- or backend-backed controls right next to them. Marks a field
 * honestly as not yet wired to anything, instead of letting it look like
 * every other working control on the page.
 */
function NotYetWired({ children }: { children?: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-text-faint)',
      marginTop: 4, display: 'flex', alignItems: 'center', gap: 4,
    }}>
      <span>○</span> {children ?? 'Not yet configurable — no effect'}
    </div>
  );
}
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} style={{
      width: 40, height: 20,
      background: value ? 'rgba(0,212,255,0.2)' : 'rgba(0,0,0,0.5)',
      border: `1px solid ${value ? 'var(--j-cyan)' : 'rgba(0,212,255,0.2)'}`,
      cursor: 'pointer', position: 'relative', flexShrink: 0,
    }}>
      <span style={{
        position: 'absolute', top: 3, left: value ? 22 : 3,
        width: 12, height: 12,
        background: value ? 'var(--j-cyan)' : 'var(--j-text-faint)',
        transition: 'left 0.15s',
      }} />
    </button>
  );
}

// ── Connectors ────────────────────────────────────────────────────────────────

// ProviderDef / PROVIDERS moved to lib/apiKeyProviders.ts so
// OnboardingWizard (mounted eagerly at the app root) can reuse them
// without pulling this lazy-loaded page's bundle into the main chunk.

function ConnectorsSection() {
  const [statuses, setStatuses]   = useState<Record<string, boolean>>({});
  const [loading, setLoading]     = useState<Record<string, boolean>>({});
  const [banner, setBanner]       = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  // §16.3: connecting is always a hard gate, no exceptions - this used to
  // jump straight to the OAuth redirect below with nothing shown first.
  const [gateFor, setGateFor] = useState<ProviderDef | null>(null);

  const fetchStatuses = useCallback(async () => {
    const results = await Promise.all(
      PROVIDERS.map(p =>
        fetch(`/api/auth/oauth/${p.id}/status`)
          .then(r => r.json() as Promise<{ connected: boolean }>)
          .then(j => [p.id, j.connected] as [string, boolean])
          .catch(() => [p.id, false] as [string, boolean])
      )
    );
    setStatuses(Object.fromEntries(results));
  }, []);

  useEffect(() => {
    // Check for OAuth redirect result in URL
    const params = new URLSearchParams(window.location.search);
    const success = params.get('oauth_success');
    const error   = params.get('oauth_error');
    if (success) {
      setBanner({ type: 'success', msg: `✓ ${success.charAt(0).toUpperCase() + success.slice(1)} connected successfully` });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      setBanner({ type: 'error', msg: `✕ Connection failed: ${error}` });
      window.history.replaceState({}, '', window.location.pathname);
    }
    fetchStatuses();
  }, [fetchStatuses]);

  const connect = (p: ProviderDef) => {
    setGateFor(p);
  };

  const disconnect = async (p: ProviderDef) => {
    setLoading(l => ({ ...l, [p.id]: true }));
    try {
      await fetch(`/api/auth/oauth/${p.id}`, { method: 'DELETE' });
      await fetchStatuses();
      setBanner({ type: 'success', msg: `${p.label} disconnected` });
    } catch {
      setBanner({ type: 'error', msg: `Failed to disconnect ${p.label}` });
    } finally {
      setLoading(l => ({ ...l, [p.id]: false }));
    }
  };

  return (
    <>
      {banner && (
        <div style={{
          marginBottom: 16, padding: '10px 14px',
          background: banner.type === 'success' ? 'rgba(0,212,255,0.08)' : 'rgba(220,38,38,0.1)',
          border: `1px solid ${banner.type === 'success' ? 'rgba(0,212,255,0.3)' : 'rgba(220,38,38,0.3)'}`,
          fontFamily: 'var(--j-font-ui)', fontSize: 12,
          color: banner.type === 'success' ? 'var(--j-cyan)' : '#f87171',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{banner.msg}</span>
          <button onClick={() => setBanner(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )}

      <p style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'var(--j-text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
        Connect external accounts to pull real email and calendar data into Khameleon.
        Credentials must be added as Replit Secrets before connecting. Access and refresh
        tokens are encrypted at rest once connected (see API KEYS for the encryption key setup).
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {PROVIDERS.map(p => {
          const connected = statuses[p.id] ?? false;
          const busy      = loading[p.id] ?? false;
          return (
            <React.Fragment key={p.id}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px',
              background: connected ? 'rgba(0,212,255,0.04)' : 'rgba(0,4,8,0.6)',
              border: `1px solid ${connected ? 'rgba(0,212,255,0.25)' : 'rgba(0,212,255,0.1)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: connected ? 'var(--j-green)' : 'var(--j-text-faint)',
                  boxShadow: connected ? '0 0 6px var(--j-green)' : 'none',
                  flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontFamily: 'var(--j-font-ui)', fontSize: 13, fontWeight: 700, color: 'var(--j-text)', letterSpacing: '0.05em' }}>
                    {p.label}
                  </div>
                  <div style={{ fontFamily: 'var(--j-font-ui)', fontSize: 10, color: 'var(--j-text-muted)', marginTop: 2 }}>
                    {p.covers}
                  </div>
                  {!connected && (
                    <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'rgba(201,168,76,0.7)', marginTop: 4 }}>
                      Requires: {p.credentials}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {connected ? (
                  <>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--j-font-ui)', fontSize: 10, color: 'var(--j-green)' }}>
                      <CheckCircle size={12} /> CONNECTED
                    </span>
                    <button
                      onClick={() => disconnect(p)}
                      disabled={busy}
                      style={{
                        padding: '6px 14px', fontSize: 10, fontFamily: 'var(--j-font-ui)',
                        fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                        background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.35)',
                        color: '#f87171', cursor: busy ? 'not-allowed' : 'pointer',
                        opacity: busy ? 0.5 : 1,
                      }}
                    >
                      {busy ? <Loader size={10} /> : 'DISCONNECT'}
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--j-font-ui)', fontSize: 10, color: 'var(--j-text-faint)' }}>
                      <XCircle size={12} /> OFFLINE
                    </span>
                    <button
                      onClick={() => connect(p)}
                      style={{
                        padding: '6px 14px', fontSize: 10, fontFamily: 'var(--j-font-ui)',
                        fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                        background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.35)',
                        color: 'var(--j-cyan)', cursor: 'pointer',
                      }}
                    >
                      CONNECT
                    </button>
                  </>
                )}
              </div>
            </div>
            {p.id === 'spotify' && connected && <SpotifyNowPlayingRow />}
            </React.Fragment>
          );
        })}
      </div>

      <WeatherLocationRow />

      <div style={{ marginTop: 24, padding: '12px 14px', background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.2)' }}>
        <div style={{ fontFamily: 'var(--j-font-ui)', fontSize: 10, fontWeight: 700, color: '#c9a84c', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          ⚠ Credential Setup Required
        </div>
        <div style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'var(--j-text-muted)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--j-text)' }}>Google:</strong> Create an OAuth Client ID at <span style={{ color: 'var(--j-cyan)' }}>console.cloud.google.com</span> → APIs &amp; Services → Credentials, then add GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET as Replit Secrets.<br />
          <strong style={{ color: 'var(--j-text)' }}>Microsoft:</strong> Register an app at <span style={{ color: 'var(--j-cyan)' }}>portal.azure.com</span> → Azure Active Directory → App registrations, then add MICROSOFT_CLIENT_ID + MICROSOFT_CLIENT_SECRET as Replit Secrets.<br />
          <strong style={{ color: 'var(--j-text)' }}>Spotify:</strong> Create an app at <span style={{ color: 'var(--j-cyan)' }}>developer.spotify.com/dashboard</span>, then add SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET as Replit Secrets. Weather needs no credentials — just a location, below.
        </div>
      </div>

      {gateFor && (
        <ConnectIntegrationGate
          providerId={gateFor.id}
          name={gateFor.label}
          dataScope={gateFor.dataScope}
          actionScope={gateFor.actionScope}
          onCancel={() => setGateFor(null)}
        />
      )}
    </>
  );
}

// ── Spotify now playing ──────────────────────────────────────────────────────
// The Spotify connector row above only ever promised a status dot - the
// actual "now playing + playback control" it advertises had no UI anywhere
// until now. Polls every 8s while mounted (i.e. while connected), which is
// frequent enough to feel live without hammering the Spotify API.

export function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function SpotifyNowPlayingRow() {
  const [state, setState]   = useState<SpotifyNowPlaying | null>(null);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const refresh = useCallback(() => {
    getSpotifyNowPlaying().then(setState);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 8000);
    return () => clearInterval(interval);
  }, [refresh]);

  const control = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      // Spotify's own state takes a moment to update after a control call.
      setTimeout(refresh, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Playback control failed');
    } finally {
      setBusy(false);
    }
  };

  if (!state) return null;

  return (
    <div style={{
      marginTop: -1, padding: '12px 16px',
      background: 'rgba(0,212,255,0.02)',
      border: '1px solid rgba(0,212,255,0.15)', borderTop: 'none',
    }}>
      {!state.playing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'var(--j-text-muted)' }}>
          <Music size={13} /> Nothing playing right now
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {state.albumArt && (
            <img src={state.albumArt} alt="" width={40} height={40} style={{ borderRadius: 3, flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, fontWeight: 700, color: 'var(--j-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {state.track}
            </div>
            <div style={{ fontFamily: 'var(--j-font-ui)', fontSize: 10, color: 'var(--j-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {state.artists?.join(', ')}
              {state.durationMs != null && state.progressMs != null && (
                <span> — {formatMs(state.progressMs)} / {formatMs(state.durationMs)}</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {[
              { icon: <SkipBack size={13} />, action: spotifyPrevious, label: 'Previous' },
              { icon: <Pause size={13} />, action: spotifyPause, label: 'Pause' },
              { icon: <Play size={13} />, action: spotifyPlay, label: 'Play' },
              { icon: <SkipForward size={13} />, action: spotifyNext, label: 'Next' },
            ].map(({ icon, action, label }) => (
              <button
                key={label}
                onClick={() => control(action)}
                disabled={busy}
                title={label}
                style={{
                  width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 3,
                  color: 'var(--j-cyan)', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1,
                }}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <div style={{ marginTop: 6, fontFamily: 'var(--j-font-mono)', fontSize: 10, color: '#f87171' }}>{error}</div>}
    </div>
  );
}

// ── Weather default location ────────────────────────────────────────────────
// Weather has no OAuth "connect" step (Open-Meteo needs no API key) — the only
// thing to set up is where. Lives in the Connectors section since it's the
// same "app I want Khameleon to reach into" mental model as the OAuth rows above.

function WeatherLocationRow() {
  const [lat, setLat]     = useState('');
  const [lon, setLon]     = useState('');
  const [label, setLabel] = useState('');
  const [saved, setSaved] = useState<{ lat: number; lon: number; label: string | null } | null>(null);
  const [busy, setBusy]   = useState(false);
  const [msg, setMsg]     = useState<string | null>(null);
  const [current, setCurrent] = useState<WeatherCurrent | null>(null);

  useEffect(() => {
    getWeatherDefault().then((loc) => {
      if (loc.lat != null && loc.lon != null) {
        setSaved({ lat: loc.lat, lon: loc.lon, label: loc.label });
        setLat(String(loc.lat));
        setLon(String(loc.lon));
        setLabel(loc.label ?? '');
      }
    });
  }, []);

  // Once a default location exists (on load, or right after saving one),
  // show what it's actually reporting right now - not just "SET".
  useEffect(() => {
    if (saved) getWeatherCurrent().then(setCurrent);
    else setCurrent(null);
  }, [saved]);

  const save = async () => {
    const latNum = Number(lat);
    const lonNum = Number(lon);
    if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90 || !Number.isFinite(lonNum) || lonNum < -180 || lonNum > 180) {
      setMsg('Enter a valid latitude (-90..90) and longitude (-180..180).');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const result = await saveWeatherDefault(latNum, lonNum, label || undefined);
      setSaved({ lat: result.lat ?? latNum, lon: result.lon ?? lonNum, label: result.label ?? null });
      setMsg('Saved.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed to save location');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      marginTop: 12, padding: '14px 16px',
      background: saved ? 'rgba(0,212,255,0.04)' : 'rgba(0,4,8,0.6)',
      border: `1px solid ${saved ? 'rgba(0,212,255,0.25)' : 'rgba(0,212,255,0.1)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <MapPin size={12} color="var(--j-cyan)" />
        <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 13, fontWeight: 700, color: 'var(--j-text)', letterSpacing: '0.05em' }}>
          Weather — Default Location
        </span>
        {saved && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--j-font-ui)', fontSize: 10, color: 'var(--j-green)', marginLeft: 'auto' }}>
            <CheckCircle size={12} /> SET
          </span>
        )}
      </div>
      {current && (
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10,
          fontFamily: 'var(--j-font-ui)', fontSize: 12, color: 'var(--j-text)',
        }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{Math.round(current.temperatureC)}°C</span>
          <span style={{ color: 'var(--j-text-muted)' }}>{current.conditions}</span>
          <span style={{ color: 'var(--j-text-faint)', fontSize: 10 }}>feels like {Math.round(current.feelsLikeC)}°C</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input className="j-input" placeholder="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} style={{ flex: 1 }} />
        <input className="j-input" placeholder="Longitude" value={lon} onChange={(e) => setLon(e.target.value)} style={{ flex: 1 }} />
        <input className="j-input" placeholder="Label (optional, e.g. Home)" value={label} onChange={(e) => setLabel(e.target.value)} style={{ flex: 1.4 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={save}
          disabled={busy || !lat || !lon}
          className="j-btn-primary"
          style={{ height: 32, padding: '0 14px', fontSize: 11, opacity: busy || !lat || !lon ? 0.5 : 1 }}
        >
          {busy ? <Loader size={11} /> : 'SAVE LOCATION'}
        </button>
        {msg && <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 11, color: msg === 'Saved.' ? 'var(--j-green)' : '#f87171' }}>{msg}</span>}
      </div>
    </div>
  );
}

// ── API Keys ─────────────────────────────────────────────────────────────────
// Model-provider credentials the user types in directly, as opposed to the
// OAuth "Connect" buttons above. Saving here makes Khameleon's agents usable
// without the server operator having to set environment variables.

// ApiKeyProviderDef / API_KEY_PROVIDER_DEFS moved to lib/apiKeyProviders.ts,
// ApiKeyRow moved to components/ApiKeyRow.tsx - both now imported below -
// so OnboardingWizard (mounted eagerly at the app root) can reuse them
// without pulling this lazy-loaded page's bundle into the main chunk.

function ApiKeysSection() {
  const [statuses, setStatuses] = useState<ApiKeyStatus>({});
  const [encryptionConfigured, setEncryptionConfigured] = useState<boolean | null>(null);

  const refresh = useCallback(() => {
    getApiKeyStatus().then(setStatuses);
    getOnboardingStatus().then((s) => setEncryptionConfigured(s.encryptionConfigured));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <>
      <p style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'var(--j-text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
        Enter your own API key for any model provider you want Khameleon's agents to use.
        Keys are encrypted at rest (AES-256-GCM) before they're stored. At least one is
        required for agents to respond.
      </p>

      {encryptionConfigured === false && (
        <div style={{
          marginBottom: 16, padding: '12px 14px',
          background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.3)',
          fontFamily: 'var(--j-font-ui)', fontSize: 11, color: '#f87171', lineHeight: 1.7,
        }}>
          <strong>Encryption key not configured.</strong> Set <span style={{ fontFamily: 'var(--j-font-mono)' }}>KHAMELEON_ENCRYPTION_KEY</span> (16+ characters) as a Replit Secret and restart the server —
          saving a key below will fail until then. This is deliberate: Khameleon refuses to store credentials as plaintext rather than doing so silently.
        </div>
      )}

      {API_KEY_PROVIDER_DEFS.map((def) => (
        <ApiKeyRow key={def.id} def={def} isSet={!!statuses[def.id]} onSaved={refresh} onCleared={refresh} />
      ))}
    </>
  );
}

// ── Other sections ────────────────────────────────────────────────────────────

/**
 * This used to show ENGINE/MODEL/BASE URL fields for a single swappable
 * local-inference backend (ollama/vllm/sglang/llama.cpp/...) - but nothing
 * on the server reads them. `getHealth()`'s engine/model come back
 * hardcoded ("replit-ai") regardless of what's typed here, so "TEST
 * CONNECTION" always reported the same result no matter what the user
 * had just entered above it - actively implying the form was being
 * tested, when it never was. The app's real model configuration lives
 * in two other places: Agents > Settings (per-agent provider/model) and
 * Settings > API Keys (provider credentials) - this section now points
 * there and keeps only the one thing that was genuinely real: a live
 * health check against the server's primary gateway.
 */
function EngineSection() {
  const [result, setResult] = useState<string | null>(null);
  const test = async () => {
    const h = await getHealth();
    setResult(h.status === 'offline' ? '✕ OFFLINE — Check server configuration' : `● ONLINE — ${h.engine} · ${h.model}`);
  };
  return (
    <>
      <div style={{
        marginBottom: 16, padding: '10px 12px', fontFamily: 'var(--j-font-ui)', fontSize: 11,
        color: 'var(--j-text-muted)', lineHeight: 1.6,
        background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.1)',
      }}>
        Model configuration lives in <strong>Agents → Settings</strong> (per-agent provider and
        model) and <strong>API Keys</strong> (provider credentials) — there's no separate
        single-engine picker.
      </div>
      <button className="j-btn-primary" style={{ height: 36, padding: '0 16px', fontSize: 11 }} onClick={test}>
        ▶ CHECK SERVER STATUS
      </button>
      {result && (
        <div style={{
          marginTop: 10, fontFamily: 'var(--j-font-mono)', fontSize: 11,
          color: result.startsWith('●') ? 'var(--j-green)' : 'var(--j-red)',
          animation: 'jarvis-fadein 0.2s ease both',
        }}>{result}</div>
      )}
    </>
  );
}

function AppearanceSection() {
  const { scanLinesEnabled, setScanLines, cornerBracketsEnabled, setCornerBrackets, tickerSpeed, setTickerSpeed } = useJarvisStore();
  return (
    <>
      <Row>
        <Label>THEME</Label>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(0,4,8,0.6)', border: '1px solid rgba(0,212,255,0.15)' }}>
          <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, color: 'var(--j-text-muted)' }}>KHAMELEON REQUIRES DARK MODE</span>
          <Toggle value={true} onChange={() => {}} />
        </div>
      </Row>
      <Row>
        <Label>FONT SIZE</Label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[12, 13, 14].map(s => (
            <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--j-font-ui)', fontSize: 12, color: 'var(--j-text-faint)' }}>
              <input type="radio" name="fontsize" defaultChecked={s === 13} disabled style={{ accentColor: 'var(--j-cyan)' }} /> {s}px
            </label>
          ))}
        </div>
        {/* Font sizes are hardcoded px throughout index.css rather than driven
            by one root variable - making this real means a real refactor, not
            a quick wire-up, so it's disabled rather than pretending to work. */}
        <NotYetWired>Fixed at 13px — not yet adjustable</NotYetWired>
      </Row>
      <Row>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Label>SCAN LINES</Label><Toggle value={scanLinesEnabled} onChange={setScanLines} />
        </div>
      </Row>
      <Row>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Label>PANEL CORNERS</Label><Toggle value={cornerBracketsEnabled} onChange={setCornerBrackets} />
        </div>
      </Row>
      <Row>
        <Label>TICKER SPEED — {tickerSpeed}s</Label>
        <input type="range" min={30} max={120} value={tickerSpeed} onChange={e => setTickerSpeed(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--j-cyan)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-text-faint)', marginTop: 2 }}>
          <span>30s (FAST)</span><span>120s (SLOW)</span>
        </div>
      </Row>
    </>
  );
}

/**
 * Wake word / mic permission were completely inert for every user by
 * default: VoiceController's MicPermissionModal was fully built (real
 * onGranted/onSkipped wiring) but nothing ever called setShowModal(true)
 * to show it, and wakeWordActive had no toggle anywhere in the UI. Fixed
 * on the VoiceController side (a never-asked browser now sees the modal
 * on boot) and here: a real place to check status, re-open the prompt
 * after a skip/denial, and turn wake word on/off once granted.
 */
function VoiceSection() {
  const wakeWordActive           = useJarvisStore(s => s.wakeWordActive);
  const setWakeWordActive        = useJarvisStore(s => s.setWakeWordActive);
  const wakeWordBlocked          = useJarvisStore(s => s.wakeWordBlocked);
  const setMicPermissionModalOpen = useJarvisStore(s => s.setMicPermissionModalOpen);
  const [micStatus, setMicStatus] = useState<'granted' | 'denied' | 'unknown'>('unknown');

  useEffect(() => {
    const stored = localStorage.getItem(MIC_KEY);
    setMicStatus(stored === 'true' ? 'granted' : stored === 'denied' ? 'denied' : 'unknown');
  }, []);

  const inputAvailable = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  if (!inputAvailable) {
    return <NotYetWired>Voice input needs Chrome or Edge — not supported in this browser</NotYetWired>;
  }

  return (
    <>
      <Row>
        <Label>Microphone access</Label>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(0,4,8,0.6)', border: '1px solid rgba(0,212,255,0.15)' }}>
          <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 11, color: micStatus === 'granted' ? 'var(--j-green)' : micStatus === 'denied' ? 'var(--j-red)' : 'var(--j-text-muted)' }}>
            {micStatus === 'granted' ? '● GRANTED' : micStatus === 'denied' ? '✕ DENIED / SKIPPED' : '○ NOT YET ASKED'}
          </span>
          {micStatus !== 'granted' && (
            <button className="j-btn-ghost" style={{ height: 26, padding: '0 10px', fontSize: 10 }} onClick={() => setMicPermissionModalOpen(true)}>
              {micStatus === 'denied' ? 'RE-REQUEST ACCESS' : 'GRANT ACCESS'}
            </button>
          )}
        </div>
      </Row>
      <Row>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Label>Wake word ("Hello Khameleon")</Label>
          <div style={{ opacity: micStatus === 'granted' ? 1 : 0.4, pointerEvents: micStatus === 'granted' ? 'auto' : 'none' }}>
            <Toggle value={wakeWordActive} onChange={setWakeWordActive} />
          </div>
        </div>
        {micStatus !== 'granted' && (
          <NotYetWired>Grant microphone access above to enable wake word listening</NotYetWired>
        )}
      </Row>
      <NotYetWired>Voice speed, pitch, and output voice aren't configurable yet</NotYetWired>
    </>
  );
}

function pad2(n: number) { return String(n).padStart(2, '0'); }

function formatNextRun(iso: string | null, now = Date.now()): string {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - now;
  if (diff < 0) return 'now';
  const hh = Math.floor(diff / 3_600_000);
  const mm = Math.floor((diff % 3_600_000) / 60_000);
  if (hh > 0) return `in ${hh}h ${mm}m`;
  return `in ${mm}m`;
}

export function GeneralSection() {
  const [sched, setSched] = useState<SchedulerStatus | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [profile, setProfile] = useState<Profile>({ displayName: null, role: null });
  const [nameInput, setNameInput] = useState('');
  const [roleInput, setRoleInput] = useState('');
  const [profileMsg, setProfileMsg] = useState<string>();
  const [digestHour, setDigestHour] = useState(7);
  const [digestMinute, setDigestMinute] = useState(0);
  const [digestMsg, setDigestMsg] = useState<string>();
  const setOnboardingWizardOpen = useJarvisStore(s => s.setOnboardingWizardOpen);

  useEffect(() => {
    const fetch = () => { getSchedulerStatus().then(s => { setSched(s); setDigestHour(s.digestHour); setDigestMinute(s.digestMinute); }); };
    fetch();
    const interval = setInterval(fetch, 5 * 60 * 1000);
    window.addEventListener('focus', fetch);
    return () => { clearInterval(interval); window.removeEventListener('focus', fetch); };
  }, []);

  useEffect(() => {
    getOnboardingStatus().then(s => { setProfile(s.profile); setNameInput(s.profile.displayName ?? ''); setRoleInput(s.profile.role ?? ''); });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const saveProfileFields = async () => {
    setProfileMsg(undefined);
    try {
      const updated = await saveProfile({ displayName: nameInput.trim(), role: roleInput.trim() });
      setProfile(updated);
      setProfileMsg('Saved.');
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const saveDigestTime = async () => {
    setDigestMsg(undefined);
    try {
      const updated = await saveSchedulerConfig({ digestHour, digestMinute });
      setSched(updated);
      setDigestMsg('Saved.');
    } catch (err) {
      setDigestMsg(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  return (
    <>
      <Row>
        <Label>YOUR NAME</Label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="j-input" style={{ flex: 1 }} placeholder="What should Khameleon call you?" value={nameInput} onChange={e => setNameInput(e.target.value)} />
          <input className="j-input" style={{ flex: 1 }} placeholder="Role or field (optional)" value={roleInput} onChange={e => setRoleInput(e.target.value)} />
          <button className="j-btn-ghost" style={{ height: 34, padding: '0 12px', fontSize: 10 }} onClick={saveProfileFields}>SAVE</button>
        </div>
        {profileMsg && (
          <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 10, color: profileMsg === 'Saved.' ? 'var(--j-green)' : 'var(--j-red)', marginTop: 4 }}>{profileMsg}</div>
        )}
        {!profileMsg && profile.displayName && (
          <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-text-faint)', marginTop: 4 }}>
            Used in the assistant's greeting ("Good morning, {profile.displayName}.")
          </div>
        )}
        <button className="j-btn-ghost" style={{ height: 26, padding: '0 10px', fontSize: 9, marginTop: 8 }} onClick={() => setOnboardingWizardOpen(true)}>
          REDO FIRST-RUN SETUP
        </button>
      </Row>
      <Row>
        <Label>WORKSPACE NAME</Label>
        <input className="j-input" defaultValue="My Khameleon" disabled />
        <NotYetWired>Single-workspace only — nothing to name yet</NotYetWired>
      </Row>
      <Row>
        <Label>LANGUAGE</Label>
        <input className="j-input" defaultValue="en" disabled />
        <NotYetWired>English only — no localization built yet</NotYetWired>
      </Row>

      {/* ── Morning Digest ── */}
      <div style={{
        marginTop: 8, marginBottom: 16, padding: '14px 16px',
        background: 'rgba(56,207,138,0.04)', border: '1px solid rgba(56,207,138,0.18)',
      }}>
        <div style={{
          fontFamily: 'var(--j-font-ui)', fontSize: 11, fontWeight: 700,
          color: '#38cf8a', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Clock size={12} /> Morning Digest — Status
        </div>

        {/* Read-only status */}
        {sched ? (
          <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 10, color: 'var(--j-text-muted)', lineHeight: 1.9 }}>
            <div>
              <span style={{ color: sched.enabled ? '#38cf8a' : 'rgba(226,90,110,0.7)' }}>
                {sched.enabled ? '● Active' : '○ Disabled'}
              </span>
            </div>
            <div>Time: <strong>{pad2(sched.digestHour)}:{pad2(sched.digestMinute)}</strong> (server local time)</div>
            {sched.enabled && sched.nextRunAt && (
              <div>⏰ Next run: {new Date(sched.nextRunAt).toLocaleString()} ({formatNextRun(sched.nextRunAt, now)})</div>
            )}
            {sched.lastRunAt && (
              <div>Last run: {new Date(sched.lastRunAt).toLocaleString()}</div>
            )}
          </div>
        ) : (
          <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 10, color: 'var(--j-text-faint)' }}>
            Loading…
          </div>
        )}

        {/* Real control - PUT /api/scheduler/config used to be closed by
            default behind a SCHEDULER_ADMIN_KEY nobody sets in a
            single-user app (see routes/scheduler.ts), so this was
            read-only with "set these env vars and restart the server"
            underneath it. That's now the initial-boot default only;
            this picker is the real way to change it. */}
        <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="j-input" style={{ width: 80 }} value={digestHour} onChange={e => setDigestHour(Number(e.target.value))}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{pad2(h)}</option>)}
          </select>
          <span style={{ color: 'var(--j-text-muted)' }}>:</span>
          <select className="j-input" style={{ width: 80 }} value={digestMinute} onChange={e => setDigestMinute(Number(e.target.value))}>
            {[0, 15, 30, 45].map(m => <option key={m} value={m}>{pad2(m)}</option>)}
          </select>
          <button className="j-btn-ghost" style={{ height: 32, padding: '0 12px', fontSize: 10 }} onClick={saveDigestTime}>SAVE TIME</button>
          {digestMsg && (
            <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 10, color: digestMsg === 'Saved.' ? 'var(--j-green)' : 'var(--j-red)' }}>{digestMsg}</span>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * These three tabs used to show real-looking input fields (MAX CHUNKS,
 * CHUNK SIZE, RETENTION DAYS, API TIMEOUT, ...) with no onChange and no
 * save path at all - nothing on the server reads any of these values,
 * there's no config surface for memory chunking, telemetry retention, or
 * runtime tuning yet. Shown as read-only info instead of editable-looking
 * inputs, so a value someone types in doesn't silently vanish.
 */
function GenericSection({ section }: { section: Section }) {
  const fields: Record<string, string[][]> = {
    MEMORY:    [['MAX CHUNKS', '10000'], ['CHUNK SIZE', '512'], ['OVERLAP', '50']],
    TELEMETRY: [['RETENTION DAYS', '30'], ['EXPORT FORMAT', 'json']],
    ADVANCED:  [['API TIMEOUT (ms)', '30000'], ['STREAM BUFFER', '2048'], ['LOG LEVEL', 'info']],
  };
  return (
    <>
      <NotYetWired>These are the server's built-in defaults — not yet configurable from here</NotYetWired>
      {(fields[section] ?? []).map(([label, def]) => (
        <Row key={label}>
          <Label>{label}</Label>
          <div className="j-input" style={{ color: 'var(--j-text-faint)', cursor: 'default' }}>{def}</div>
        </Row>
      ))}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  // Auto-switch to CONNECTORS tab if returning from OAuth
  const defaultSection: Section = (() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('oauth_success') || p.get('oauth_error')) return 'CONNECTORS';
    return 'GENERAL';
  })();

  const [active, setActive] = useState<Section>(defaultSection);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '30% 70%', gap: 6, height: '100%', padding: 8 }}>
      {/* Nav */}
      <JPanel title="CONFIGURATION MENU" icon={<SettingsIcon size={13} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SECTIONS.map(s => (
            <button
              key={s}
              onClick={() => setActive(s)}
              style={{
                display: 'flex', alignItems: 'center', height: 40,
                padding: '0 12px',
                background: active === s ? 'rgba(0,212,255,0.06)' : 'transparent',
                border: 'none',
                borderLeft: `3px solid ${active === s ? 'var(--j-cyan)' : 'transparent'}`,
                color: active === s ? 'var(--j-cyan)' : 'var(--j-text-muted)',
                fontFamily: 'var(--j-font-ui)', fontSize: 12, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                cursor: 'pointer', width: '100%', textAlign: 'left',
                transition: 'color 0.15s, background 0.15s',
              }}
            >
              {s === 'CONNECTORS' && <><Plug size={12} style={{ marginRight: 8 }} />{s}</>}
              {s === 'API KEYS' && <><KeyRound size={12} style={{ marginRight: 8 }} />{s}</>}
              {s === 'VOICE' && <><Mic size={12} style={{ marginRight: 8 }} />{s}</>}
              {s !== 'CONNECTORS' && s !== 'API KEYS' && s !== 'VOICE' && s}
            </button>
          ))}
        </div>
      </JPanel>

      {/* Content */}
      <JPanel title={`SETTINGS — ${active}`} icon={<SettingsIcon size={13} />}>
        <div style={{ maxWidth: 520 }}>
          {active === 'GENERAL'    && <GeneralSection />}
          {active === 'ENGINE'     && <EngineSection />}
          {active === 'API KEYS'   && <ApiKeysSection />}
          {active === 'APPEARANCE' && <AppearanceSection />}
          {active === 'VOICE'      && <VoiceSection />}
          {active === 'CONNECTORS' && <ConnectorsSection />}
          {!['GENERAL', 'ENGINE', 'API KEYS', 'APPEARANCE', 'VOICE', 'CONNECTORS'].includes(active) && <GenericSection section={active} />}
        </div>
      </JPanel>
    </div>
  );
}
