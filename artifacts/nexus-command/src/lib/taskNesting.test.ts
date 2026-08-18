import { describe, it, expect } from 'vitest';
import { computeRoots, computeChildren } from './taskNesting';
import type { Task } from './jarvisApi';

function makeTask(id: number, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    description: '',
    status: 'todo',
    priority: 'medium',
    category: 'deep_work',
    recurrence: 'one_off',
    source: 'manual',
    assignee: '',
    aiRecommendation: '',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

// ── computeRoots ────────────────────────────────────────────────────────────

describe('computeRoots', () => {
  it('returns all tasks when none have parents', () => {
    const tasks = [makeTask(1), makeTask(2)];
    expect(computeRoots(tasks).map(t => t.id)).toEqual([1, 2]);
  });

  it('parent + child both visible in Daily: child is NOT a root (it nests under parent)', () => {
    const parent = makeTask(1);
    const child  = makeTask(2, { parentTaskId: 1 });
    const roots  = computeRoots([parent, child]);
    expect(roots.map(t => t.id)).toEqual([1]);
    expect(roots.some(t => t.id === 2)).toBe(false);
  });

  it('orphaned subtask (parent filtered out) is promoted to an independent root', () => {
    // parent id 999 is NOT in the visible set — simulates a category/status filter
    // hiding the parent while the child matches the filter
    const child = makeTask(2, { parentTaskId: 999 });
    const roots = computeRoots([child]);
    expect(roots.map(t => t.id)).toEqual([2]);
  });

  it('handles a mix of normal roots, nested children, and an orphaned subtask', () => {
    const parent = makeTask(1);
    const child  = makeTask(2, { parentTaskId: 1 });
    const orphan = makeTask(3, { parentTaskId: 99 }); // parent 99 not visible
    const roots  = computeRoots([parent, child, orphan]);
    expect(roots.map(t => t.id).sort((a, b) => a - b)).toEqual([1, 3]);
  });

  it('returns an empty array for an empty input', () => {
    expect(computeRoots([])).toEqual([]);
  });
});

// ── computeChildren ─────────────────────────────────────────────────────────

describe('computeChildren', () => {
  it('returns the direct children of a parent that are in the visible set', () => {
    const parent = makeTask(1);
    const child  = makeTask(2, { parentTaskId: 1 });
    expect(computeChildren(1, [parent, child]).map(t => t.id)).toEqual([2]);
  });

  it('does not return a child whose id is absent from allVisible (filtered out)', () => {
    // child was filtered by status — only parent remains visible
    const parent = makeTask(1);
    expect(computeChildren(1, [parent])).toHaveLength(0);
  });

  it('returns all children when a parent has multiple visible children', () => {
    const parent  = makeTask(1);
    const childA  = makeTask(2, { parentTaskId: 1 });
    const childB  = makeTask(3, { parentTaskId: 1 });
    const visible = [parent, childA, childB];
    expect(computeChildren(1, visible).map(t => t.id).sort((a, b) => a - b)).toEqual([2, 3]);
  });

  it('returns an empty list when the parent has no children at all', () => {
    expect(computeChildren(1, [makeTask(1)])).toHaveLength(0);
  });
});
