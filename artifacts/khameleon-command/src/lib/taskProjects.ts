import type { Task } from './jarvisApi';

/**
 * Tasks grouped by project with progress (gap review Q15: projects fold
 * into the task manager). Shared by the Overlay's Workspace panel and
 * Classic's task list ("Group: Project"). Top-level tasks only count
 * toward progress - subtasks already show their own progress on their
 * parent.
 */
export interface ProjectGroup {
  key: string;
  projectId: number | null;
  name: string;
  tasks: Task[];
  done: number;
  total: number;
}

export function groupTasksByProject(tasks: Task[], projectNames: Map<number, string> = new Map()): ProjectGroup[] {
  const byKey = new Map<string, ProjectGroup>();
  for (const t of tasks) {
    const id = t.projectId ?? null;
    const key = id === null ? 'none' : String(id);
    let g = byKey.get(key);
    if (!g) {
      const name = id === null ? 'No project' : (t.projectName ?? projectNames.get(id) ?? `Project ${id}`);
      g = { key, projectId: id, name, tasks: [], done: 0, total: 0 };
      byKey.set(key, g);
    }
    g.tasks.push(t);
    if (t.parentTaskId == null) {
      g.total += 1;
      if (t.status === 'done') g.done += 1;
    }
  }
  // Named projects A-Z, then "No project" last.
  return [...byKey.values()].sort((a, b) => {
    if (a.projectId === null) return 1;
    if (b.projectId === null) return -1;
    return a.name.localeCompare(b.name);
  });
}
