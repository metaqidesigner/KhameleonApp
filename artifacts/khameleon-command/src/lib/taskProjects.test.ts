import { describe, it, expect } from 'vitest';
import { groupTasksByProject } from './taskProjects';
import type { Task } from './khameleonApi';

const t = (id: number, over: Partial<Task> = {}): Task => ({
  id, title: `T${id}`, description: '', status: 'todo', priority: 'medium', category: 'deep_work',
  recurrence: 'one_off', source: 'manual', assignee: '', aiRecommendation: '', createdAt: '', updatedAt: '',
  ...over,
});

describe('groupTasksByProject', () => {
  it('groups by project, names from the task, "No project" last, with top-level progress', () => {
    const groups = groupTasksByProject([
      t(1, { projectId: 2, projectName: 'Zeta', status: 'done' }),
      t(2, { projectId: 2, projectName: 'Zeta' }),
      t(3, { projectId: 2, projectName: 'Zeta', parentTaskId: 2, status: 'done' }), // subtask: not counted
      t(4),
      t(5, { projectId: 1, projectName: 'Alpha' }),
    ]);
    expect(groups.map(g => g.name)).toEqual(['Alpha', 'Zeta', 'No project']);
    const zeta = groups[1];
    expect([zeta.done, zeta.total, zeta.tasks.length]).toEqual([1, 2, 3]);
  });

  it('falls back to a supplied project name map when the task has no name', () => {
    const [g] = groupTasksByProject([t(1, { projectId: 7, projectName: null })], new Map([[7, 'Month end']]));
    expect(g.name).toBe('Month end');
  });
});
