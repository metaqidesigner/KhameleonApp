import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Mic, MicOff, RefreshCw, ChevronDown, ChevronRight,
  X, RotateCcw, CheckCircle2, AlertTriangle, AlertCircle, Loader2,
  Terminal, FileText, Clock, Zap, Filter, Search,
  Calendar, Mail, Play, Plus, Tag, Repeat, CheckSquare,
  Square, Trash2, SunMedium, Coffee, Users, MessageSquare,
  ClipboardList, LayoutList, CalendarDays, Sparkles, Bot, ListTree, Pencil,
} from 'lucide-react';
import JPanel from '@/components/JPanel';
import { StatusBadge, TriggerBadge, AgentTypeBadge, StepRow, TaskRunCard } from '@/components/taskRun/TaskRunParts';
import { useJarvisStore } from '@/store/jarvisStore';
import {
  submitCommand, getTaskRuns, retryTaskRun, cancelTaskRun, streamTaskRun,
  type TaskRun, type TaskStep, type TaskRunStatus, type TriggerType,
} from '@/lib/taskRunApi';
import {
  getTasks, createTask, updateTask, deleteTask, dismissSkillSetSuggestion,
  getSchedulerStatus,
  type Task, type TaskCategory, type TaskPriority, type TaskRecurrence,
  type SchedulerStatus,
} from '@/lib/jarvisApi';
import { computeRoots, computeChildren } from '@/lib/taskNesting';
import { streamAgentChat } from '@/lib/agentsApi';
import { installSkillSetFromCatalog, confirmSkillSetInstall } from '@/lib/skillSetsApi';
import { ConfirmGate } from '@/components/ConfirmGate';

// ── Task taxonomy constants ───────────────────────────────────

const CATEGORIES: { value: TaskCategory; label: string; short: string; color: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'communication',          label: 'Communication',   short: 'Comms',    color: '#00c4b8', icon: <MessageSquare size={10} />, desc: 'Emails, chat, follow-ups' },
  { value: 'meetings',               label: 'Meetings',        short: 'Meet',     color: '#7860c2', icon: <Users size={10} />,         desc: 'Prep, notes, action items' },
  { value: 'deep_work',              label: 'Deep Work',       short: 'Deep',     color: '#c9a84c', icon: <Sparkles size={10} />,      desc: 'Reports, docs, code, designs' },
  { value: 'task_project_management', label: 'Project Mgmt',  short: 'Proj',     color: '#3b82f6', icon: <ClipboardList size={10} />, desc: 'Status, blockers, triage' },
  { value: 'administrative',         label: 'Administrative',  short: 'Admin',    color: '#e25a6e', icon: <FileText size={10} />,      desc: 'Expenses, approvals, HR' },
  { value: 'planning',               label: 'Planning',        short: 'Plan',     color: '#38cf8a', icon: <CalendarDays size={10} />,  desc: 'Daily/weekly prioritisation' },
];

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'urgent', label: 'Urgent', color: '#e25a6e' },
  { value: 'high',   label: 'High',   color: '#c9a84c' },
  { value: 'medium', label: 'Medium', color: '#00c4b8' },
  { value: 'low',    label: 'Low',    color: '#586898' },
];

const RECURRENCES: { value: TaskRecurrence; label: string; symbol: string }[] = [
  { value: 'one_off', label: 'One-off', symbol: '·' },
  { value: 'daily',   label: 'Daily',   symbol: '↺' },
  { value: 'weekly',  label: 'Weekly',  symbol: '↻' },
  { value: 'custom',  label: 'Custom',  symbol: '∞' },
];

const DAY_SECTIONS = [
  { id: 'start_of_day',  label: 'Start of Day',   time: '7–9 AM',       color: '#7860c2', icon: <Coffee size={12} />,      cats: ['planning'] },
  { id: 'core_work',     label: 'Core Work',       time: '9 AM–12 PM',   color: '#c9a84c', icon: <Sparkles size={12} />,     cats: ['deep_work'] },
  { id: 'meetings',      label: 'Meetings',        time: 'As scheduled', color: '#3b82f6', icon: <Users size={12} />,        cats: ['meetings'] },
  { id: 'communication', label: 'Communication',   time: 'Batched',      color: '#00c4b8', icon: <MessageSquare size={12} />, cats: ['communication'] },
  { id: 'administrative',label: 'Administrative',  time: 'Afternoon',    color: '#e25a6e', icon: <FileText size={12} />,     cats: ['administrative'] },
  { id: 'end_of_day',    label: 'End of Day',      time: '4–6 PM',       color: '#38cf8a', icon: <SunMedium size={12} />,    cats: ['task_project_management'] },
];

// ── Helpers ───────────────────────────────────────────────────

function getCat(v: string) { return CATEGORIES.find(c => c.value === v) ?? CATEGORIES[2]; }
function getPri(v: string) { return PRIORITIES.find(p => p.value === v) ?? PRIORITIES[2]; }
function getRec(v: string) { return RECURRENCES.find(r => r.value === v) ?? RECURRENCES[0]; }

function categoryForSection(task: Task): string {
  const map: Record<string, string> = {
    planning: 'start_of_day', deep_work: 'core_work', meetings: 'meetings',
    communication: 'communication', administrative: 'administrative', task_project_management: 'end_of_day',
  };
  return map[task.category] ?? 'core_work';
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000)   return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.round(diff / 3600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

// ── Shared task badge components ──────────────────────────────

function CategoryBadge({ value }: { value: string }) {
  const cat = getCat(value);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontFamily: 'var(--j-font-ui)', fontSize: 9, fontWeight: 600,
      letterSpacing: '0.04em',
      color: cat.color,
      background: `color-mix(in srgb, ${cat.color} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${cat.color} 28%, transparent)`,
      borderRadius: 6, padding: '2px 6px',
    }}>
      {cat.icon}{cat.short}
    </span>
  );
}

function PriorityDot({ value }: { value: string }) {
  const p = getPri(value);
  return (
    <span title={p.label} style={{
      width: 7, height: 7, borderRadius: '50%',
      background: p.color, flexShrink: 0,
      boxShadow: `0 0 5px ${p.color}55`,
    }} />
  );
}

function RecurrencePill({ value }: { value: string }) {
  if (value === 'one_off') return null;
  const r = getRec(value);
  return (
    <span style={{
      fontFamily: 'var(--j-font-mono)', fontSize: 9,
      color: 'var(--j-text-muted)', padding: '1px 5px',
      border: '1px solid rgba(120,168,220,0.18)', borderRadius: 5,
    }}>
      {r.symbol} {r.label}
    </span>
  );
}

// ── Subtask progress pill ─────────────────────────────────────

function SubtaskProgressPill({ done, total }: { done: number; total: number }) {
  const allDone = done === total;
  const color = allDone ? 'var(--j-green)' : 'rgba(120,168,220,0.7)';
  return (
    <span title={`${done} of ${total} subtasks done`} style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontFamily: 'var(--j-font-mono)', fontSize: 9, fontWeight: 700,
      color,
      background: allDone
        ? 'color-mix(in srgb, var(--j-green) 12%, transparent)'
        : 'rgba(120,168,220,0.08)',
      border: `1px solid ${allDone ? 'color-mix(in srgb, var(--j-green) 28%, transparent)' : 'rgba(120,168,220,0.18)'}`,
      borderRadius: 6, padding: '2px 6px',
      flexShrink: 0,
    }}>
      {done}&thinsp;/&thinsp;{total}&nbsp;✓
    </span>
  );
}

// ── Descendant-ID collector (for cycle prevention) ────────────

/** Returns the set of IDs that are descendants of `rootId` in `allTasks`. */
function collectDescendants(rootId: number, allTasks: Task[]): Set<number> {
  const result = new Set<number>();
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const t of allTasks) {
      if (t.parentTaskId === id && !result.has(t.id)) {
        result.add(t.id);
        queue.push(t.id);
      }
    }
  }
  return result;
}

