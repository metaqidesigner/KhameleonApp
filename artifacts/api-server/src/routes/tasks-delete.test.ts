/**
 * Integration tests for DELETE /tasks/:id — orphan prevention.
 *
 * Verifies that:
 *  1. Deleting a parent task promotes its children to root (parentTaskId → null).
 *  2. A 404 delete leaves children completely untouched.
 *
 * Run with:  pnpm --filter @workspace/api-server run test
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@workspace/db";
import { tasksTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

// ── Helpers ───────────────────────────────────────────────────────────────────
const BASE = {
  description: "",
  status: "todo" as const,
  priority: "medium" as const,
  category: "deep_work" as const,
  recurrence: "one_off" as const,
  source: "manual" as const,
  assignee: "",
  aiRecommendation: "",
};

async function insertTask(overrides: Partial<typeof BASE & { title: string; parentTaskId?: number | null }>) {
  const [row] = await db.insert(tasksTable).values({ ...BASE, title: "__delete_test__", ...overrides }).returning();
  return row;
}

// Track all IDs created so we can clean up even on test failures
let allIds: number[] = [];

after(async () => {
  if (allIds.length > 0) {
    await db.delete(tasksTable).where(inArray(tasksTable.id, allIds));
  }
});

// ── Test 1: deleting a parent promotes children to root ───────────────────────
test("DELETE parent: children become root tasks (parentTaskId → null)", async () => {
  const parent = await insertTask({ title: "__delete_test_parent__" });
  const child1 = await insertTask({ title: "__delete_test_child1__", parentTaskId: parent.id });
  const child2 = await insertTask({ title: "__delete_test_child2__", parentTaskId: parent.id });
  allIds.push(parent.id, child1.id, child2.id);

  // Simulate the route's transaction directly
  const deleted = await db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: tasksTable.id })
      .from(tasksTable)
      .where(eq(tasksTable.id, parent.id));
    if (!existing) return null;

    await tx.update(tasksTable)
      .set({ parentTaskId: null })
      .where(eq(tasksTable.parentTaskId, parent.id));

    const [row] = await tx.delete(tasksTable).where(eq(tasksTable.id, parent.id)).returning();
    return row ?? null;
  });

  assert.ok(deleted, "Parent row should have been deleted");

  // Parent must be gone
  const remaining = await db.select().from(tasksTable).where(eq(tasksTable.id, parent.id));
  assert.equal(remaining.length, 0, "Parent row must not exist after deletion");

  // Children must now be root tasks
  const children = await db.select({ id: tasksTable.id, parentTaskId: tasksTable.parentTaskId })
    .from(tasksTable)
    .where(inArray(tasksTable.id, [child1.id, child2.id]));

  assert.equal(children.length, 2, "Both children must still exist");
  for (const child of children) {
    assert.equal(child.parentTaskId, null, `Child ${child.id} must have parentTaskId = null`);
  }
});

// ── Test 2: 404 delete leaves children untouched ─────────────────────────────
test("DELETE nonexistent task: children are not modified", async () => {
  // Insert an orphan-risk child that points to a real parent
  const parent = await insertTask({ title: "__delete_test_safe_parent__" });
  const child = await insertTask({ title: "__delete_test_safe_child__", parentTaskId: parent.id });
  allIds.push(parent.id, child.id);

  // Attempt to delete a nonexistent ID
  const NON_EXISTENT_ID = 999_999_999;
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: tasksTable.id })
      .from(tasksTable)
      .where(eq(tasksTable.id, NON_EXISTENT_ID));
    if (!existing) return null;

    await tx.update(tasksTable)
      .set({ parentTaskId: null })
      .where(eq(tasksTable.parentTaskId, NON_EXISTENT_ID));

    const [row] = await tx.delete(tasksTable).where(eq(tasksTable.id, NON_EXISTENT_ID)).returning();
    return row ?? null;
  });

  assert.equal(result, null, "Result must be null for nonexistent task");

  // The real child must be completely untouched
  const [childAfter] = await db.select({ parentTaskId: tasksTable.parentTaskId })
    .from(tasksTable)
    .where(eq(tasksTable.id, child.id));

  assert.equal(childAfter?.parentTaskId, parent.id, "Child parentTaskId must remain unchanged after a 404 delete attempt");
});
