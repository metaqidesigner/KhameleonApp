import { useEffect, useState } from 'react';
import { Eye, Pause, Play } from 'lucide-react';
import { detectionBridge, type DetectionStatus } from '@/lib/desktopBridge';
import { TONES, type Tone } from '@/components/settings/ui';

/** Build 6: the visible "Watching for tasks" sign, with Pause, while content watching is on. */
export function DetectionBadge({ tone, style }: { tone: Tone; style?: React.CSSProperties }) {
  const t = TONES[tone];
  const det = detectionBridge();
  const [s, setS] = useState<DetectionStatus | null>(null);
  useEffect(() => { if (!det) return; det.status().then(setS).catch(() => {}); return det.onUpdate(setS); }, [det]);
  if (!det || !s || !s.enabled || (!s.watching && !s.paused)) return null;
  return (
    <div data-overlay-hit role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: tone === 'overlay' ? 999 : 2, fontSize: 11, color: t.text,
      background: tone === 'overlay' ? 'rgba(10,22,26,0.8)' : 'rgba(0,10,16,0.9)', border: `1px solid ${s.paused ? t.border : t.accent}`, ...style }}>
      <Eye size={12} color={s.paused ? t.muted : t.accent} />
      {s.paused ? 'Task watching paused' : 'Watching for tasks'}
      <button type="button" aria-label={s.paused ? 'Resume watching' : 'Pause watching'} onClick={() => void det.pause(!s.paused).then(setS)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: t.text, display: 'inline-flex' }}>
        {s.paused ? <Play size={12} /> : <Pause size={12} />}
      </button>
    </div>
  );
}
