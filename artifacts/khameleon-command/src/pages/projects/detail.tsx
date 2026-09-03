import { useRoute } from 'wouter';
import { useGetProject, getGetProjectQueryKey, useListProjectTasks, getListProjectTasksQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Target, AlertTriangle, CheckCircle2, Circle, Clock } from 'lucide-react';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function ProjectDetail() {
  const [, params] = useRoute('/projects/:id');
  const id = Number(params?.id);
  const { data: project, isLoading } = useGetProject(id, { query: { enabled: !!id, queryKey: getGetProjectQueryKey(id) } });
  const { data: tasks, isLoading: loadingTasks } = useListProjectTasks(id, { query: { enabled: !!id, queryKey: getListProjectTasksQueryKey(id) } });

  if (isLoading) return <div className="p-8 text-center text-primary animate-pulse">LOADING PROJECT DATA...</div>;
  if (!project) return <div className="p-8 text-center text-destructive">PROJECT NOT FOUND</div>;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-10">
      <Link href="/projects" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" /> Back to Projects
      </Link>
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="j-brand text-3xl font-bold tracking-tight text-foreground">{project.name}</h1>
          <p className="text-muted-foreground mt-2">{project.description}</p>
          <div className="flex gap-2 mt-3">
            {project.tags?.map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded border border-white/10 bg-secondary/50 text-xs font-mono text-muted-foreground uppercase">{tag}</span>
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-mono font-bold text-primary">{project.progress}%</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Completion</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-panel border-white/5 md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Target className="w-5 h-5 text-primary" /> Active Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {loadingTasks ? (
                <div className="h-32 bg-secondary/30 animate-pulse rounded-lg" />
              ) : tasks?.length === 0 ? (
                <div className="text-muted-foreground italic text-center p-6 border border-dashed border-white/10 rounded-lg">No active tasks found.</div>
              ) : (
                tasks?.map((task, i) => (
                  <motion.div 
                    key={task.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-3 p-3 rounded-lg border border-white/5 bg-secondary/20 hover:bg-secondary/40 transition-colors"
                  >
                    {task.status === 'Completed' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    ) : task.status === 'In Progress' ? (
                      <Clock className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={cn("font-medium", task.status === 'Completed' ? "line-through text-muted-foreground" : "text-foreground")}>{task.title}</span>
                        <span className={cn(
                          "text-[10px] font-mono px-2 py-0.5 rounded border uppercase",
                          task.priority === 'High' ? "bg-destructive/10 border-destructive/20 text-destructive" :
                          task.priority === 'Medium' ? "bg-accent/10 border-accent/20 text-accent" :
                          "bg-secondary border-white/10 text-muted-foreground"
                        )}>
                          {task.priority}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1 line-clamp-1">{task.description}</div>
                      
                      {task.aiRecommendation && (
                        <div className="mt-2 text-xs bg-primary/10 border border-primary/20 text-primary p-2 rounded">
                          <span className="font-bold">AI:</span> {task.aiRecommendation}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-destructive/20 bg-destructive/5 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-destructive"><AlertTriangle className="w-5 h-5" /> Risks</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-4 text-sm text-foreground flex flex-col gap-2">
              {project.risks?.map((risk, i) => <li key={i}>{risk}</li>)}
              {!project.risks?.length && <span className="text-muted-foreground italic">No identified risks.</span>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
