import { motion } from 'framer-motion';
import { useListAutomations, getListAutomationsQueryKey, useRunAutomation } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Workflow, Play, Clock, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Automations() {
  const { data: automations, isLoading } = useListAutomations({ query: { queryKey: getListAutomationsQueryKey() } });
  const runAutomation = useRunAutomation();
  const { toast } = useToast();

  const handleRun = (id: number, name: string) => {
    runAutomation.mutate(
      { data: { id } },
      {
        onSuccess: (res) => {
          toast({
            title: "Automation Executed",
            description: `${name}: ${res.message}`,
            variant: res.success ? "default" : "destructive",
          });
        }
      }
    );
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="flex items-center gap-3">
        <Workflow className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Automation Engine</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="glass-panel border-white/5 h-56 animate-pulse bg-secondary/30" />
          ))
        ) : (
          automations?.map((auto, i) => (
            <motion.div 
              key={auto.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="glass-panel border-white/10 hover:border-primary/40 transition-colors h-full flex flex-col group">
                <CardHeader className="pb-3 flex flex-row items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-lg text-foreground group-hover:text-primary transition-colors">{auto.name}</CardTitle>
                    <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1 mt-1">
                      <Zap className="w-3 h-3 text-accent" /> {auto.trigger}
                    </span>
                  </div>
                  <Switch checked={auto.status === 'Active'} />
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">{auto.description}</p>
                  
                  <div className="flex flex-wrap gap-2 mt-auto">
                    {auto.applicationsUsed?.map(app => (
                      <span key={app} className="text-xs px-2 py-0.5 rounded bg-secondary text-foreground border border-border">
                        {app}
                      </span>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="pt-0 border-t border-white/5 mt-4 pb-4">
                  <div className="w-full flex items-center justify-between mt-4">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" /> Last run: {new Date(auto.lastExecution).toLocaleDateString()}
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => handleRun(auto.id, auto.name)}
                      disabled={runAutomation.isPending || auto.status !== 'Active'}
                      className="bg-primary/20 text-primary hover:bg-primary hover:text-primary-foreground font-semibold"
                    >
                      <Play className="w-4 h-4 mr-1" /> RUN NOW
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
