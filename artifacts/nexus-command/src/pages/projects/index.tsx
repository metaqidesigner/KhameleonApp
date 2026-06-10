import { motion } from 'framer-motion';
import { useListProjects, getListProjectsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderKanban, AlertTriangle, CheckSquare } from 'lucide-react';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';

export default function Projects() {
  const { data: projects, isLoading } = useListProjects({ query: { queryKey: getListProjectsQueryKey() } });

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="flex items-center gap-3">
        <FolderKanban className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Project Command Centre</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="glass-panel border-white/5 h-64 animate-pulse bg-secondary/30" />
          ))
        ) : (
          projects?.map((project, i) => (
            <motion.div 
              key={project.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link href={`/projects/${project.id}`}>
                <Card className="glass-panel border-white/10 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(0,212,255,0.15)] transition-all h-full cursor-pointer group">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">{project.name}</CardTitle>
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded border uppercase font-mono tracking-wider",
                        project.status === 'Active' ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-secondary text-muted-foreground border-border"
                      )}>{project.status}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{project.description}</div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progress</span>
                        <span className="font-mono text-primary">{project.progress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${project.progress}%` }} />
                      </div>
                    </div>

                    <div className="flex gap-4 mt-auto">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CheckSquare className="w-4 h-4 text-primary" /> {project.taskCount || 0} Tasks
                      </div>
                      {project.risks && project.risks.length > 0 && (
                        <div className="flex items-center gap-1.5 text-sm text-destructive">
                          <AlertTriangle className="w-4 h-4" /> {project.risks.length} Risks
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
