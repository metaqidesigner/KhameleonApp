import { useCallback, useEffect, useState } from 'react';
import { getDailyTasks, type Task } from '@/lib/jarvisApi';
import { useJarvisStore } from '@/store/jarvisStore';
import { FocusRing, DAY_SECTIONS } from '@/pages/canvas';

/**
 * assistant-home.tsx's right-column focus panel — ported from
 * khameleon-home-implemented.html's .focus-panel, but every number and row
 * here is real: the same /tasks/daily read that powers the Workspace tab's
 * Today's Plan window and the corner focus ring, not the mockup's fixed
 * "Launch deck final polish · 3/5" placeholder.
 */

const STATUS_LABEL: Record<Task['status'], string> = {
  done: 'Done',
  in_progress: 'In progress',
  todo: 'Pending',
  blocked: 'Blocked',
  needs_input: 'Needs input',
};

export function TodaysFocusPanel() {
  const [sections, setSections] = useState<Record<string, Task[]>>({});
  const [doneCount, setDoneCount] = useState(0);
  const [total, setTotal] = useState(0);
  const taskRevision = useJarvisStore(s => s.taskRevision);

  const load = useCallback(() => {
    getDailyTasks().then(d => {
      setSections(d.sections ?? {});
      setDoneCount(d.doneCount ?? 0);
      setTotal(d.total ?? 0);
    });
  }, []);

  useEffect(() => { load(); }, [load, taskRevision]);

  // Flatten in the day's natural order (start_of_day → end_of_day) so the
  // list reads the same left-to-right story as the Today's Plan window.
  const flat = DAY_SECTIONS.flatMap(sec => sections[sec.id] ?? []);
  const grandTotal = total + doneCount;
  const pct = grandTotal > 0 ? doneCount / grandTotal : 0;
  const current = flat.find(t => t.status === 'in_progress') ?? flat.find(t => t.status !== 'done');
  const rows = flat.slice(0, 5);

  return (
    <div className="kh-focus-panel">
      <div className="kh-focus-title">Today's focus</div>
      <div className="kh-focus-top">
        <FocusRing pct={pct} />
        <div>
          <div className="kh-focus-task-title">
            {current ? current.title : grandTotal > 0 ? 'All caught up' : 'No tasks yet today'}
          </div>
          <div className="kh-focus-task-sub">
            {grandTotal > 0 ? `${doneCount}/${grandTotal} done today` : 'Add a task to get started'}
          </div>
        </div>
      </div>
      {rows.length > 0 && (
        <div className="kh-focus-list">
          {rows.map(t => {
            const done = t.status === 'done';
            return (
              <div className="kh-focus-row" key={t.id}>
                <span className={`name${done ? ' done' : ''}`}>
                  <span className={`kh-fdot${done ? ' done' : ''}`}>{done ? '✓' : ''}</span>
                  {t.title}
                </span>
                <span className={`kh-fstatus${done ? ' done' : ''}`}>{STATUS_LABEL[t.status]}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
