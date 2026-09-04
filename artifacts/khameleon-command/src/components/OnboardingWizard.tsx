import { useEffect, useState } from 'react';
import { useJarvisStore } from '@/store/jarvisStore';
import {
  getOnboardingStatus, saveProfile, completeOnboarding,
  getApiKeyStatus, type ApiKeyStatus,
  getSchedulerStatus, saveSchedulerConfig, type SchedulerStatus,
} from '@/lib/jarvisApi';
import { ApiKeyRow } from './ApiKeyRow';
import { PROVIDERS, API_KEY_PROVIDER_DEFS } from '@/lib/apiKeyProviders';
import { ConnectIntegrationGate } from './ConnectIntegrationGate';

/**
 * design-spec.md §14 — a real first-run onboarding flow. Architecturally
 * identical to MicPermissionModal's pattern: a store-controlled boolean
 * (onboardingWizardOpen), checked once at boot, reopenable later from
 * Settings ("Redo setup"). §14's own text describes a 5-step wizard that
 * lived in khameleon-prototype/ (confirmed missing from this repo) - this
 * is a fresh build guiding the user through the *current* app's real
 * functionality (API Keys, Connectors, the Integrations directory,
 * scheduler config) rather than a rebuild of the old prototype's UI.
 *
 * Every step is skippable. Finishing or skipping always marks onboarding
 * complete server-side (§14's setup state isn't a per-browser thing).
 */

const STEPS = ['NAME', 'API KEY', 'OUTLOOK', 'DIGEST', 'DONE'] as const;
type Step = typeof STEPS[number];

const ANTHROPIC_DEF = API_KEY_PROVIDER_DEFS.find(d => d.id === 'anthropic')!;
const MICROSOFT_DEF = PROVIDERS.find(p => p.id === 'microsoft')!;

