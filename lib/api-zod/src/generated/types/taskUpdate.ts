/**
 * Task update input — extended with taxonomy fields.
 */

export interface TaskUpdate {
  title?: string;
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
  dueDate?: string | null;
}
