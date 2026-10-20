import { useEffect, useRef, useState } from 'react';
import { useKhameleonStore } from '@/store/khameleonStore';
import { getOnboardingStatus, saveProfile, completeOnboarding } from '@/lib/khameleonApi';
import { getKhamiSetup, downloadKhamiBrain, type KhamiSetup } from '@/lib/khamiApi';
import { getMicrosoftAppStatus } from '@/lib/microsoftAppApi';
import { permissionsBridge } from '@/lib/desktopBridge';
import { connectStartPath } from '@/lib/integrationsApi';
import { useUi, Hint, Msg, type Tone } from '@/components/settings/ui';
import { KHAMI_HOME } from '@/lib/where';

/**
 * First-run setup (download decisions, step 2 - 2026-10-20): short, in
 * whichever layout opens first. Welcome (Khami's standard brain starts
 * downloading in the background here) → your name → Sign in with Microsoft →
 * (Mac) allow Khameleon to work in your apps → done. Every step can be
 * skipped; outside AI keys and the digest time live in Settings. Finishing
 * marks setup complete on the server, so it shows once. The Overlay then
 * shows three quick tips (OverlayTips).
 */
type Step = 'welcome' | 'name' | 'microsoft' | 'accessibility' | 'done';

export function FirstRunSetup({ tone, onFinished }: { tone: Tone; onFinished?: () => void }) {
  const open = useKhameleonStore(s => s.onboardingWizardOpen);
  const setOpen = useKhameleonStore(s => s.setOnboardingWizardOpen);
  const { t, btn, input } = useUi(tone);

  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [khami, setKhami] = useState<KhamiSetup | null>(null);
  const [msConfigured, setMsConfigured] = useState<boolean | null>(null);
  const [msConnected, setMsConnected] = useState(false);
  const [msWaiting, setMsWaiting] = useState(false);
  const [needsAccessibility, setNeedsAccessibility] = useState(false);
  const [accessibilityOn, setAccessibilityOn] = useState(false);
  const [asked, setAsked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  // Show once, if setup was never finished.
  useEffect(() => {
    getOnboardingStatus().then(s => { if (!s.onboardingComplete) setOpen(true); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Redo setup" starts from the first screen.
  useEffect(() => { if (open) setStep('welcome'); }, [open]);

  // When open: start Khami's standard brain downloading (quick to get; "Better" is in Settings), and keep an eye on it.
  useEffect(() => {
    if (!open) return;
    let stop = false;
    const poll = async () => {
      try {
        const s = await getKhamiSetup();
        if (stop) return;
        setKhami(s);
        const standard = s.brains.find(b => b.id === 'standard');
        if (!started.current && !s.active && s.download.state !== 'downloading' && !standard?.downloaded) {
          started.current = true;
          await downloadKhamiBrain('standard');
        }
      } catch { /* the server may still be starting */ }
    };
    void poll();
    const id = setInterval(poll, 2000);
    getMicrosoftAppStatus().then(s => setMsConfigured(s.configured)).catch(() => setMsConfigured(false));
    getOnboardingStatus().then(s => setMsConnected(!!s.oauth.microsoft)).catch(() => {});
    permissionsBridge()?.status().then(p => { setNeedsAccessibility(p.platform === 'darwin'); setAccessibilityOn(p.accessibility); }).catch(() => {});
    return () => { stop = true; clearInterval(id); };
  }, [open]);

  // Waiting for the Microsoft sign-in (in the browser) or the Accessibility switch: notice when it's done.
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      if (step === 'microsoft' && msWaiting) getOnboardingStatus().then(s => { if (s.oauth.microsoft) { setMsConnected(true); setMsWaiting(false); } }).catch(() => {});
      if (step === 'accessibility' && !accessibilityOn) permissionsBridge()?.status().then(p => setAccessibilityOn(p.accessibility)).catch(() => {});
    }, 1500);
    return () => clearInterval(id);
  }, [open, step, msWaiting, accessibilityOn]);

  if (!open) return null;

  const order: Step[] = ['welcome', 'name', 'microsoft', ...(needsAccessibility ? ['accessibility' as Step] : []), 'done'];
  const next = () => setStep(order[Math.min(order.indexOf(step) + 1, order.length - 1)]);

  const saveName = async () => {
    setError(null);
    try { if (name.trim()) await saveProfile({ displayName: name.trim() }); next(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Couldn\'t save your name'); }
  };

  const signIn = () => {
    setMsWaiting(true);
    // Opens in the normal web browser (the desktop app sends outside pages there); this card notices when it's done.
    window.open(new URL(connectStartPath('microsoft'), window.location.origin).toString(), '_blank');
  };

  const allowAccessibility = async () => {
    const bridge = permissionsBridge();
    if (!bridge) return;
    if (asked) { await bridge.openAccessibility(); return; }
    setAsked(true);
    if (await bridge.allowAccessibility()) setAccessibilityOn(true);
  };

  const finish = async () => {
    try { await completeOnboarding(); } catch { /* not fatal - it just shows again next time */ }
    setOpen(false);
    onFinished?.();
  };

  const d = khami?.download;
  const khamiLine = khami?.active
    ? 'Khami is ready.'
    : d?.state === 'downloading'
      ? `Getting Khami ready… ${d.percent ?? 0}%${d.totalGb ? ` of ${d.totalGb} GB` : ''}`
      : d?.state === 'error'
        ? 'Khami\'s download stopped - check the internet connection. You can finish it later in Settings → AI.'
        : 'Getting Khami ready…';

  const title = (text: string) => <div style={{ fontSize: 17, fontWeight: 600, color: t.text, lineHeight: 1.3 }}>{text}</div>;
  const body = (text: React.ReactNode) => <div style={{ fontSize: 13, color: t.muted, lineHeight: 1.55 }}>{text}</div>;
  const actions = (primary: React.ReactNode, skip = true) => (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
      {skip && <button type="button" style={btn()} onClick={next}>Skip</button>}
      {primary}
    </div>
  );
  const dots = order.filter(s => s !== 'done');

  return (
    <div data-overlay-hit role="dialog" aria-label="Set up Khameleon" style={{
      position: 'fixed', zIndex: 99998, left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
      width: 'min(440px, calc(100vw - 32px))', display: 'flex', flexDirection: 'column', gap: 14, padding: 22,
      borderRadius: tone === 'overlay' ? 18 : 4, background: tone === 'overlay' ? 'rgba(8,16,22,0.94)' : 'rgba(2,10,22,0.98)',
      border: `1px solid ${t.border}`, boxShadow: '0 18px 60px rgba(0,0,0,0.45)', color: t.text, fontFamily: 'var(--j-font-ui)',
      backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
    }}>
      {step !== 'done' && (
        <div style={{ display: 'flex', gap: 5 }} aria-hidden>
          {dots.map((s, i) => <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= dots.indexOf(step) ? t.accent : t.border }} />)}
        </div>
      )}

      {step === 'welcome' && (
        <>
          {title('Welcome to Khameleon')}
          {body(<>Khameleon helps with your work inside the apps you already use - email, calendar, documents and more. Its own AI, Khami, runs {KHAMI_HOME}. <b style={{ color: t.text, fontWeight: 600 }}>Everything stays on this computer</b>, and confidential work never leaves it.</>)}
          {actions(<button type="button" style={btn(true)} onClick={next}>Get started</button>, false)}
        </>
      )}

      {step === 'name' && (
        <>
          {title('What should Khameleon call you?')}
          <input aria-label="Your name" placeholder="Your name" value={name} autoFocus onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void saveName(); }} style={input} />
          {actions(<button type="button" style={btn(true)} onClick={() => void saveName()}>Next</button>)}
        </>
      )}

      {step === 'microsoft' && (
        <>
          {title('Sign in with Microsoft')}
          {body('So Khameleon can help with your Outlook email and calendar, and use Copilot if your organisation has it. You sign in once - that\'s it.')}
          {msConnected
            ? <Msg tone={tone} ok>Signed in with Microsoft.</Msg>
            : msConfigured === false
              ? <Hint tone={tone}>Microsoft sign-in isn't available in this version yet - you can connect it later in Settings → Microsoft sign-in.</Hint>
              : msWaiting
                ? <Hint tone={tone}>Finish signing in in your web browser - this will update when you're done.</Hint>
                : null}
          {actions(msConnected
            ? <button type="button" style={btn(true)} onClick={next}>Next</button>
            : <button type="button" style={btn(true)} disabled={!msConfigured} onClick={signIn}>{msWaiting ? 'Open the sign-in again' : 'Sign in with Microsoft'}</button>)}
        </>
      )}

      {step === 'accessibility' && (
        <>
          {title('Let Khameleon work in your apps')}
          {body('So Khameleon can click and type in other apps when you ask - like replaying a task you recorded or filling in a login. macOS asks you to switch this on yourself: choose Open System Settings, then turn on Khameleon.')}
          {accessibilityOn
            ? <Msg tone={tone} ok>Done - Khameleon can work in your apps.</Msg>
            : asked ? <Hint tone={tone}>Turn on Khameleon in Privacy & Security → Accessibility. This updates when it's on.</Hint> : null}
          {actions(accessibilityOn
            ? <button type="button" style={btn(true)} onClick={next}>Next</button>
            : <button type="button" style={btn(true)} onClick={() => void allowAccessibility()}>{asked ? 'Open System Settings' : 'Allow'}</button>)}
        </>
      )}

      {step === 'done' && (
        <>
          {title(name.trim() ? `You're all set, ${name.trim()}.` : 'You\'re all set.')}
          {body(khami?.active ? 'Khami is ready. Ask Khameleon anything, any time.' : 'You can start now - Khami answers as soon as it\'s ready. Everything here can be changed later in Settings.')}
          {actions(<button type="button" style={btn(true)} onClick={() => void finish()}>Start using Khameleon</button>, false)}
        </>
      )}

      <div role="status" style={{ fontSize: 11.5, color: d?.state === 'error' ? t.bad : t.muted, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span>{khamiLine}</span>
        {d?.state === 'downloading' && (
          <div style={{ height: 3, borderRadius: 2, background: t.border, overflow: 'hidden' }}>
            <div style={{ width: `${d.percent ?? 0}%`, height: '100%', background: t.accent, transition: 'width 0.6s ease' }} />
          </div>
        )}
      </div>
      {error && <Msg tone={tone} ok={false}>{error}</Msg>}
    </div>
  );
}
