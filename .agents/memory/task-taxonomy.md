---
name: Task Taxonomy Conventions
description: Valid enum values for task fields; seed data standards; scheduler wiring for morning_digest.
---

## Valid task field values

| Field | Valid values |
|---|---|
| `priority` | `urgent`, `high`, `medium`, `low` |
| `status` | `todo`, `in_progress`, `blocked`, `done` |
| `category` | `communication`, `meetings`, `deep_work`, `task_project_management`, `administrative`, `planning` |
| `recurrence` | `one_off`, `daily`, `weekly`, `custom` |
| `source` | `manual`, `agent` |

**Why:** The old seed used `"critical"` (not a valid priority), `"in-progress"` (hyphenated, not underscore), and `"completed"` (not `"done"`). These caused priority dots and status filters to produce no matches. A one-time SQL fix was run; seed.ts was also corrected.

## Scheduler (morning_digest at 7 AM)

- Implemented in `artifacts/api-server/src/scheduler.ts`
- Imported and started from `index.ts` inside the `app.listen` callback
- Uses a self-rescheduling `setTimeout` chain (no external cron library needed): fires at 7 AM on first call, then every 24 h
- Calls `askAgent(findAgent('morning_digest'), [...])` directly — no HTTP round-trip

**How to apply:** To add more scheduled agents, add a similar `runXxx()` async function and call it from `startScheduler()` with its own `msUntilNext*` helper.

## Orchestrator breakdown button

- `ListTree` icon appears on task cards where `category === 'deep_work'`
- Clicking opens `BreakdownPanel` (absolute-positioned at bottom of MyTasksPanel, zIndex 20)
- Panel streams from the `orchestrator` agent via `streamAgentChat`; passes `parent_task_id` in the prompt
- After streaming completes, calls `loadTasks()` to refresh so subtasks appear immediately
- `onBreakdown` prop is threaded through: `TaskCard` → `TaskListView` → `DailySection` → `TaskDailyView` → `MyTasksPanel`
