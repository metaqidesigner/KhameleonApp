import { useEffect, useState } from 'react';
import { getOnboardingStatus, saveProfile, getSchedulerStatus, saveSchedulerConfig } from '@/lib/jarvisApi';
import { useJarvisStore } from '@/store/jarvisStore';
import { useUi, Label, Hint, Msg, Group, type Tone } from './ui';

/** Settings > Profile (gap review Q18): name and role, morning digest time, redo first-run setup. */
const pad = (n: number) => String(n).padStart(2, '0');

export function ProfileSettings({ tone }: { tone: Tone }) {
  const { input, btn } = useUi(tone);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(0);
  const [digestOn, setDigestOn] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const openWizard = useJarvisStore(s => s.setOnboardingWizardOpen);

  useEffect(() => {
    getOnboardingStatus().then(s => { setName(s.profile.displayName ?? ''); setRole(s.profile.role ?? ''); }).catch(() => {});
    getSchedulerStatus().then(s => { setHour(s.digestHour); setMinute(s.digestMinute); setDigestOn(s.enabled); }).catch(() => {});
  }, []);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Couldn\'t save' }); }
  };
  const select: React.CSSProperties = { ...input, width: 72 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <form style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onSubmit={e => { e.preventDefault(); void run(() => saveProfile({ displayName: name.trim(), role: role.trim() }), 'Saved.'); }}>
        <Label tone={tone}>Your name</Label>
        <input aria-label="Your name" placeholder="What should Khameleon call you?" value={name} onChange={e => setName(e.target.value)} style={input} />
        <Label tone={tone}>Your role (optional)</Label>
        <input aria-label="Your role" placeholder="e.g. Accounts payable" value={role} onChange={e => setRole(e.target.value)} style={input} />
        <Hint tone={tone}>Used in greetings, and to suggest skills that fit your work.</Hint>
        <div><button type="submit" style={btn(true)}>Save</button></div>
      </form>

      <Group>
        <Label tone={tone}>Morning digest</Label>
        <Hint tone={tone}>A summary of your day, ready each morning{digestOn === false ? ' (currently off)' : ''}.</Hint>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select aria-label="Hour" value={hour} onChange={e => setHour(Number(e.target.value))} style={select}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{pad(h)}</option>)}
          </select>
          <span>:</span>
          <select aria-label="Minute" value={minute} onChange={e => setMinute(Number(e.target.value))} style={select}>
            {[0, 15, 30, 45].map(m => <option key={m} value={m}>{pad(m)}</option>)}
          </select>
          <button type="button" style={btn()} onClick={() => void run(() => saveSchedulerConfig({ digestHour: hour, digestMinute: minute }), `Digest time set to ${pad(hour)}:${pad(minute)}.`)}>Save time</button>
        </div>
      </Group>

      <Group>
        <Label tone={tone}>First-run setup</Label>
        <div><button type="button" style={btn()} onClick={() => openWizard(true)}>Go through setup again</button></div>
      </Group>
      {msg && <Msg tone={tone} ok={msg.ok}>{msg.text}</Msg>}
    </div>
  );
}
