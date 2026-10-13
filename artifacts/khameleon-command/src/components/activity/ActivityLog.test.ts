import { describe, it, expect } from 'vitest';
import { mergeActivity } from './ActivityLog';
import type { ActionReceiptData } from '@/lib/actionReceiptsApi';
import type { TaskRun } from '@/lib/taskRunApi';

const receipt = (over: Partial<ActionReceiptData>): ActionReceiptData => ({
  id: 1, description: 'x', category: 'email_sent', scope: '', outcome: 'success', target: null, detail: null,
  canUndo: false, undone: false, relatedApprovalId: null, createdAt: '2026-10-13T10:00:00Z', ...over,
});
const run = (over: Partial<TaskRun>): TaskRun => ({
  id: 'r1', commandText: 'Morning digest', triggerType: 'scheduled', agentId: 'a', agentType: 'simple', status: 'completed',
  steps: [], retryCount: 0, createdAt: '2026-10-13T09:00:00Z', updatedAt: '2026-10-13T09:00:00Z', ...over,
});

describe('mergeActivity', () => {
  it('merges receipts and finished runs newest first, skipping runs still in progress', () => {
    const out = mergeActivity(
      [receipt({ id: 1, createdAt: '2026-10-13T08:00:00Z' }), receipt({ id: 2, outcome: 'failure', createdAt: '2026-10-13T11:00:00Z' })],
      [run({ id: 'a', updatedAt: '2026-10-13T09:30:00Z' }), run({ id: 'b', status: 'running' })],
    );
    expect(out.map(e => e.id)).toEqual(['receipt-2', 'run-a', 'receipt-1']);
    expect(out[0].outcome).toBe('failed');
  });

  it('offers Undo only for reversible kinds, and Retry only for failed runs', () => {
    const [skill] = mergeActivity([receipt({ category: 'skill_set_install', canUndo: true })], []);
    const [email] = mergeActivity([receipt({ category: 'email_sent', canUndo: true })], []);
    const [done] = mergeActivity([receipt({ category: 'skill_set_install', canUndo: true, undone: true })], []);
    expect(skill.undo).toBeDefined();
    expect(email.undo).toBeUndefined();
    expect(done.undo).toBeUndefined();
    const [failed] = mergeActivity([], [run({ status: 'failed', errorMessage: 'timeout' })]);
    expect(failed.retry).toBeDefined();
    expect(failed.detail).toBe('timeout');
  });
});
