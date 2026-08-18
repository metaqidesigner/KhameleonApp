import type { Task } from './jarvisApi';

/**
 * From a set of currently-visible tasks, return those that are "roots":
 * - tasks with no parentTaskId, OR
 * - tasks whose parent is NOT in the visible set (orphaned subtasks promoted to roots).
 *
 * This preserves filter semantics: a matching subtask whose parent was filtered
 * out still appears as an independent item rather than disappearing.
 */
export function computeRoots(tasks: Task[]): Task[] {
  const ids = new Set(tasks.map(t => t.id));
  return tasks.filter(t => !t.parentTaskId || !ids.has(t.parentTaskId));
}

/**
 * Return the direct children of `parentId` that are present in `allVisible`.
 * Children absent from allVisible (e.g. filtered out) are not returned.
 */
export function computeChildren(parentId: number, allVisible: Task[]): Task[] {
  const ids = new Set(allVisible.map(t => t.id));
  return allVisible.filter(s => s.parentTaskId === parentId && ids.has(s.id));
}
