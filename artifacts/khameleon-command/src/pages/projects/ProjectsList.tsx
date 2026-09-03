import { useState } from 'react';
import { Link } from 'wouter';
import { useListProjects, useCreateProject, getListProjectsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

// GitHub Issues/Notion/TickTick have real connector entries elsewhere in the
// app (routes/connectors.ts); Linear/Jira don't exist as connectors at all.
// None of the five have an OAuth flow wired up yet (only google/microsoft/
// spotify do, in auth.ts) - shown here as honestly disabled rather than as
// clickable buttons that do nothing, matching the pattern used on the
// Security page's guardrails list.
const PLANNED_CONNECTORS = ['GitHub Issues', 'Linear', 'Notion', 'Jira', 'TickTick'];

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-primary/10 border-primary/20 text-primary',
  on_hold: 'bg-accent/10 border-accent/20 text-accent',
  completed: 'bg-green-500/10 border-green-500/20 text-green-500',
  archived: 'bg-secondary border-white/10 text-muted-foreground',
};

const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-destructive/10 border-destructive/20 text-destructive',
  medium: 'bg-accent/10 border-accent/20 text-accent',
  low: 'bg-secondary border-white/10 text-muted-foreground',
};

function NewProjectDialog() {
  const qc = useQueryClient();
  const { mutateAsync: createProject, isPending } = useCreateProject();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');
  const [priority, setPriority] = useState('medium');
  const [error, setError] = useState<string>();

  const reset = () => { setName(''); setDescription(''); setOwner(''); setPriority('medium'); setError(undefined); };

  const submit = async () => {
    if (!name.trim() || !owner.trim()) {
      setError('Name and owner are required.');
      return;
    }
    try {
      await createProject({ data: { name: name.trim(), description: description.trim(), owner: owner.trim(), status: 'active', priority } });
      await qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="j-btn j-btn-primary">+ New Project</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Input placeholder="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={isPending}>{isPending ? 'Creating…' : 'Create Project'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProjectsList() {
  const { data: projects, isLoading } = useListProjects();

  return (
    <div className="j-page">
      <div className="j-page-header">
        <div>
          <h1 className="j-brand">Projects</h1>
          <p>Task boards and project tracking powered by Jarvis</p>
        </div>
        <NewProjectDialog />
      </div>
      <div className="j-page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="j-card">
          <div className="j-card-header">What Jarvis does here</div>
          <p style={{ fontSize: 13, color: '#8b949e', margin: 0, lineHeight: 1.6 }}>
            Jarvis connects to your project management tools to surface blockers,
            summarise progress, generate status updates, and proactively flag deadlines.
            Connect a source to populate your boards.
          </p>
        </div>
        <div className="j-card">
          <div className="j-card-header">Required connectors</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PLANNED_CONNECTORS.map(c => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #30363d' }}>
                <span style={{ fontSize: 13 }}>{c}</span>
                <button className="j-btn" disabled style={{ height: 26, fontSize: 11, opacity: 0.4, cursor: 'not-allowed' }} title="Not yet available">
                  Coming soon
                </button>
              </div>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="j-grid-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="j-skeleton" style={{ height: 100 }} />
            ))}
          </div>
        ) : !projects || projects.length === 0 ? (
          <div className="text-muted-foreground italic text-center p-6 border border-dashed border-white/10 rounded-lg">
            No projects yet — create one above to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <Card className="glass-panel border-white/5 cursor-pointer hover:border-primary/30 transition-colors h-full">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between gap-2">
                      <span className="truncate">{p.name}</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase shrink-0 ${STATUS_STYLES[p.status] ?? STATUS_STYLES.active}`}>
                        {p.status}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">{p.description || 'No description.'}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{p.owner}</span>
                      <span className={`font-mono px-2 py-0.5 rounded border uppercase ${PRIORITY_STYLES[p.priority] ?? PRIORITY_STYLES.medium}`}>
                        {p.priority}
                      </span>
                    </div>
                    <Progress value={p.progress} />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{p.completedTaskCount ?? 0} / {p.taskCount ?? 0} tasks</span>
                      {p.dueDate && <span>Due {new Date(p.dueDate).toLocaleDateString()}</span>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
