/**
 * Task DB operations used by agent tools (create_task, list_tasks, update_task).
 * Called from the tool dispatcher — direct DB access, no HTTP round-trip.
 */

import { db } from "@workspace/db";
import { tasksTable } from "@workspace/db";
import { eq, and, desc, ne } from "drizzle-orm";

interface CreateTaskParams {
  title: string;
  description?: string;
  category?: string;
  priority?: string;
  recurrence?: string;
  dueDate?: string | null;
  parentTaskId?: number | null;
  calendarEventId?: string | null;
  threadId?: string | null;
}

export async function createTask(params: CreateTaskParams): Promise<string> {
  try {
    const [task] = await db.insert(tasksTable).values({
      title:           params.title,
      description:     params.description ?? "",
      category:        params.category    ?? "deep_work",
      priority:        params.priority    ?? "medium",
      recurrence:      params.recurrence  ?? "one_off",
      source:          "agent",
      status:          "todo",
      dueDate:         params.dueDate         ?? null,
      parentTaskId:    params.parentTaskId    ?? null,
      calendarEventId: params.calendarEventId ?? null,
      threadId:        params.threadId        ?? null,
    }).returning();
    return JSON.stringify({ ok: true, task });
  } catch (err) {
    return JSON.stringify({ ok: false, error: String(err) });
  }
}

interface ListTasksParams {
  category?:   string;
  priority?:   string;
  recurrence?: string;
  status?:     string;
  limit?:      number;
}

export async function listTasks(params: ListTasksParams = {}): Promise<string> {
  try {
    const conditions = [];
    if (params.category)   conditions.push(eq(tasksTable.category,   params.category));
    if (params.priority)   conditions.push(eq(tasksTable.priority,   params.priority));
    if (params.recurrence) conditions.push(eq(tasksTable.recurrence, params.recurrence));
    if (params.status)     conditions.push(eq(tasksTable.status,     params.status));
    else                   conditions.push(ne(tasksTable.status,     "done")); // default: exclude done

    const tasks = await db.select()
      .from(tasksTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tasksTable.createdAt))
      .limit(params.limit ?? 50);

    return JSON.stringify(tasks);
  } catch (err) {
    return JSON.stringify({ ok: false, error: String(err) });
  }
}

export async function updateTask(id: number, patch: Partial<{
  status: string;
  priority: string;
  category: string;
  recurrence: string;
  title: string;
  description: string;
}>): Promise<string> {
  try {
    const [updated] = await db.update(tasksTable)
      .set(patch)
      .where(eq(tasksTable.id, id))
      .returning();
    if (!updated) return JSON.stringify({ ok: false, error: "Task not found" });
    return JSON.stringify({ ok: true, task: updated });
  } catch (err) {
    return JSON.stringify({ ok: false, error: String(err) });
  }
}
