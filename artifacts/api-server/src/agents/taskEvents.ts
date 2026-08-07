import { EventEmitter } from "node:events";

export interface TaskSSEEvent {
  type: "status" | "steps" | "step" | "trace" | "preview" | "done" | "error";
  taskId: string;
  [key: string]: unknown;
}

/** Single in-process bus for task run SSE events. */
export const taskEvents = new EventEmitter();
taskEvents.setMaxListeners(500);

export function emitTaskEvent(taskId: string, payload: Omit<TaskSSEEvent, "taskId">) {
  taskEvents.emit(`task:${taskId}`, { taskId, ...payload });
}