function StepShell({ title, children, onSkip, onNext, nextLabel, nextDisabled }: {
  title: string;
  children: React.ReactNode;
  onSkip: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
}) {
  return (
    <>
      <div style={{
        background: 'linear-gradient(90deg, rgba(192,21,42,0.9) 0%, rgba(192,21,42,0.5) 100%)',
        margin: '-24px -24px 16px -24px', padding: '8px 14px',
        fontFamily: 'var(--j-font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: '#fff',
      }}>
        {title}
      </div>
      <div style={{ minHeight: 140 }}>{children}</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button
          onClick={onSkip}
          style={{
            flex: 1, padding: '10px 0', background: 'transparent', border: '1px solid rgba(0,212,255,0.2)',
            color: 'rgba(0,212,255,0.5)', fontFamily: 'var(--j-font-mono)', fontSize: 10, letterSpacing: '0.15em', cursor: 'pointer',
          }}
        >
          SKIP
        </button>
        <button
          onClick={onNext}
          disabled={nextDisabled}
          style={{
            flex: 1, padding: '10px 0',
            background: nextDisabled ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, rgba(192,21,42,0.8) 0%, rgba(160,10,30,0.8) 100%)',
            border: '1px solid rgba(192,21,42,0.6)', color: '#fff', fontFamily: 'var(--j-font-mono)',
            fontSize: 10, letterSpacing: '0.15em', fontWeight: 700, cursor: nextDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          {nextLabel}
        </button>
      </div>
    </>
  );
}

export function OnboardingWizard() {
  const open = useJarvisStore(s => s.onboardingWizardOpen);
  const setOpen = useJarvisStore(s => s.setOnboardingWizardOpen);

  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>({});
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [showConnectGate, setShowConnectGate] = useState(false);
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [digestHour, setDigestHour] = useState(7);
  const [digestMinute, setDigestMinute] = useState(0);
  const [error, setError] = useState<string>();

  const refreshApiKeys = () => { getApiKeyStatus().then(setApiKeyStatus); };

  // Boot check: open the wizard once if the server says setup was never
  // finished (or explicitly skipped). Must run unconditionally (not
  // gated on `open`) since this is what decides whether to open at all.
  useEffect(() => {
    getOnboardingStatus().then(s => {
      if (!s.onboardingComplete) setOpen(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    getOnboardingStatus().then(s => {
      setOutlookConnected(s.oauth.microsoft ?? false);
    });
    getApiKeyStatus().then(setApiKeyStatus);
    getSchedulerStatus().then(s => {
      setSchedulerStatus(s);
      setDigestHour(s.digestHour);
      setDigestMinute(s.digestMinute);
    });
  }, [open]);

  if (!open) return null;

  const step: Step = STEPS[stepIndex];
  const finish = async () => {
    try {
      await completeOnboarding();
    } catch (err) {
      // Not fatal to the user's experience - they've already set up what
      // they wanted; just don't silently pretend this succeeded either.
      setError(err instanceof Error ? err.message : 'Failed to record setup completion');
    }
    setOpen(false);
  };

  const goNext = () => {
    if (stepIndex === STEPS.length - 1) { finish(); return; }
    setStepIndex(i => i + 1);
  };

  const saveDigest = async () => {
    setError(undefined);
    try {
      await saveSchedulerConfig({ digestHour, digestMinute, enabled: true });
      goNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save digest time');
    }
  };

  const saveNameStep = async () => {
    if (!name.trim() && !role.trim()) { goNext(); return; }
    setError(undefined);
    try {
      await saveProfile({ displayName: name.trim() || undefined, role: role.trim() || undefined });
      goNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save your name');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99998, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        position: 'relative', width: 420, padding: 24,
        background: 'rgba(2,10,22,0.98)', border: '1px solid rgba(0,212,255,0.35)',
        boxShadow: '0 0 40px rgba(0,212,255,0.12), inset 0 0 60px rgba(0,212,255,0.03)',
      }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, height: 3, background: i <= stepIndex ? 'var(--j-cyan)' : 'rgba(0,212,255,0.15)' }} />
          ))}
        </div>

        {step === 'NAME' && (
          <StepShell title="WELCOME TO KHAMELEON" onSkip={goNext} onNext={saveNameStep} nextLabel="NEXT">
            <p style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, color: '#b8d4e8', lineHeight: 1.6, marginBottom: 14 }}>
              Let's get you set up. What should Khameleon call you?
            </p>
            <input className="j-input" style={{ marginBottom: 8 }} placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
            <input className="j-input" placeholder="Role or field (optional)" value={role} onChange={e => setRole(e.target.value)} />
          </StepShell>
        )}

        {step === 'API KEY' && (
          <StepShell title="CONNECT A MODEL PROVIDER" onSkip={goNext} onNext={goNext} nextLabel="NEXT">
            <p style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, color: '#b8d4e8', lineHeight: 1.6, marginBottom: 14 }}>
              Khameleon's agents need at least one model API key to respond. Anthropic (Claude) is the default.
            </p>
            <ApiKeyRow
              def={ANTHROPIC_DEF}
              isSet={!!apiKeyStatus.anthropic}
              onSaved={refreshApiKeys}
              onCleared={refreshApiKeys}
            />
          </StepShell>
        )}

        {step === 'OUTLOOK' && (
          <StepShell title="CONNECT OUTLOOK (OPTIONAL)" onSkip={goNext} onNext={goNext} nextLabel="NEXT">
            <p style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, color: '#b8d4e8', lineHeight: 1.6, marginBottom: 14 }}>
              Connect Outlook to draft, summarize, and triage email. Skip this and connect any of 21 Integrations later from the Integrations directory.
            </p>
            {outlookConnected ? (
              <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 11, color: 'var(--j-green)' }}>● Outlook connected</div>
            ) : (
              <button
                onClick={() => setShowConnectGate(true)}
                style={{
                  width: '100%', padding: '10px 0', fontSize: 10, fontFamily: 'var(--j-font-ui)', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em', background: 'rgba(0,212,255,0.1)',
                  border: '1px solid rgba(0,212,255,0.35)', color: 'var(--j-cyan)', cursor: 'pointer',
                }}
              >
                CONNECT OUTLOOK
              </button>
            )}
          </StepShell>
        )}

        {step === 'DIGEST' && (
          <StepShell title="MORNING DIGEST TIME" onSkip={goNext} onNext={saveDigest} nextLabel="SAVE & NEXT">
            <p style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, color: '#b8d4e8', lineHeight: 1.6, marginBottom: 14 }}>
              {schedulerStatus?.enabled === false ? 'Digest is currently disabled.' : 'What time should your daily inbox triage digest run?'}
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select className="j-input" style={{ width: 80 }} value={digestHour} onChange={e => setDigestHour(Number(e.target.value))}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
              </select>
              <span style={{ color: 'var(--j-text-muted)' }}>:</span>
              <select className="j-input" style={{ width: 80 }} value={digestMinute} onChange={e => setDigestMinute(Number(e.target.value))}>
                {[0, 15, 30, 45].map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
              </select>
              <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 10, color: 'var(--j-text-faint)' }}>(server local time)</span>
            </div>
          </StepShell>
        )}

        {step === 'DONE' && (
          <StepShell title="YOU'RE SET UP" onSkip={finish} onNext={finish} nextLabel="FINISH">
            <p style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, color: '#b8d4e8', lineHeight: 1.6 }}>
              That's it. Say <span style={{ color: '#00d4ff', fontWeight: 600 }}>"Hello Khameleon"</span> anytime to talk
              to it by voice — you'll be asked for microphone access the first time you try. Everything here can be
              changed later in Settings, including redoing this setup.
            </p>
          </StepShell>
        )}

        {error && (
          <div style={{ marginTop: 10, fontFamily: 'var(--j-font-mono)', fontSize: 10, color: 'var(--j-red)' }}>{error}</div>
        )}
      </div>

      {showConnectGate && (
        <ConnectIntegrationGate
          providerId={MICROSOFT_DEF.id}
          name={MICROSOFT_DEF.label}
          dataScope={MICROSOFT_DEF.dataScope}
          actionScope={MICROSOFT_DEF.actionScope}
          onCancel={() => setShowConnectGate(false)}
        />
      )}
    </div>
  );
}
