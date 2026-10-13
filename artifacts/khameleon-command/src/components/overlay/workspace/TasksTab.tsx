import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { getTasks, createTask, updateTask, deleteTask, type Task, type TaskPriority } from "@/lib/jarvisApi";
import { groupTasksByProject } from "@/lib/taskProjects";
import { TEXT, MUTED, inputStyle, Btn } from "./ui";

/**
 * Workspace -> Tasks (gap review Q4 + Q15): the full task list, grouped by
 * project with progress. Same data and endpoints as Classic's Tasks page;
 * Classic groups the same way via "Group: Project".
 */

const BASE = import.meta.env.VITE_API_URL || "/api";

interface Project { id: number; name: string }

async function listProjects(): Promise<Project[]> {
  try {
    const r = await fetch(`${BASE}/projects`);
    return r.ok ? (await r.json() as Project[]) : [];
  } catch {
    return [];
  }
}

async function createProject(name: string): Promise<Project> {
  const r = await fetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description: "", owner: "", status: "active", priority: "medium" }),
  });
  if (!r.ok) throw new Error(`Couldn't create the project (HTTP ${r.status})`);
  return r.json();
}

const PRIORITY_COLOR: Record<TaskPriority, string> = { urgent: "#ff7a7a", high: "#ffb36b", medium: "#8fb4b6", low: "#5a7a78" };
const STATUS_NOTE: Partial<Record<Task["status"], string>> = { blocked: "Blocked", needs_input: "Needs your input", in_progress: "In progress" };

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${done} of ${total} done`}
      style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: "#6FE6BD", transition: "width 200ms ease" }} />
    </div>
  );
}

function TaskRow({ task, projects, onChange, onDelete }: {
  task: Task;
  projects: Project[];
  onChange: (patch: Parameters<typeof updateTask>[1]) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const done = task.status === "done";
  return (
    <div style={{ borderRadius: 8, background: "rgba(255,255,255,0.03)", marginLeft: task.parentTaskId ? 18 : 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px" }}>
        <input type="checkbox" checked={done} aria-label={done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
          onChange={() => onChange({ status: done ? "todo" : "done" })} style={{ accentColor: "#6FE6BD", flexShrink: 0 }} />
        <span title={`${task.priority} priority`} style={{ width: 6, height: 6, borderRadius: "50%", background: PRIORITY_COLOR[task.priority], flexShrink: 0 }} />
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
          style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit",
            fontSize: 12.5, color: done ? MUTED : TEXT, textDecoration: done ? "line-through" : "none",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {task.title}
        </button>
        {STATUS_NOTE[task.status] && <span style={{ fontSize: 10, color: task.status === "in_progress" ? MUTED : "#ffb36b", flexShrink: 0 }}>{STATUS_NOTE[task.status]}</span>}
        {task.dueDate && <span style={{ fontSize: 10, color: MUTED, flexShrink: 0 }}>{new Date(task.dueDate).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>}
      </div>
      {open && (
        <div style={{ padding: "0 8px 8px 30px", display: "flex", flexDirection: "column", gap: 6 }}>
          {task.description && <div style={{ fontSize: 11.5, color: MUTED, whiteSpace: "pre-wrap" }}>{task.description}</div>}
          {task.waitingOn && <div style={{ fontSize: 11, color: "#ffb36b" }}>Waiting on {task.waitingOn}</div>}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <label style={{ fontSize: 11, color: MUTED }} htmlFor={`proj-${task.id}`}>Project</label>
            <select id={`proj-${task.id}`} value={task.projectId ?? ""} onChange={e => onChange({ projectId: e.target.value ? Number(e.target.value) : null })}
              style={{ ...inputStyle, width: "auto", flex: 1, padding: "4px 6px", fontSize: 11.5 }}>
              <option value="">No project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <Btn danger onClick={onDelete} label={`Delete "${task.title}"`}><Trash2 size={12} /></Btn>
          </div>
        </div>
      )}
    </div>
  );
}

export function TasksTab() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [newTitle, setNewTitle] = useState("");
  const [newProject, setNewProject] = useState<string>("");
  const [newProjectName, setNewProjectName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    getTasks().then(setTasks);
    listProjects().then(setProjects);
  }, []);
  useEffect(reload, [reload]);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); reload(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
  };

  const projectNames = useMemo(() => new Map(projects.map(p => [p.id, p.name])), [projects]);
  const groups = useMemo(() => groupTasksByProject(tasks ?? [], projectNames), [tasks, projectNames]);

  const add = () => act(async () => {
    if (!newTitle.trim()) return;
    await createTask({ title: newTitle.trim(), projectId: newProject ? Number(newProject) : null });
    setNewTitle("");
  });

  const addProject = () => act(async () => {
    if (!newProjectName?.trim()) return;
    const p = await createProject(newProjectName.trim());
    setNewProject(String(p.id));
    setNewProjectName(null);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <form onSubmit={e => { e.preventDefault(); void add(); }} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <input aria-label="New task" placeholder="Add a task" value={newTitle} onChange={e => setNewTitle(e.target.value)} style={inputStyle} />
          <Btn primary onClick={() => void add()} disabled={!newTitle.trim()} label="Add task"><Plus size={12} /></Btn>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <select aria-label="Project for the new task" value={newProject} onChange={e => setNewProject(e.target.value)} style={{ ...inputStyle, flex: 1, padding: "4px 6px", fontSize: 11.5 }}>
            <option value="">No project</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {newProjectName === null
            ? <Btn onClick={() => setNewProjectName("")}>New project</Btn>
            : (
              <>
                <input autoFocus aria-label="New project name" placeholder="Project name" value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void addProject(); } }}
                  style={{ ...inputStyle, flex: 1, padding: "4px 6px", fontSize: 11.5 }} />
                <Btn primary onClick={() => void addProject()} disabled={!newProjectName.trim()}>Create</Btn>
              </>
            )}
        </div>
      </form>

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: MUTED, cursor: "pointer" }}>
        <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} style={{ accentColor: "#6FE6BD" }} />
        Show finished tasks
      </label>

      {error && <div role="alert" style={{ fontSize: 12, color: "#ffb0b0" }}>{error}</div>}
      {tasks === null && <div style={{ fontSize: 12, color: MUTED }}>Loading tasks…</div>}
      {tasks && tasks.length === 0 && <div style={{ fontSize: 12, color: MUTED }}>No tasks yet - add one above.</div>}

      {groups.map(g => {
        const visible = showDone ? g.tasks : g.tasks.filter(t => t.status !== "done");
        const isCollapsed = collapsed[g.key];
        return (
          <div key={g.key} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <button type="button" onClick={() => setCollapsed(c => ({ ...c, [g.key]: !c[g.key] }))} aria-expanded={!isCollapsed}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
              <span style={{ color: MUTED }}>{isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}</span>
              <span style={{ flex: 1, textAlign: "left", fontSize: 12.5, fontWeight: 600, color: TEXT }}>{g.name}</span>
              <span style={{ fontSize: 11, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{g.done} of {g.total} done</span>
            </button>
            {g.projectId !== null && <ProgressBar done={g.done} total={g.total} />}
            {!isCollapsed && visible.map(t => (
              <TaskRow key={t.id} task={t} projects={projects}
                onChange={patch => void act(() => updateTask(t.id, patch))}
                onDelete={() => void act(() => deleteTask(t.id))} />
            ))}
            {!isCollapsed && visible.length === 0 && <div style={{ fontSize: 11, color: MUTED, paddingLeft: 18 }}>All done here.</div>}
          </div>
        );
      })}
    </div>
  );
}