// ── Task card ─────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  onToggle: (id: number, done: boolean) => void;
  onDelete: (id: number) => void;
  onBreakdown?: (task: Task) => void;
  /** design-spec.md §15.2 - accept/dismiss a contextually-suggested Skill Set. */
  onAcceptSuggestion?: (task: Task) => void;
  onDismissSuggestion?: (task: Task) => void;
  suggestionBusy?: boolean;
  /** Full unfiltered task list — enables the inline parent-picker edit */
  allTasks?: Task[];
  onSetParent?: (id: number, parentTaskId: number | null) => Promise<void>;
  compact?: boolean;
  indent?: boolean;
  subtaskProgress?: { done: number; total: number };
}

function TaskCard({ task, onToggle, onDelete, onBreakdown, onAcceptSuggestion, onDismissSuggestion, suggestionBusy, allTasks, onSetParent, compact, indent, subtaskProgress }: TaskCardProps) {
  const pri = getPri(task.priority);
  const isDone = task.status === 'done';
  const [editingParent, setEditingParent] = useState(false);
  const [pendingParent, setPendingParent] = useState<number | null>(task.parentTaskId ?? null);
  const [savingParent, setSavingParent] = useState(false);

  // Candidates: top-level tasks only, excluding this task and all its descendants
  const descendants = allTasks ? collectDescendants(task.id, allTasks) : new Set<number>();
  const parentCandidates = (allTasks ?? []).filter(
    t => !t.parentTaskId && t.id !== task.id && !descendants.has(t.id),
  );

  const handleSaveParent = async () => {
    if (!onSetParent) return;
    setSavingParent(true);
    try {
      await onSetParent(task.id, pendingParent);
      setEditingParent(false);
    } finally {
      setSavingParent(false);
    }
  };

  return (
    <div style={{ borderBottom: '1px solid rgba(120,168,220,0.06)' }}>
      {/* ── Main card row ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: compact ? '5px 10px' : '7px 12px',
        paddingLeft: indent ? (compact ? 26 : 28) : (compact ? 10 : 12),
        borderLeft: indent ? 'none' : `2px solid ${pri.color}`,
        background: isDone ? 'rgba(0,0,0,0.1)' : indent ? 'rgba(120,96,194,0.03)' : 'transparent',
        transition: 'background 0.15s',
        opacity: isDone ? 0.5 : 1,
        position: 'relative',
      }}>
        {/* Subtask connector */}
        {indent && (
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'rgba(120,96,194,0.35)', fontSize: 9, lineHeight: 1, userSelect: 'none',
          }}>└</span>
        )}

        {/* Status toggle */}
        <button
          onClick={() => onToggle(task.id, !isDone)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: isDone ? 'var(--j-green)' : 'var(--j-text-faint)', flexShrink: 0 }}
          title={isDone ? 'Mark to-do' : 'Mark done'}
        >
          {isDone ? <CheckCircle2 size={14} /> : <Square size={14} />}
        </button>

        {/* Priority dot */}
        <PriorityDot value={task.priority} />

        {/* Title */}
        <span style={{
          flex: 1, fontFamily: 'var(--j-font-ui)', fontSize: indent ? 11 : 12,
          color: isDone ? 'var(--j-text-muted)' : indent ? 'var(--j-text-muted)' : 'var(--j-text)',
          textDecoration: isDone ? 'line-through' : 'none',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {task.title}
        </span>

        {/* Right-side badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          {!indent && subtaskProgress && subtaskProgress.total > 0 && (
            <SubtaskProgressPill done={subtaskProgress.done} total={subtaskProgress.total} />
          )}
          {!indent && <CategoryBadge value={task.category} />}
          <RecurrencePill value={task.recurrence} />
          {task.source === 'agent' && (
            <span title="Created by agent" style={{ color: 'var(--j-violet)', display: 'flex' }}>
              <Bot size={10} />
            </span>
          )}
          {task.dueDate && (
            <span className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)' }}>
              {task.dueDate}
            </span>
          )}
          {!task.parentTaskId && onBreakdown && (
            <button
              onClick={() => onBreakdown(task)}
              style={{
                background: 'rgba(120,96,194,0.12)',
                border: '1px solid rgba(120,96,194,0.28)',
                borderRadius: 5,
                cursor: 'pointer', padding: '1px 5px',
                display: 'flex', alignItems: 'center', gap: 3,
                color: 'rgba(180,150,255,0.85)', flexShrink: 0,
                fontFamily: 'var(--j-font-ui)', fontSize: 9, fontWeight: 600,
                letterSpacing: '0.04em',
              }}
              title="Break into subtasks (Orchestrator)"
            >
              <Zap size={8} /> Decompose
            </button>
          )}
          {/* Set / change parent button */}
          {onSetParent && (
            <button
              onClick={() => { setPendingParent(task.parentTaskId ?? null); setEditingParent(e => !e); }}
              title={task.parentTaskId ? 'Change parent task' : 'Set parent task'}
              style={{
                background: editingParent
                  ? 'rgba(0,196,184,0.12)'
                  : task.parentTaskId ? 'rgba(120,96,194,0.1)' : 'none',
                border: editingParent
                  ? '1px solid rgba(0,196,184,0.3)'
                  : task.parentTaskId ? '1px solid rgba(120,96,194,0.25)' : 'none',
                borderRadius: 5,
                cursor: 'pointer', padding: editingParent || task.parentTaskId ? '1px 5px' : '0',
                display: 'flex', alignItems: 'center', gap: 3,
                color: editingParent ? 'var(--j-teal)' : task.parentTaskId ? 'rgba(120,96,194,0.8)' : 'rgba(120,168,220,0.25)',
                flexShrink: 0,
              }}
            >
              <ListTree size={9} />
            </button>
          )}
          <button
            onClick={() => onDelete(task.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'rgba(120,168,220,0.2)', flexShrink: 0 }}
            title="Delete"
          >
            <Trash2 size={10} />
          </button>
        </div>
      </div>

      {/* ── Inline parent-edit tray ── */}
      {editingParent && onSetParent && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px 6px',
          paddingLeft: indent ? 28 : 12,
          background: 'rgba(0,196,184,0.04)',
          borderTop: '1px solid rgba(0,196,184,0.1)',
          animation: 'jarvis-fadein 0.15s ease both',
        }}>
          <ListTree size={9} style={{ color: 'var(--j-teal)', flexShrink: 0 }} />
          <select
            value={pendingParent ?? ''}
            onChange={e => setPendingParent(e.target.value ? Number(e.target.value) : null)}
            style={{
              flex: 1, minWidth: 0,
              background: 'rgba(8,14,32,0.9)', border: '1px solid rgba(0,196,184,0.25)',
              color: 'var(--j-text)', fontFamily: 'var(--j-font-ui)', fontSize: 10,
              borderRadius: 5, padding: '3px 7px', cursor: 'pointer',
            }}
          >
            <option value="">No parent (top-level task)</option>
            {parentCandidates.map(t => (
              <option key={t.id} value={t.id}>
                {t.title.length > 60 ? t.title.slice(0, 57) + '…' : t.title}
              </option>
            ))}
          </select>
          <button
            onClick={handleSaveParent}
            disabled={savingParent}
            className="j-btn-primary"
            style={{ height: 24, padding: '0 10px', fontSize: 10, flexShrink: 0 }}
          >
            {savingParent
              ? <Loader2 size={9} style={{ animation: 'jarvis-spin 0.7s linear infinite' }} />
              : 'Save'}
          </button>
          <button
            onClick={() => setEditingParent(false)}
            className="j-btn-ghost"
            style={{ height: 24, padding: '0 8px', fontSize: 10, flexShrink: 0 }}
          >
            <X size={9} />
          </button>
        </div>
      )}

      {/* ── §15.2 contextual Skill Set suggestion — "accept or dismiss with one action" ── */}
      {task.skillSetSuggestion && (onAcceptSuggestion || onDismissSuggestion) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 12px',
          paddingLeft: indent ? 28 : 12,
          background: 'rgba(120,96,194,0.05)',
          borderTop: '1px solid rgba(120,96,194,0.12)',
        }}>
          <Sparkles size={10} style={{ color: 'rgba(180,150,255,0.85)', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 10, color: 'var(--j-text-muted)', fontFamily: 'var(--j-font-ui)' }}>
            Try the <strong style={{ color: 'rgba(180,150,255,0.9)' }}>{task.skillSetSuggestion.name}</strong> Skill Set — {task.skillSetSuggestion.reason}
          </span>
          <button
            onClick={() => onAcceptSuggestion?.(task)}
            disabled={suggestionBusy}
            className="j-btn-ghost"
            style={{ height: 22, padding: '0 8px', fontSize: 9, flexShrink: 0, borderColor: 'rgba(120,96,194,0.3)', color: 'rgba(180,150,255,0.85)' }}
          >
            {suggestionBusy ? '…' : 'INSTALL'}
          </button>
          <button
            onClick={() => onDismissSuggestion?.(task)}
            disabled={suggestionBusy}
            className="j-btn-ghost"
            style={{ height: 22, padding: '0 8px', fontSize: 9, flexShrink: 0 }}
          >
            DISMISS
          </button>
        </div>
      )}
    </div>
  );
}

