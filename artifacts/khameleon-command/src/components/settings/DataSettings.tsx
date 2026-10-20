import { useEffect, useState } from 'react';
import { dataBridge } from '@/lib/desktopBridge';
import { useUi, Label, Hint, Msg, Group, type Tone } from './ui';

/**
 * Settings > Security > Your data (download decisions, 2026-10-20): where the
 * all-in-one app keeps everything (on this computer only - Khameleon has no
 * servers), the recovery key, and removing it all. Only shown in the desktop
 * app when it runs its own built-in server.
 */
export function DataSettings({ tone }: { tone: Tone }) {
  const { t, btn, input } = useUi(tone);
  const bridge = dataBridge();
  const [builtIn, setBuiltIn] = useState(false);
  const [folder, setFolder] = useState<string | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [restore, setRestore] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!bridge) return;
    void bridge.builtIn().then(setBuiltIn);
    void bridge.folder().then(setFolder);
  }, [bridge]);

  if (!bridge || !builtIn) return null;

  const save = async () => {
    setMsg(null);
    if (await bridge.saveRecoveryKey()) setMsg({ ok: true, text: 'Saved. Keep the file somewhere safe and private - not on this computer only.' });
  };
  const use = async () => {
    setMsg(null);
    if (await bridge.useRecoveryKey(restore)) { setRestore(''); setMsg({ ok: true, text: 'Recovery key used - Khameleon restarted with it.' }); }
    else setMsg({ ok: false, text: 'That isn\'t a recovery key. It\'s 8 groups of 8 letters and numbers.' });
  };

  return (
    <Group>
      <Label tone={tone}>Your data</Label>
      <Hint tone={tone}>
        Everything Khameleon keeps - chats, tasks, skills, recordings, saved logins and Khami's brain - is on this computer only{folder ? <>, in <span style={{ color: t.text, wordBreak: 'break-all' }}>{folder}</span></> : null}. Khameleon has no servers of its own. Your normal backup (Time Machine, OneDrive) usually covers it.
      </Hint>

      <div style={{ fontSize: 12.5, marginTop: 4 }}>Recovery key</div>
      <Hint tone={tone}>Saved logins and keys are locked with a key kept in this computer's keychain. On a new computer, the recovery key unlocks them. Without it you'd just enter them again.</Hint>
      {key && <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, padding: '6px 8px', borderRadius: 6, background: t.input, userSelect: 'all', wordBreak: 'break-all' }}>{key}</div>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" style={btn()} onClick={() => void (key ? Promise.resolve(setKey(null)) : bridge.recoveryKey().then(setKey))}>{key ? 'Hide' : 'Show recovery key'}</button>
        <button type="button" style={btn()} onClick={() => void save()}>Save to a file…</button>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        <input aria-label="Recovery key from another computer" placeholder="Recovery key from another computer" value={restore} onChange={e => setRestore(e.target.value)} style={{ ...input, flex: 1 }} />
        <button type="button" style={btn()} disabled={!restore.trim()} onClick={() => void use()}>Use</button>
      </div>

      <div style={{ fontSize: 12.5, marginTop: 6 }}>Remove everything</div>
      <Hint tone={tone}>Deletes all your Khameleon data from this computer and closes Khameleon. It can't be undone.</Hint>
      <div><button type="button" style={{ ...btn(), color: t.bad, borderColor: t.bad }} onClick={() => void bridge.removeAll()}>Remove all my Khameleon data…</button></div>
      {msg && <Msg tone={tone} ok={msg.ok}>{msg.text}</Msg>}
    </Group>
  );
}
