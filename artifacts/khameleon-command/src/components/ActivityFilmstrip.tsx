import { useCallback, useEffect, useState } from 'react';
import { getDailyTasks, type Task } from '@/lib/jarvisApi';
import { useJarvisStore } from '@/store/jarvisStore';
import { DAY_SECTIONS } from '@/pages/canvas';

/**
 * assistant-home.tsx's filmstrip — ported from khameleon-home-implemented.
 * html's .filmstrip, but the five cards are the five most recently touched
 * real tasks (by updatedAt), not the mockup's fixed "Market research /
 * Content brief / ..." placeholders. Each card's wave is a real SVG drawn
 * from the task's own id (so it's stable across re-renders, not random),
 * tinted by whichever time-of-day section the task belongs to.
 */

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// A small deterministic PRNG seeded by the task id, so a card's wave shape
// stays stable across re-renders instead of re-rolling on every fetch.
function seededWave(seed: number): string {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  const next = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const points: string[] = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const x = Math.round((200 / (n - 1)) * i);
    const y = Math.round(20 + next() * 40);
    points.push(`${x},${y}`);
  }
  return points.join(' ');
}

export function ActivityFilmstrip() {
  const [sections, setSections] = useState<Record<string, Task[]>>({});
  const taskRevision = useJarvisStore(s => s.taskRevision);

  const load = useCallback(() => {
    getDailyTasks().then(d => setSections(d.sections ?? {}));
  }, []);

  useEffect(() => { load(); }, [load, taskRevision]);

  const tagged = DAY_SECTIONS.flatMap(sec =>
    (sections[sec.id] ?? []).map(t => ({ task: t, color: sec.color })),
  );
  const recent = [...tagged]
    .sort((a, b) => new Date(b.task.updatedAt).getTime() - new Date(a.task.updatedAt).getTime())
    .slice(0, 5);

  if (recent.length === 0) {
    return (
      <div className="kh-filmstrip">
        <div className="kh-film-empty">No recent activity yet — completed and in-progress tasks will show up here.</div>
      </div>
    );
  }

  return (
    <div className="kh-filmstrip">
      {recent.map(({ task, color }) => {
        const checkClass = task.status === 'done' ? 'done' : task.status === 'in_progress' ? 'progress' : 'queued';
        return (
          <div className="kh-film-card" key={task.id}>
            <div className="kh-film-swatch">
              <svg viewBox="0 0 200 76" preserveAspectRatio="none">
                <polyline
                  points={seededWave(task.id)}
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  opacity="0.9"
                />
              </svg>
            </div>
            <div className="kh-film-info">
              <span className="kh-film-name">
                <span className={`kh-film-check ${checkClass}`}>{task.status === 'done' ? '✓' : ''}</span>
                {task.title}
              </span>
              <span className="kh-film-time">{formatWhen(task.updatedAt)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