// ── Create task form ──────────────────────────────────────────

interface CreateTaskFormProps {
  onSave: (task: Omit<Parameters<typeof createTask>[0], never>) => Promise<void>;
  onCancel: () => void;
  defaultCategory?: TaskCategory;
  /** All existing tasks — used to populate the "Parent task" picker */
  availableTasks?: Task[];
}

function CreateTaskForm({ onSave, onCancel, defaultCategory, availableTasks }: CreateTaskFormProps) {
  const [title,        setTitle]        = useState('');
  const [category,     setCategory]     = useState<TaskCategory>(defaultCategory ?? 'deep_work');
  const [priority,     setPriority]     = useState<TaskPriority>('medium');
  const [recurrence,   setRecurrence]   = useState<TaskRecurrence>('one_off');
  const [dueDate,      setDueDate]      = useState('');
  const [parentTaskId, setParentTaskId] = useState<number | null>(null);
  const [saving,       setSaving]       = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), category, priority, recurrence, dueDate: dueDate || null, parentTaskId });
    } finally { setSaving(false); }
  };

  const selStyle: React.CSSProperties = {
    background: 'rgba(8,14,32,0.8)', border: '1px solid rgba(120,168,220,0.18)',
    color: 'var(--j-text)', fontFamily: 'var(--j-font-ui)', fontSize: 11,
    borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
  };

  // Only non-subtask tasks can be selected as parent (prevents deep nesting)
  const parentCandidates = (availableTasks ?? []).filter(t => !t.parentTaskId);

  return (
    <div style={{
      background: 'rgba(8,14,32,0.9)', border: '1px solid rgba(0,196,184,0.2)',
      borderRadius: 10, padding: '12px', marginBottom: 8,
      animation: 'jarvis-fadein 0.2s ease both',
    }}>
      <input
        ref={titleRef}
        className="j-input"
        placeholder="Task title…"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
        style={{ height: 36, fontSize: 13, marginBottom: 8 }}
      />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <select value={category} onChange={e => setCategory(e.target.value as TaskCategory)} style={selStyle}>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} style={selStyle}>
          {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select value={recurrence} onChange={e => setRecurrence(e.target.value as TaskRecurrence)} style={selStyle}>
          {RECURRENCES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          style={{ ...selStyle, cursor: 'pointer' }}
          placeholder="Due date (optional)"
        />
      </div>

      {/* Parent task picker */}
      {parentCandidates.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <select
            value={parentTaskId ?? ''}
            onChange={e => setParentTaskId(e.target.value ? Number(e.target.value) : null)}
            style={{ ...selStyle, width: '100%', color: parentTaskId ? 'var(--j-text)' : 'var(--j-text-faint)' }}
          >
            <option value="">No parent (top-level task)</option>
            {parentCandidates.map(t => (
              <option key={t.id} value={t.id}>
                {t.title.length > 60 ? t.title.slice(0, 57) + '…' : t.title}
              </option>
            ))}
          </select>
          {parentTaskId && (
            <div style={{
              marginTop: 4, fontFamily: 'var(--j-font-ui)', fontSize: 10,
              color: 'rgba(120,96,194,0.9)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <ListTree size={9} />
              Will appear as a subtask indented under the selected parent
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={handleSave}
          disabled={!title.trim() || saving}
          className="j-btn-primary"
          style={{ height: 30, padding: '0 16px', fontSize: 11 }}
        >
          {saving ? <Loader2 size={11} style={{ animation: 'jarvis-spin 0.7s linear infinite' }} /> : <Plus size={11} />}
          Add Task
        </button>
        <button onClick={onCancel} className="j-btn-ghost" style={{ height: 30, padding: '0 12px', fontSize: 11 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Task list view ────────────────────────────────────────────

type GroupByKey = 'category' | 'priority' | 'recurrence' | 'status';

function groupTasks(tasks: Task[], by: GroupByKey): { key: string; label: string; color: string; tasks: Task[] }[] {
  if (by === 'category') {
    return CATEGORIES.map(c => ({
      key: c.value, label: c.label, color: c.color,
      tasks: tasks.filter(t => t.category === c.value),
    })).filter(g => g.tasks.length > 0);
  }
  if (by === 'priority') {
    return PRIORITIES.map(p => ({
      key: p.value, label: p.label, color: p.color,
      tasks: tasks.filter(t => t.priority === p.value),
    })).filter(g => g.tasks.length > 0);
  }
  if (by === 'recurrence') {
    return RECURRENCES.map(r => ({
      key: r.value, label: r.label, color: 'var(--j-text-muted)',
      tasks: tasks.filter(t => t.recurrence === r.value),
    })).filter(g => g.tasks.length > 0);
  }
  // status
  const statuses = [
    { key: 'todo',        label: 'To-Do',       color: 'var(--j-text-muted)' },
    { key: 'in_progress', label: 'In Progress',  color: 'var(--j-teal)' },
    { key: 'blocked',     label: 'Blocked',      color: 'var(--j-coral)' },
    { key: 'done',        label: 'Done',         color: 'var(--j-green)' },
  ];
  return statuses.map(s => ({
    ...s, tasks: tasks.filter(t => t.status === s.key),
  })).filter(g => g.tasks.length > 0);
}

interface TaskListViewProps {
  tasks: Task[];
  allTasks?: Task[];
  /** Unfiltered full task list — used to compute accurate subtask progress regardless of active filters */
  unfilteredTasks?: Task[];
  groupBy: GroupByKey;
  onToggle: (id: number, done: boolean) => void;
  onDelete: (id: number) => void;
  onBreakdown?: (task: Task) => void;
  /** design-spec.md §15.2 - only the List view surfaces suggestions, not the Daily view. */
  onAcceptSuggestion?: (task: Task) => void;
  onDismissSuggestion?: (task: Task) => void;
  suggestionBusyId?: number | null;
  onSetParent?: (id: number, parentTaskId: number | null) => Promise<void>;
}

function TaskListView({ tasks, allTasks, unfilteredTasks, groupBy, onToggle, onDelete, onBreakdown, onAcceptSuggestion, onDismissSuggestion, suggestionBusyId, onSetParent }: TaskListViewProps) {
  // A task is a "root" in the current view if it has no parent OR its parent isn't currently visible.
  // This preserves filter semantics: a filtered-in subtask whose parent is filtered out still appears.
  const visibleIds = new Set(tasks.map(t => t.id));
  const rootTasks = tasks.filter(t => !t.parentTaskId || !visibleIds.has(t.parentTaskId));
  const groups = groupTasks(rootTasks, groupBy);
  // Use allTasks pool if provided (for unfiltered child lookup), else fall back to visible tasks
  const taskPool = allTasks ?? tasks;
  // Use unfiltered pool for accurate subtask progress counts (unaffected by active filters)
  const progressPool = unfilteredTasks ?? taskPool;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (tasks.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 10, padding: 40, color: 'var(--j-text-faint)',
      }}>
        <CheckSquare size={28} style={{ opacity: 0.3 }} />
        <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12 }}>No tasks yet — add one above or run Morning Digest</span>
      </div>
    );
  }

  return (
    <div>
      {groups.map(g => {
        const isCollapsed = collapsed[g.key];
        // Count includes subtasks for the group total
        const subtaskCount = g.tasks.reduce((n, t) => n + taskPool.filter(s => s.parentTaskId === t.id).length, 0);
        return (
          <div key={g.key} style={{ marginBottom: 2 }}>
            <div
              onClick={() => setCollapsed(c => ({ ...c, [g.key]: !c[g.key] }))}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 12px', cursor: 'pointer', userSelect: 'none',
                background: 'rgba(120,168,220,0.03)',
              }}
            >
              {isCollapsed
                ? <ChevronRight size={10} style={{ color: 'var(--j-text-faint)' }} />
                : <ChevronDown size={10} style={{ color: 'var(--j-text-faint)' }} />}
              <span style={{
                fontFamily: 'var(--j-font-ui)', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                color: typeof g.color === 'string' && g.color.startsWith('#') ? g.color : undefined,
                ...(typeof g.color === 'string' && g.color.startsWith('var') ? { color: g.color } : {}),
              }}>
                {g.label}
              </span>
              <span style={{
                fontFamily: 'var(--j-font-mono)', fontSize: 9,
                color: 'var(--j-text-faint)',
                background: 'rgba(120,168,220,0.1)',
                borderRadius: 8, padding: '1px 6px',
              }}>
                {g.tasks.length + subtaskCount}
              </span>
            </div>
            {!isCollapsed && g.tasks.map(t => {
              // Only nest children that are also in the visible set (for rendering)
              const children = taskPool.filter(s => s.parentTaskId === t.id && visibleIds.has(s.id));
              // Compute progress from unfiltered pool so counts are accurate regardless of active filters
              const allChildren = progressPool.filter(s => s.parentTaskId === t.id);
              const subtaskProgress = allChildren.length > 0
                ? { done: allChildren.filter(c => c.status === 'done').length, total: allChildren.length }
                : undefined;
              return (
                <React.Fragment key={t.id}>
                  <TaskCard task={t} onToggle={onToggle} onDelete={onDelete} onBreakdown={onBreakdown} onAcceptSuggestion={onAcceptSuggestion} onDismissSuggestion={onDismissSuggestion} suggestionBusy={suggestionBusyId === t.id} allTasks={progressPool} onSetParent={onSetParent} subtaskProgress={subtaskProgress} />
                  {children.map(child => (
                    <TaskCard key={child.id} task={child} onToggle={onToggle} onDelete={onDelete} onBreakdown={onBreakdown} allTasks={progressPool} onSetParent={onSetParent} indent />
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Daily view ────────────────────────────────────────────────

interface DailySectionProps {
  section: typeof DAY_SECTIONS[number];
  tasks: Task[];
  allTasks: Task[];
  /** Unfiltered full task list — for accurate subtask progress counts */
  unfilteredTasks?: Task[];
  onToggle: (id: number, done: boolean) => void;
  onDelete: (id: number) => void;
  onBreakdown?: (task: Task) => void;
  onSetParent?: (id: number, parentTaskId: number | null) => Promise<void>;
}

function DailySection({ section, tasks, allTasks, unfilteredTasks, onToggle, onDelete, onBreakdown, onSetParent }: DailySectionProps) {
  const progressPool = unfilteredTasks ?? allTasks;
  const [open, setOpen] = useState(true);
  // tasks = pre-computed roots for this section (from TaskDailyView).
  // allTasks = ALL currently-visible tasks — use this pool for child lookup so
  // children (which may have a different category) are always findable.
  const recurring = tasks.filter(t => t.recurrence !== 'one_off');
  const oneOff    = tasks.filter(t => t.recurrence === 'one_off');
  // Total count = roots + their visible children
  const subtaskCount = tasks.reduce((n, t) => n + computeChildren(t.id, allTasks).length, 0);
  const total = tasks.length + subtaskCount;

  function renderWithChildren(t: Task, compact: boolean) {
    const children = computeChildren(t.id, allTasks);
    // Use unfiltered pool for accurate progress counts regardless of active filters
    const allChildren = progressPool.filter(s => s.parentTaskId === t.id);
    const subtaskProgress = allChildren.length > 0
      ? { done: allChildren.filter(c => c.status === 'done').length, total: allChildren.length }
      : undefined;
    return (
      <React.Fragment key={t.id}>
        <TaskCard task={t} onToggle={onToggle} onDelete={onDelete} onBreakdown={onBreakdown} allTasks={progressPool} onSetParent={onSetParent} compact={compact} subtaskProgress={subtaskProgress} />
        {children.map(child => (
          <TaskCard key={child.id} task={child} onToggle={onToggle} onDelete={onDelete} onBreakdown={onBreakdown} allTasks={progressPool} onSetParent={onSetParent} compact={compact} indent />
        ))}
      </React.Fragment>
    );
  }

  return (
    <div style={{
      background: 'rgba(8,14,32,0.5)',
      border: `1px solid color-mix(in srgb, ${section.color} 18%, transparent)`,
      borderLeft: `3px solid ${section.color}`,
      borderRadius: 8, overflow: 'hidden', marginBottom: 6,
    }}>
      {/* Section header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
          cursor: 'pointer', userSelect: 'none',
          background: `color-mix(in srgb, ${section.color} 6%, transparent)`,
        }}
      >
        <span style={{ color: section.color, display: 'flex' }}>{section.icon}</span>
        <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, fontWeight: 700, color: '#fff', flex: 1 }}>
          {section.label}
        </span>
        <span className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)' }}>{section.time}</span>
        {total > 0 && (
          <span style={{
            fontFamily: 'var(--j-font-mono)', fontSize: 8, fontWeight: 700,
            color: section.color,
            background: `color-mix(in srgb, ${section.color} 15%, transparent)`,
            borderRadius: 8, padding: '1px 6px',
          }}>{total}</span>
        )}
        {open
          ? <ChevronDown size={10} style={{ color: 'var(--j-text-faint)' }} />
          : <ChevronRight size={10} style={{ color: 'var(--j-text-faint)' }} />}
      </div>

      {open && (
        <div>
          {/* Recurring tasks + their subtasks first */}
          {recurring.map(t => renderWithChildren(t, true))}
          {/* One-off tasks + their subtasks */}
          {oneOff.map(t => renderWithChildren(t, true))}
          {tasks.length === 0 && (
            <div style={{ padding: '8px 12px', fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'var(--j-text-faint)' }}>
              No tasks in this section
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskDailyView({ tasks, allTasks, unfilteredTasks, onToggle, onDelete, onBreakdown, onSetParent }: TaskListViewProps) {
  // taskPool = all currently-visible tasks (after filters), used as the full relationship pool
  const taskPool = allTasks ?? tasks;
  // Determine roots from the full visible pool:
  // - tasks with no parent, OR tasks whose parent was filtered out (promoted to independent rows)
  const roots = computeRoots(taskPool);
  // Bucket roots into day sections; orphaned subtasks are bucketed by their own category
  const bucketed = DAY_SECTIONS.map(s => ({
    section: s,
    sectionTasks: roots.filter(t => categoryForSection(t) === s.id),
  }));

  return (
    <div>
      {bucketed.map(b => (
        <DailySection
          key={b.section.id}
          section={b.section}
          tasks={b.sectionTasks}
          allTasks={taskPool}
          unfilteredTasks={unfilteredTasks}
          onToggle={onToggle}
          onDelete={onDelete}
          onBreakdown={onBreakdown}
          onSetParent={onSetParent}
        />
      ))}
    </div>
  );
}

// ── Orchestrator breakdown panel ──────────────────────────────

interface BreakdownPanelProps {
  task: Task;
  onClose: () => void;
  onDone: () => void;
}

function BreakdownPanel({ task, onClose, onDone }: BreakdownPanelProps) {
  const [text,   setText]   = useState('');
  const [status, setStatus] = useState<'running' | 'done' | 'error'>('running');
  const [errMsg, setErrMsg] = useState('');
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const messages = [
      {
        role: 'user' as const,
        content:
          `Break down this task into actionable subtasks:\n\n` +
          `Task ID: ${task.id}\n` +
          `Category: ${task.category}\n` +
          `Title: ${task.title}` +
          (task.description ? `\nDescription: ${task.description}` : '') +
          `\n\nPlease create 3–8 concrete, ordered subtasks. ` +
          `Set parent_task_id to ${task.id} for each subtask you create.`,
      },
    ];

    const stop = streamAgentChat(
      'orchestrator',
      messages,
      (token) => setText(prev => prev + token),
      () => { setStatus('done'); onDone(); },
      (err)  => { setStatus('error'); setErrMsg(err); },
    );
    stopRef.current = stop;
    return () => { stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  const orchColor = '#7860c2';

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(6,10,26,0.97)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      border: `1px solid color-mix(in srgb, ${orchColor} 30%, transparent)`,
      borderBottom: 'none',
      borderRadius: '12px 12px 0 0',
      maxHeight: '55%', display: 'flex', flexDirection: 'column',
      animation: 'jarvis-fadein 0.2s ease both', zIndex: 20,
      boxShadow: `0 -8px 40px rgba(0,0,0,0.5), 0 0 0 1px color-mix(in srgb, ${orchColor} 12%, transparent)`,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
        borderBottom: '1px solid rgba(120,168,220,0.07)', flexShrink: 0,
      }}>
        <Bot size={12} style={{ color: orchColor }} />
        <span style={{
          fontFamily: 'var(--j-font-ui)', fontSize: 10, color: orchColor,
          letterSpacing: '0.12em',
        }}>ORCHESTRATOR</span>
        <span style={{
          fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'var(--j-text-muted)',
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          Breaking down: {task.title}
        </span>
        {status === 'running' && (
          <Loader2 size={11} style={{ color: orchColor, animation: 'jarvis-spin 0.8s linear infinite', flexShrink: 0 }} />
        )}
        {status === 'done' && (
          <CheckCircle2 size={11} style={{ color: 'var(--j-green)', flexShrink: 0 }} />
        )}
        <button
          onClick={() => { stopRef.current?.(); onClose(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--j-text-faint)', display: 'flex', padding: 0, flexShrink: 0 }}
          title="Close"
        >
          <X size={12} />
        </button>
      </div>

      {/* Streaming content */}
      <div className="scrollbar-jarvis" style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
        {status === 'error' ? (
          <div style={{ color: 'var(--j-coral)', fontFamily: 'var(--j-font-ui)', fontSize: 11, lineHeight: 1.5 }}>
            {errMsg || 'An error occurred while contacting the Orchestrator agent. Check that the API key is configured.'}
          </div>
        ) : (
          <div style={{
            fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'var(--j-text)',
            lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {text || (status === 'running' && (
              <span style={{ color: 'var(--j-text-faint)' }}>Analysing task and planning subtasks…</span>
            ))}
            {status === 'running' && <span className="j-blink" style={{ color: orchColor }}>▌</span>}
          </div>
        )}
      </div>

      {/* Footer */}
      {(status === 'done' || status === 'error') && (
        <div style={{
          padding: '8px 14px', borderTop: '1px solid rgba(120,168,220,0.07)',
          display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0,
        }}>
          {status === 'done' && (
            <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 10, color: 'var(--j-green)', flex: 1, alignSelf: 'center' }}>
              ✓ Subtasks created and added to your task list
            </span>
          )}
          <button onClick={onClose} className="j-btn-ghost" style={{ height: 26, padding: '0 12px', fontSize: 10 }}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}

// ── My Tasks panel ────────────────────────────────────────────

function MyTasksPanel() {
  const [tasks,               setTasks]               = useState<Task[]>([]);
  const [allTasksUnfiltered,  setAllTasksUnfiltered]  = useState<Task[]>([]);
  const [loading,             setLoading]             = useState(true);
  const [view,                setView]                = useState<'list' | 'daily'>('list');
  const [groupBy,             setGroupBy]             = useState<GroupByKey>('category');
  const [catFilter,           setCatFilter]           = useState('');
  const [priFilter,           setPriFilter]           = useState('');
  const [recFilter,           setRecFilter]           = useState('');
  const [statusFilter,        setStatusFilter]        = useState('');
  const [searchQ,             setSearchQ]             = useState('');
  const [creating,            setCreating]            = useState(false);
  const [breakdownTask,       setBreakdownTask]       = useState<Task | null>(null);

  // §15.2 contextual Skill Set suggestions
  const [suggestionBusyId, setSuggestionBusyId] = useState<number | null>(null);
  const [suggestionError,  setSuggestionError]  = useState<string>();
  const [suggestionGate,   setSuggestionGate]   = useState<{ skillSetId: number; skillSetName: string; approvalId: number } | null>(null);

  const loadTasks = useCallback(async () => {
    const [data, allData] = await Promise.all([
      getTasks({
        category:   catFilter   || undefined,
        priority:   priFilter   || undefined,
        recurrence: recFilter   || undefined,
        status:     statusFilter || undefined,
        q:          searchQ.length > 1 ? searchQ : undefined,
      }),
      getTasks(), // unfiltered — for accurate subtask progress counts
    ]);
    setTasks(data);
    setAllTasksUnfiltered(allData);
    setLoading(false);
  }, [catFilter, priFilter, recFilter, statusFilter, searchQ]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleToggle = async (id: number, done: boolean) => {
    const nextStatus = done ? 'done' : 'todo';
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: nextStatus } : t));
    setAllTasksUnfiltered(prev => prev.map(t => t.id === id ? { ...t, status: nextStatus } : t));
    await updateTask(id, { status: nextStatus });
  };

  const handleDelete = async (id: number) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    setAllTasksUnfiltered(prev => prev.filter(t => t.id !== id));
    await deleteTask(id);
  };

  const handleCreate = async (input: Parameters<typeof createTask>[0]) => {
    const task = await createTask(input);
    setTasks(prev => [task, ...prev]);
    setAllTasksUnfiltered(prev => [task, ...prev]);
    setCreating(false);
  };

  const handleSetParent = async (id: number, parentTaskId: number | null) => {
    await updateTask(id, { parentTaskId });
    // Update local state optimistically so the hierarchy re-renders immediately
    const patcher = (t: Task) => t.id === id ? { ...t, parentTaskId } : t;
    setTasks(prev => prev.map(patcher));
    setAllTasksUnfiltered(prev => prev.map(patcher));
  };

  const handleBreakdown = (task: Task) => {
    setBreakdownTask(task);
  };

  const handleBreakdownDone = () => {
    // Reload tasks so newly-created subtasks appear
    loadTasks();
  };

  // §15.2: install an existing catalog Skill Set that was suggested for this task.
  // A null approvalId means it installed immediately (today's real-world case,
  // since both starter Skill Sets request no new tools/integrations) - a real
  // one means a hard gate is required, same tiering as skills.tsx's own flow.
  const handleAcceptSuggestion = async (task: Task) => {
    if (!task.skillSetSuggestion) return;
    setSuggestionBusyId(task.id);
    setSuggestionError(undefined);
    try {
      const { skillSet, approvalId } = await installSkillSetFromCatalog(task.skillSetSuggestion.skillSetId);
      if (approvalId) {
        setSuggestionGate({ skillSetId: skillSet.id, skillSetName: skillSet.name, approvalId });
      } else {
        loadTasks(); // the suggestion disappears next fetch - its target is no longer 'available'
      }
    } catch (err) {
      setSuggestionError(err instanceof Error ? err.message : 'Failed to install suggested Skill Set');
    } finally {
      setSuggestionBusyId(null);
    }
  };

  const handleDismissSuggestion = async (task: Task) => {
    setSuggestionError(undefined);
    try {
      await dismissSkillSetSuggestion(task.id);
      loadTasks();
    } catch (err) {
      setSuggestionError(err instanceof Error ? err.message : 'Failed to dismiss suggestion');
    }
  };

  const handleConfirmSuggestionInstall = async () => {
    if (!suggestionGate) return;
    try {
      await confirmSkillSetInstall(suggestionGate.skillSetId, suggestionGate.approvalId);
      setSuggestionGate(null);
      loadTasks();
    } catch (err) {
      setSuggestionError(err instanceof Error ? err.message : 'Failed to confirm install');
      throw err; // keeps the gate open so the user can retry, matching skills.tsx's convention
    }
  };

  const selStyle: React.CSSProperties = {
    background: 'rgba(8,14,32,0.8)', border: '1px solid rgba(120,168,220,0.15)',
    color: 'var(--j-text-muted)', fontFamily: 'var(--j-font-ui)', fontSize: 10,
    borderRadius: 6, padding: '3px 7px', cursor: 'pointer', height: 28,
  };

  const activeTasks = tasks.filter(t => t.status !== 'done');
  const done = tasks.filter(t => t.status === 'done').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* ── Filter / action bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
        borderBottom: '1px solid rgba(120,168,220,0.07)', flexShrink: 0, flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 140px' }}>
          <Search size={10} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--j-text-faint)' }} />
          <input
            className="j-input"
            style={{ height: 28, paddingLeft: 24, fontSize: 11 }}
            placeholder="Search tasks…"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
        </div>

        {/* Category filter */}
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={selStyle}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>

        {/* Priority filter */}
        <select value={priFilter} onChange={e => setPriFilter(e.target.value)} style={selStyle}>
          <option value="">All priorities</option>
          {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>

        {/* Recurrence filter */}
        <select value={recFilter} onChange={e => setRecFilter(e.target.value)} style={selStyle}>
          <option value="">Any recurrence</option>
          {RECURRENCES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>

        {/* Status filter */}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selStyle}>
          <option value="">All statuses</option>
          <option value="todo">To-Do</option>
          <option value="in_progress">In Progress</option>
          <option value="blocked">Blocked</option>
          <option value="done">Done</option>
        </select>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Group By (list view only) */}
        {view === 'list' && (
          <select value={groupBy} onChange={e => setGroupBy(e.target.value as GroupByKey)} style={{ ...selStyle, borderColor: 'rgba(120,168,220,0.22)' }}>
            <option value="category">Group: Category</option>
            <option value="priority">Group: Priority</option>
            <option value="recurrence">Group: Recurrence</option>
            <option value="status">Group: Status</option>
          </select>
        )}

        {/* View toggle */}
        <div style={{ display: 'flex', border: '1px solid rgba(120,168,220,0.15)', borderRadius: 7, overflow: 'hidden' }}>
          {[
            { v: 'list',  icon: <LayoutList size={10} />,   label: 'List' },
            { v: 'daily', icon: <CalendarDays size={10} />, label: 'Daily' },
          ].map(b => (
            <button
              key={b.v}
              onClick={() => setView(b.v as 'list' | 'daily')}
              style={{
                height: 28, padding: '0 10px', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                fontFamily: 'var(--j-font-ui)', fontSize: 10,
                background: view === b.v ? 'rgba(0,196,184,0.14)' : 'transparent',
                color: view === b.v ? 'var(--j-teal)' : 'var(--j-text-faint)',
              }}
            >
              {b.icon}{b.label}
            </button>
          ))}
        </div>

        {/* Add task */}
        <button
          onClick={() => setCreating(c => !c)}
          className="j-btn-primary"
          style={{ height: 28, padding: '0 12px', fontSize: 10 }}
        >
          <Plus size={11} /> New Task
        </button>

        {/* Refresh */}
        <button onClick={loadTasks} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--j-text-faint)', display: 'flex' }}>
          <RefreshCw size={12} />
        </button>
      </div>

      {/* ── Stats strip ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '4px 12px',
        borderBottom: '1px solid rgba(120,168,220,0.05)', flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-text-faint)' }}>
          {activeTasks.length} active · {done} done
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {CATEGORIES.map(c => {
            const count = tasks.filter(t => t.category === c.value && t.status !== 'done').length;
            if (!count) return null;
            return (
              <span key={c.value} style={{ fontFamily: 'var(--j-font-mono)', fontSize: 9, color: c.color }}>
                {count} {c.short}
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Create task form ── */}
      {creating && (
        <div style={{ padding: '8px 12px', flexShrink: 0 }}>
          <CreateTaskForm onSave={handleCreate} onCancel={() => setCreating(false)} availableTasks={allTasksUnfiltered} />
        </div>
      )}

      {/* ── Task list or daily view ── */}
      <div className="scrollbar-jarvis" style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, color: 'var(--j-text-faint)' }}>
            <Loader2 size={14} style={{ animation: 'jarvis-spin 1s linear infinite' }} />
            <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12 }}>Loading tasks…</span>
          </div>
        ) : view === 'daily' ? (
          <div style={{ padding: 8 }}>
            <TaskDailyView tasks={tasks} allTasks={tasks} unfilteredTasks={allTasksUnfiltered} groupBy={groupBy} onToggle={handleToggle} onDelete={handleDelete} onBreakdown={handleBreakdown} onSetParent={handleSetParent} />
          </div>
        ) : (
          <TaskListView tasks={tasks} allTasks={tasks} unfilteredTasks={allTasksUnfiltered} groupBy={groupBy} onToggle={handleToggle} onDelete={handleDelete} onBreakdown={handleBreakdown} onAcceptSuggestion={handleAcceptSuggestion} onDismissSuggestion={handleDismissSuggestion} suggestionBusyId={suggestionBusyId} onSetParent={handleSetParent} />
        )}
      </div>

      {suggestionError && (
        <div style={{ padding: '6px 12px', fontSize: 11, color: '#E77A7A', flexShrink: 0 }}>{suggestionError}</div>
      )}

      {/* ── Orchestrator breakdown panel ── */}
      {breakdownTask && (
        <BreakdownPanel
          task={breakdownTask}
          onClose={() => setBreakdownTask(null)}
          onDone={handleBreakdownDone}
        />
      )}

      {/* ── §15.2: hard gate for a suggested Skill Set that requests new scope
          (not exercised by today's two starter Skill Sets, both instructions-only,
          but a real path per §15.3 for any future catalog item that does) ── */}
      {suggestionGate && (
        <ConfirmGate
          title={`Install "${suggestionGate.skillSetName}"`}
          category="skill_set_install"
          target={suggestionGate.skillSetName}
          scope="requested tools/integrations - see payload"
          severity="medium"
          confirmLabel="Confirm & Install"
          payload={<div>Requested by a §15.2 contextual suggestion. Review in Skill Sets before confirming if unsure.</div>}
          onConfirm={handleConfirmSuggestionInstall}
          onCancel={() => setSuggestionGate(null)}
        />
      )}
    </div>
  );
}

// ── Command bar ───────────────────────────────────────────────

function CommandBar({ onSubmit, loading }: { onSubmit: (text: string) => void; loading: boolean }) {
  const [input,     setInput]     = useState('');
  const [listening, setListening] = useState(false);
  const inputRef                  = useRef<HTMLInputElement>(null);
  const pendingVoiceQuery    = useJarvisStore(s => s.pendingVoiceQuery);
  const setPendingVoiceQuery = useJarvisStore(s => s.setPendingVoiceQuery);

  useEffect(() => {
    if (pendingVoiceQuery) { setInput(pendingVoiceQuery); setPendingVoiceQuery(null); inputRef.current?.focus(); }
  }, [pendingVoiceQuery, setPendingVoiceQuery]);

  const submit = () => { if (!input.trim() || loading) return; onSubmit(input.trim()); setInput(''); };

  const startVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) { alert('Speech recognition is only available in Chrome/Edge.'); return; }
    const rec = new SpeechRec();
    rec.lang = 'en-US'; rec.continuous = false;
    rec.onresult = (e: { results: { [x: string]: { [x: string]: { transcript: string } } } }) => { setInput(e.results[0][0].transcript); inputRef.current?.focus(); };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start(); setListening(true);
  };

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <input ref={inputRef} className="j-input" style={{ height: 48, fontSize: 14, paddingLeft: 16, paddingRight: 16, borderRadius: 12, letterSpacing: '0.02em' }}
          placeholder="Issue any command — ask, create, research, schedule, delegate…"
          value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submit()} disabled={loading} />
      </div>
      <button onClick={startVoice} className="j-btn-ghost" title={listening ? 'Listening…' : 'Voice input'}
        style={{ height: 48, width: 48, padding: 0, flexShrink: 0, borderRadius: 12, borderColor: listening ? 'rgba(226,90,110,0.5)' : undefined, color: listening ? 'var(--j-coral)' : undefined, animation: listening ? 'jarvis-pulse 0.8s ease-in-out infinite' : 'none' }}>
        {listening ? <MicOff size={16} /> : <Mic size={16} />}
      </button>
      <button className="j-btn-primary" style={{ height: 48, padding: '0 28px', borderRadius: 12, fontSize: 13, letterSpacing: '0.12em' }} onClick={submit} disabled={!input.trim() || loading}>
        {loading ? <Loader2 size={14} style={{ animation: 'jarvis-spin 0.7s linear infinite' }} /> : <Send size={14} />}
        EXECUTE
      </button>
    </div>
  );
}

// ── Auto-triggers ─────────────────────────────────────────────

const STATIC_EVENTS = [
  { id: 'email',    label: 'New email arrives',       icon: <Mail size={11} /> },
  { id: 'calendar', label: 'Calendar event starting', icon: <Calendar size={11} /> },
];

function ToggleSwitch({ active, onChange, color = 'var(--j-violet)' }: { active: boolean; onChange: () => void; color?: string }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: 28, height: 16, borderRadius: 8, border: 'none', cursor: 'pointer',
        flexShrink: 0, transition: 'background 0.2s',
        background: active ? color : 'rgba(120,168,220,0.15)', position: 'relative',
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: active ? 14 : 2,
        width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
      }} />
    </button>
  );
}

function pad2(n: number) { return String(n).padStart(2, '0'); }

function formatNextRun(iso: string | null, now = Date.now()): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = d.getTime() - now;
  if (diff < 0) return 'now';
  const hh = Math.floor(diff / 3_600_000);
  const mm = Math.floor((diff % 3_600_000) / 60_000);
  if (hh > 0) return `in ${hh}h ${mm}m`;
  return `in ${mm}m`;
}

export function AutoTriggers() {
  const [status,   setStatus]   = useState<SchedulerStatus | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const fetch = () => { getSchedulerStatus().then(setStatus); };
    fetch();
    const interval = setInterval(fetch, 5 * 60 * 1000);
    window.addEventListener('focus', fetch);
    return () => { clearInterval(interval); window.removeEventListener('focus', fetch); };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const activeCount = status?.enabled ? 1 : 0;

  return (
    <div style={{
      background: 'rgba(8,14,32,0.65)', backdropFilter: 'blur(16px)',
      border: '1px solid rgba(120,96,194,0.15)', borderRadius: 12,
      overflow: 'hidden', flexShrink: 0,
    }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', userSelect: 'none' }}
      >
        <Zap size={11} style={{ color: 'var(--j-violet)' }} />
        <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 10, color: 'var(--j-text-muted)', letterSpacing: '0.15em', flex: 1 }}>
          AUTO TRIGGERS
        </span>
        <span className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)' }}>{activeCount} active</span>
        {expanded
          ? <ChevronDown size={10} style={{ color: 'var(--j-text-faint)' }} />
          : <ChevronRight size={10} style={{ color: 'var(--j-text-faint)' }} />}
      </div>

      {expanded && (
        <div style={{ padding: '0 12px 12px' }}>
          <div className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)', letterSpacing: '0.12em', marginBottom: 8 }}>SCHEDULED</div>

          {/* Morning digest — read-only status display */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
            {/* Status indicator (non-interactive) */}
            <div style={{
              width: 28, height: 16, borderRadius: 8, flexShrink: 0,
              background: status?.enabled ? 'var(--j-violet)' : 'rgba(120,168,220,0.15)',
              position: 'relative', opacity: 0.6,
            }}>
              <div style={{
                position: 'absolute', top: 2, left: status?.enabled ? 14 : 2,
                width: 12, height: 12, borderRadius: '50%', background: '#fff',
              }} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: 'var(--j-font-ui)', fontSize: 11,
                color: status?.enabled ? 'var(--j-text)' : 'var(--j-text-muted)',
                marginBottom: 2,
              }}>
                Morning digest
              </div>

              {status ? (
                <>
                  <div className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)' }}>
                    <Clock size={7} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                    {pad2(status.digestHour)}:{pad2(status.digestMinute)} daily
                  </div>
                  {status.enabled && status.nextRunAt && (
                    <div className="j-mono" style={{ fontSize: 8, color: 'var(--j-violet)', marginTop: 2 }}>
                      ⏰ {formatNextRun(status.nextRunAt, now)}
                    </div>
                  )}
                  {status.lastRunAt && (
                    <div className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)', marginTop: 1 }}>
                      last: {relativeTime(status.lastRunAt)}
                    </div>
                  )}
                </>
              ) : (
                <div className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)' }}>Loading…</div>
              )}

              <div className="j-mono" style={{ fontSize: 8, color: 'rgba(201,168,76,0.65)', marginTop: 4, lineHeight: 1.5 }}>
                ⚙ Configure via DIGEST_HOUR / DIGEST_MINUTE Replit Secrets
              </div>
            </div>
          </div>

          {/* Event-triggered — UI-only placeholders */}
          <div className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)', letterSpacing: '0.12em', marginBottom: 6, marginTop: 4 }}>EVENT-TRIGGERED</div>
          {STATIC_EVENTS.map(e => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, opacity: 0.45 }}>
              <div style={{ width: 28, height: 16, borderRadius: 8, background: 'rgba(120,168,220,0.15)', position: 'relative', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 2, left: 2, width: 12, height: 12, borderRadius: '50%', background: '#fff' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: 'var(--j-amber)', display: 'flex' }}>{e.icon}</span>
                <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'var(--j-text-muted)' }}>{e.label}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── History row ───────────────────────────────────────────────

