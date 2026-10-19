import { useEffect, useState } from 'react';
import { desktopPrefsBridge, detectionBridge, type DesktopPrefs, type DetectionPrefs, type DetectionStatus } from '@/lib/desktopBridge';
import { useUi, Label, Hint, Msg, Group, type Tone } from './ui';

/**
 * Settings > Detection (docs/build-review.md, Build 6). Off by default. Spot
 * repeated tasks from a private window log on this computer; optionally watch
 * window content too (its own switch, with a visible indicator and Pause).
 * Only ever offers. Desktop app only.
 */
export function DetectionSettings({ tone }: { tone: Tone }) {
  const { t, btn, input } = useUi(tone);
  const prefsBridge = desktopPrefsBridge();
  const det = detectionBridge();
  const [prefs, setPrefs] = useState<DesktopPrefs | null>(null);
  const [status, setStatus] = useState<DetectionStatus | null>(null);
  const [newApp, setNewApp] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    prefsBridge?.get().then(setPrefs).catch(() => {});
    det?.status().then(setStatus).catch(() => {});
    return det?.onUpdate(setStatus);
  }, [prefsBridge, det]);

  if (!prefsBridge || !det) return <Hint tone={tone}>Task detection works in the Khameleon desktop app - a browser can't see your other apps.</Hint>;
  if (!prefs) return null;
  const d: DetectionPrefs = prefs.detection ?? { enabled: false, watchContent: false, historyDays: 30, defaultExclusions: true, excluded: [] };
  const save = async (patch: Partial<DetectionPrefs>) => {
    setMsg(null);
    try { setPrefs(await prefsBridge.set({ detection: { ...d, ...patch } })); } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Couldn\'t save' }); }
  };
  const onOff = (value: boolean, set: (v: boolean) => void, labels = ['On', 'Off']) => (
    <div style={{ display: 'flex', gap: 6 }}>
      {[true, false].map((v, i) => <button key={String(v)} type="button" aria-pressed={value === v} style={btn(value === v)} onClick={() => set(v)}>{labels[i]}</button>)}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Group>
        <Label tone={tone}>Spot tasks I repeat</Label>
        {onOff(d.enabled, v => void save({ enabled: v }))}
        <Hint tone={tone}>
          Keeps a private log, on this computer only, of which apps and windows you switch between - no typing, no screenshots, no clicks.
          When the same 3 or more steps happen on 3 different days within 2 weeks, Khameleon offers once to capture it as a skill (and says if it looks like one of your skills or procedures). "Not this one" means it won't ask about that again.
        </Hint>
        {status && d.enabled && <div style={{ fontSize: 11, color: t.muted }}>{status.logged} window switches in the log.</div>}
      </Group>

      {d.enabled && (
        <Group>
          <Label tone={tone}>Also watch what's in the window</Label>
          {onOff(d.watchContent, v => void save({ watchContent: v }))}
          <Hint tone={tone}>
            When you stay on a window for about 20 seconds (at most once a minute), Khameleon reads its title and visible text - on this computer, by Khami only - and offers when it looks like one of your skills, a company procedure, or a task worth capturing.
            A "Watching for tasks" sign shows while it's on, with Pause. Reading the text needs the Screen Recording permission; without it, only window titles are used.
          </Hint>
        </Group>
      )}

      <Group>
        <Label tone={tone}>Keep the log for</Label>
        <select aria-label="Keep the log for" value={d.historyDays} onChange={e => void save({ historyDays: Number(e.target.value) })} style={{ ...input, width: 140 }}>
          {[7, 14, 30, 60, 90].map(n => <option key={n} value={n}>{n} days</option>)}
        </select>
        <div>
          {confirmDelete ? (
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
              Delete the whole log?
              <button type="button" style={btn()} onClick={() => void det.deleteHistory().then(s => { setStatus(s); setConfirmDelete(false); setMsg({ ok: true, text: 'Your history was deleted.' }); })}>Yes, delete</button>
              <button type="button" style={btn()} onClick={() => setConfirmDelete(false)}>No</button>
            </span>
          ) : <button type="button" style={btn()} onClick={() => setConfirmDelete(true)}>Delete my history</button>}
        </div>
      </Group>

      <Group>
        <Label tone={tone}>Leave out</Label>
        <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={d.defaultExclusions} onChange={e => void save({ defaultExclusions: e.target.checked })} />
          Banking, password managers and private browsing windows
        </label>
        {d.excluded.map(x => (
          <div key={x} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
            <span style={{ flex: 1 }}>{x}</span>
            <button type="button" style={btn()} onClick={() => void save({ excluded: d.excluded.filter(y => y !== x) })}>Remove</button>
          </div>
        ))}
        <form style={{ display: 'flex', gap: 6 }} onSubmit={e => { e.preventDefault(); if (newApp.trim()) { void save({ excluded: [...d.excluded, newApp.trim()] }); setNewApp(''); } }}>
          <input aria-label="App or window to leave out" placeholder="An app or window name, e.g. Messages" value={newApp} onChange={e => setNewApp(e.target.value)} style={input} />
          <button type="submit" style={btn()} disabled={!newApp.trim()}>Add</button>
        </form>
      </Group>
      {msg && <Msg tone={tone} ok={msg.ok}>{msg.text}</Msg>}
    </div>
  );
}
