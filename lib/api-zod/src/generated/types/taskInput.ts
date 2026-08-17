/**
 * Task creation input — extended with taxonomy fields.
 */

export interface TaskInput {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  category?: string;
  recurrence?: string;
  source?: string;
  /** @nullable */
  calendarEventId?: string | null;
  /** @nullable */
  threadId?: string | null;
  /** @nullable */
  parentTaskId?: number | null;
  /** @nullable */
  projectId?: number | null;
  assignee?: string;
  /** @nullable */
  dueDate?: string | null;
}