function HistoryRow({ run, onRerun }: { run: TaskRun; onRerun: (text: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid rgba(120,168,220,0.06)', animation: 'jarvis-fadein 0.2s ease both' }}>
      <div onClick={() => setExpanded(e => !e)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', cursor: 'pointer', userSelect: 'none' }}>
        {expanded ? <ChevronDown size={9} style={{ color: 'var(--j-text-faint)', flexShrink: 0 }} /> : <ChevronRight size={9} style={{ color: 'var(--j-text-faint)', flexShrink: 0 }} />}
        <span className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)', flexShrink: 0 }}>{relativeTime(run.createdAt)}</span>
        <TriggerBadge type={run.triggerType} />
        <AgentTypeBadge type={run.agentType} />
        <StatusBadge status={run.status} />
        <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'var(--j-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.commandText}</span>
        <span className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)', flexShrink: 0 }}>{run.steps.length} steps</span>
        <button onClick={e => { e.stopPropagation(); onRerun(run.commandText); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--j-text-faint)', padding: '0 2px', display: 'flex' }} title="Run again">
          <Play size={9} />
        </button>
      </div>
      {expanded && (
        <div style={{ paddingLeft: 16, paddingBottom: 8 }}>
          {run.resultSummary && <div style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'var(--j-text-muted)', marginBottom: 4, lineHeight: 1.5 }}>{run.resultSummary}</div>}
          {run.steps.map(s => <StepRow key={s.index} step={s} />)}
          {run.previewContent && <div style={{ marginTop: 6, fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-text-muted)', background: 'rgba(0,196,184,0.03)', border: '1px solid rgba(0,196,184,0.08)', borderRadius: 6, padding: '6px 8px', maxHeight: 100, overflowY: 'auto' }} className="scrollbar-jarvis">{run.previewContent.slice(0, 800)}</div>}
        </div>
      )}
    </div>
  );
}

// ── Commands panel ────────────────────────────────────────────

const STATUS_FILTERS: { value: TaskRunStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'ALL' }, { value: 'running', label: 'RUNNING' },
  { value: 'completed', label: 'DONE' }, { value: 'failed', label: 'FAILED' },
];
const TRIGGER_FILTERS: { value: TriggerType | 'all'; label: string }[] = [
  { value: 'all', label: 'ANY SOURCE' }, { value: 'manual', label: 'MANUAL' },
  { value: 'scheduled', label: 'SCHEDULED' }, { value: 'event', label: 'EVENT' },
];

