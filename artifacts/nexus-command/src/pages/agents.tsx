import { useState } from 'react';
import { motion } from 'framer-motion';
import { useListAgents, getListAgentsQueryKey, useRouteTask } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Bot, Network, Zap, CheckCircle2, ShieldAlert, Cpu } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export default function Agents() {
  const [taskInput, setTaskInput] = useState('');
  const [routingResult, setRoutingResult] = useState<any>(null);
  const { data: agents, isLoading } = useListAgents({ query: { queryKey: getListAgentsQueryKey() } });
  const routeTask = useRouteTask();

  const handleRouteTask = () => {
    if (!taskInput) return;
    routeTask.mutate(
      { data: { task: taskInput } },
      {
        onSuccess: (res) => {
          setRoutingResult(res);
        }
      }
    );
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="flex items-center gap-3">
        <Bot className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Agent Orchestration Engine</h1>
      </div>

      <Card className="glass-panel border-primary/20 neon-glow relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 blur-xl pointer-events-none" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-primary">
            <Network className="w-5 h-5" /> Task Router
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input 
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              placeholder="Describe a task to route to the optimal AI agent..."
              className="bg-secondary/50 border-primary/30 text-foreground h-12 text-lg focus-visible:ring-primary/50"
              onKeyDown={(e) => e.key === 'Enter' && handleRouteTask()}
            />
            <Button onClick={handleRouteTask} disabled={routeTask.isPending} className="h-12 px-8 bg-primary hover:bg-primary/80 text-primary-foreground font-semibold tracking-wider">
              {routeTask.isPending ? 'ROUTING...' : 'ROUTE TASK'}
            </Button>
          </div>

          {routingResult && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 rounded-xl border border-primary/30 bg-primary/10 flex flex-col gap-3"
            >
              <div className="flex items-center gap-2 text-primary font-semibold">
                <CheckCircle2 className="w-5 h-5" /> Routed successfully
              </div>
              <div className="text-foreground text-sm leading-relaxed">{routingResult.reasoning}</div>
              <div className="flex gap-6 mt-2">
                <div>
                  <span className="text-muted-foreground text-xs uppercase">Primary Agent</span>
                  <div className="font-mono text-white font-medium">{routingResult.primaryAgent?.name}</div>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs uppercase">Confidence</span>
                  <div className="font-mono text-green-400 font-medium">{routingResult.confidenceScore}%</div>
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="glass-panel border-white/5 h-48 animate-pulse bg-secondary/30" />
          ))
        ) : (
          agents?.map((agent, i) => (
            <motion.div 
              key={agent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="glass-panel border-white/10 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(0,212,255,0.15)] transition-all h-full group">
                <CardHeader className="pb-3 flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-xl text-foreground group-hover:text-primary transition-colors">{agent.name}</CardTitle>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{agent.category}</div>
                  </div>
                  <div className="px-2 py-1 rounded-full bg-secondary text-xs font-mono border border-border">
                    {agent.status}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground line-clamp-2">{agent.description}</p>
                  
                  <div className="grid grid-cols-2 gap-4 mt-auto">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Reliability</div>
                      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-green-500" style={{ width: `${agent.reliabilityScore}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Zap className="w-3 h-3" /> Cost Eff.</div>
                      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-accent" style={{ width: `${agent.costScore}%` }} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-2">
                    {agent.supportedModels?.map((model: string) => (
                      <span key={model} className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                        <Cpu className="w-3 h-3" /> {model}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
