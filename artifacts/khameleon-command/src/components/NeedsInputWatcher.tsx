import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { getTasks, type Task } from '@/lib/jarvisApi';

/**
 * design-spec.md §6.5.1 — "Interrupting notifications are reserved strictly
 * for genuine needs-input moments." First real implementation: the app
 * already had a generic toast component (hooks/use-toast.ts,
 * components/ui/toast.tsx) but nothing anywhere ever called it - confirmed
 * via the 2026-10-01 audit (zero imports outside its own files). Tried
 * wiring into that first; its entrance animation never completes (the
 * Radix toast element gets stuck mid-slide with a stale transform, then
 * disappears again within ~2s regardless of when it's checked) - a latent
 * bug in scaffolding nobody had ever actually triggered before today, not
 * something introduced here. Rather than debug an unrelated template,
 * this renders its own small banner instead: simpler, and matches the
 * rest of the app's real visual language instead of a generic default.
 *
 * Scope decision made here, flagged for review rather than assumed: the
 * only signal in the whole app that unambiguously means "the agent is
 * genuinely blocked on a real decision" today is a task's real
 * status:'needs_input'. Everything else the app does (routine progress,
 * completed steps, background chat) is exactly what this section says
 * must NOT interrupt. A broader definition later should be added here
 * deliberately, not folded in by default.
 *
 * Rendered once, globally, in AppShell.tsx - like JarvisOrbPortal, this
 * has to work regardless of which tab is open, since the whole point of
 * an interrupt is surfacing something the user isn't currently looking
 * at. Polls rather than pushing, since no real-time task-update channel
 * exists yet (tasks are read via plain REST elsewhere in the app too).
 */
const POLL_INTERVAL_MS = 20_000;
const AUTO_DISMISS_MS = 8_000;

export function NeedsInputWatcher() {
  const alertedIdsRef = useRef<Set<number>>(new Set());
  const [queue, setQueue] = useState<Task[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const tasks = await getTasks({ status: 'needs_input' }).catch(() => [] as Task[]);
      if (cancelled) return;

      const currentIds = new Set(tasks.map(t => t.id));
      // A task that resolved and later needs input again can alert a
      // second time - only tasks still pending stay "already seen".
      for (const seenId of alertedIdsRef.current) {
        if (!currentIds.has(seenId)) alertedIdsRef.current.delete(seenId);
      }

      const fresh = tasks.filter(t => !alertedIdsRef.current.has(t.id));
      if (fresh.length === 0) return;
      fresh.forEach(t => alertedIdsRef.current.add(t.id));
      setQueue(q => [...q, ...fresh]);
    }

    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (queue.length === 0) return;
    const timer = setTimeout(() => setQueue(q => q.slice(1)), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [queue]);

  if (queue.length === 0) return null;
  const current = queue[0];

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 10000,
        width: 320,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '14px 14px 14px 16px',
        borderRadius: 13,
        background: 'linear-gradient(140deg, rgba(26,57,69,.95), rgba(10,27,40,.97))',
        border: '1px solid rgba(246,142,123,.4)',
        boxShadow: '0 20px 44px rgba(0,0,0,.4), 0 0 0 1px rgba(246,142,123,.12)',
        backdropFilter: 'blur(16px)',
        color: '#e8f3f0',
        animation: 'needs-input-in .25s cubic-bezier(.22,1,.36,1)',
      }}
    >
      <style>{`@keyframes needs-input-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <AlertTriangle size={16} color="#f68e7b" style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#f68e7b' }}>
          Needs your input
        </div>
        <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.4 }}>{current.title}</div>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setQueue(q => q.slice(1))}
        style={{ background: 'none', border: 0, color: '#8fa39c', cursor: 'pointer', padding: 2, flexShrink: 0 }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