function CommandsPanel() {
  const [activeRuns,  setActiveRuns]  = useState<TaskRun[]>([]);
  const [historyRuns, setHistoryRuns] = useState<TaskRun[]>([]);
  const [submitting,  setSubmitting]  = useState(false);
  const [commandError, setCommandError] = useState<string>();
  const [searchQ,     setSearchQ]     = useState('');
  const [statusFilter,   setStatusFilter]   = useState<TaskRunStatus | 'all'>('all');
  const [triggerFilter,  setTriggerFilter]  = useState<TriggerType | 'all'>('all');
  const addActiveTask = useJarvisStore(s => s.addActiveTask);

  const loadHistory = useCallback(async () => {
    const params: Parameters<typeof getTaskRuns>[0] = { limit: 80 };
    if (statusFilter !== 'all')  params.status      = statusFilter;
    if (triggerFilter !== 'all') params.triggerType  = triggerFilter;
    if (searchQ.length > 1)      params.q            = searchQ;
    const runs = await getTaskRuns(params);
    // awaiting_confirmation counts as "active" here too, not history - it's
    // not running anymore, but it needs the user's attention (design-spec.md
    // §6's highest-prominence case), which is exactly what this section
    // (full TaskRunCard treatment) is for. Left in history it'd be buried,
    // collapsed, indistinguishable at a glance from an old completed run.
    const isActiveOrNeedsInput = (r: TaskRun) => r.status === 'running' || r.status === 'queued' || r.status === 'awaiting_confirmation';
    setActiveRuns(runs.filter(isActiveOrNeedsInput));
    setHistoryRuns(runs.filter(r => !isActiveOrNeedsInput(r)));
  }, [searchQ, statusFilter, triggerFilter]);

  useEffect(() => { loadHistory(); const id = setInterval(loadHistory, 8000); return () => clearInterval(id); }, [loadHistory]);

  const handleCommand = async (text: string) => {
    setSubmitting(true);
    setCommandError(undefined);
    try {
      const { taskRunId } = await submitCommand(text, { triggerType: 'manual' });
      if (taskRunId) {
        addActiveTask(taskRunId);
        const optimistic: TaskRun = {
          id: taskRunId, commandText: text, triggerType: 'manual', agentId: 'claude',
          // Real classification (§11.1) hasn't happened yet at this
          // queued, optimistic-placeholder stage - 'orchestrator'
          // matches the DB column's own default until the real value
          // streams in from the backend.
          agentType: 'orchestrator',
          status: 'queued', steps: [], retryCount: 0,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        setActiveRuns(prev => [optimistic, ...prev]);
      }
    } catch (error) {
      // submitCommand throws on failure (see lib/taskRunApi.ts) rather than
      // silently returning an empty taskRunId - show the real error instead
      // of leaving the command bar looking like nothing happened.
      setCommandError(error instanceof Error ? error.message : 'Failed to submit command');
    } finally { setSubmitting(false); }
  };

  const filteredHistory = historyRuns.filter(r => {
    if (statusFilter !== 'all'  && r.status      !== statusFilter)  return false;
    if (triggerFilter !== 'all' && r.triggerType !== triggerFilter) return false;
    if (searchQ.length > 1 && !r.commandText.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
      {/* Command bar */}
      <CommandBar onSubmit={handleCommand} loading={submitting} />
      {commandError && (
        <div style={{ fontSize: '11px', color: '#E77A7A' }}>{commandError}</div>
      )}

      {/* Active runs */}
      {activeRuns.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {activeRuns.map(run => (
            <TaskRunCard key={run.id} run={run} onRemove={id => setActiveRuns(prev => prev.filter(r => r.id !== id))} />
          ))}
        </div>
      )}

      {/* Auto-triggers */}
      <AutoTriggers />

      {/* History panel */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <JPanel title="Command history" badge="LOG" action={
          <button onClick={loadHistory} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--j-text-faint)', display: 'flex' }}>
            <RefreshCw size={11} />
          </button>
        }>
          {/* Filter bar inside history */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 100 }}>
              <Search size={9} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--j-text-faint)' }} />
              <input className="j-input" style={{ height: 26, paddingLeft: 24, fontSize: 10 }} placeholder="Search…" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {STATUS_FILTERS.map(f => (
                <button key={f.value} onClick={() => setStatusFilter(f.value)} className="j-mono"
                  style={{ fontSize: 8, padding: '2px 7px', borderRadius: 8, border: '1px solid', cursor: 'pointer',
                    background: statusFilter === f.value ? 'rgba(0,196,184,0.12)' : 'transparent',
                    borderColor: statusFilter === f.value ? 'rgba(0,196,184,0.35)' : 'rgba(120,168,220,0.15)',
                    color: statusFilter === f.value ? 'var(--j-teal)' : 'var(--j-text-faint)' }}>
                  {f.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {TRIGGER_FILTERS.map(f => (
                <button key={f.value} onClick={() => setTriggerFilter(f.value)} className="j-mono"
                  style={{ fontSize: 8, padding: '2px 7px', borderRadius: 8, border: '1px solid', cursor: 'pointer',
                    background: triggerFilter === f.value ? 'rgba(120,96,194,0.12)' : 'transparent',
                    borderColor: triggerFilter === f.value ? 'rgba(120,96,194,0.35)' : 'rgba(120,168,220,0.15)',
                    color: triggerFilter === f.value ? 'var(--j-violet)' : 'var(--j-text-faint)' }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, color: 'var(--j-text-faint)' }}>
              <Terminal size={16} style={{ opacity: 0.4 }} />
              <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12 }}>No command history yet</span>
            </div>
          ) : (
            filteredHistory.map(run => (
              <HistoryRow key={run.id} run={run} onRerun={handleCommand} />
            ))
          )}
        </JPanel>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Tasks page
// ═══════════════════════════════════════════════════════════════

export default function Tasks() {
  const [mainTab, setMainTab] = useState<'tasks' | 'commands'>('tasks');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Tab bar ── */}
      <div style={{
        display: 'flex', alignItems: 'stretch', gap: 0, flexShrink: 0,
        borderBottom: '1px solid rgba(120,168,220,0.10)',
        background: 'rgba(6,9,20,0.6)',
        padding: '0 12px',
      }}>
        {[
          { id: 'tasks',    icon: <CheckSquare size={12} />, label: 'My Tasks' },
          { id: 'commands', icon: <Terminal size={12} />,    label: 'Commands' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setMainTab(t.id as 'tasks' | 'commands')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              height: 38, padding: '0 16px', border: 'none', cursor: 'pointer',
              background: 'transparent',
              borderBottom: mainTab === t.id ? '2px solid var(--j-teal)' : '2px solid transparent',
              color: mainTab === t.id ? '#fff' : 'var(--j-text-muted)',
              fontFamily: 'var(--j-font-ui)', fontSize: 12, fontWeight: mainTab === t.id ? 600 : 400,
              transition: 'color 0.15s',
            }}
          >
            <span style={{ color: mainTab === t.id ? 'var(--j-teal)' : 'inherit', display: 'flex' }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {mainTab === 'tasks' ? (
          <JPanel title="My Tasks" badge="LIVE" noPadding>
            <MyTasksPanel />
          </JPanel>
        ) : (
          <div style={{ padding: 10, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <CommandsPanel />
          </div>
        )}
      </div>
    </div>
  );
}
