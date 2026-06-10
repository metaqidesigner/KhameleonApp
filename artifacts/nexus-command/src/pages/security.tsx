import { motion } from 'framer-motion';
import { useGetSecurityStatus, getGetSecurityStatusQueryKey, useListSecurityEvents, getListSecurityEventsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, ShieldCheck, AlertTriangle, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Security() {
  const { data: status, isLoading: statusLoading } = useGetSecurityStatus({ query: { queryKey: getGetSecurityStatusQueryKey() } });
  const { data: events, isLoading: eventsLoading } = useListSecurityEvents({ query: { queryKey: getListSecurityEventsQueryKey() } });

  const scoreColor = status?.overallScore && status.overallScore > 90 ? 'text-green-400' : 'text-accent';

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="flex items-center gap-3">
        <ShieldAlert className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Security Command</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-panel border-primary/20 md:col-span-1 neon-glow flex flex-col items-center justify-center p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 blur-2xl" />
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest relative z-10">System Integrity</h2>
          <div className={cn("text-7xl font-bold font-mono mt-4 relative z-10 drop-shadow-[0_0_15px_rgba(0,212,255,0.5)]", scoreColor)}>
            {statusLoading ? '--' : status?.overallScore}
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-foreground relative z-10">
            {status?.threatLevel === 'Low' ? <ShieldCheck className="w-4 h-4 text-green-400" /> : <AlertTriangle className="w-4 h-4 text-destructive" />}
            Threat Level: <span className="font-mono">{status?.threatLevel || 'Unknown'}</span>
          </div>
        </Card>

        <div className="md:col-span-2 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Defense Layers</h3>
          {statusLoading ? (
             Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse bg-secondary/50 rounded-lg border border-border" />
            ))
          ) : (
            status?.layers.map((layer, i) => (
              <motion.div 
                key={layer.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-lg p-3 flex items-center justify-between hover:border-primary/30 transition-colors"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{layer.name}</span>
                  <span className="text-xs text-muted-foreground">{layer.status}</span>
                </div>
                <div className="flex items-center gap-3 w-48">
                  <div className="h-2 flex-1 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full", layer.score > 90 ? "bg-green-500" : "bg-accent")} 
                      style={{ width: `${layer.score}%` }} 
                    />
                  </div>
                  <span className="text-sm font-mono w-8 text-right">{layer.score}%</span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      <Card className="glass-panel border-white/5 mt-4">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Activity className="w-5 h-5 text-primary" /> Security Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {eventsLoading ? (
              <div className="h-32 animate-pulse bg-secondary/30 rounded" />
            ) : events?.length === 0 ? (
              <div className="text-center text-muted-foreground p-4">No recent security events.</div>
            ) : (
              events?.map(event => (
                <div key={event.id} className="flex items-start gap-4 p-3 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors">
                  <div className={cn(
                    "p-2 rounded-full",
                    event.severity === 'High' || event.severity === 'Critical' ? "bg-destructive/20 text-destructive" : 
                    event.severity === 'Medium' ? "bg-accent/20 text-accent" : "bg-primary/20 text-primary"
                  )}>
                    {event.severity === 'Critical' || event.severity === 'High' ? <AlertTriangle className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{event.type}</span>
                      <span className="text-xs text-muted-foreground font-mono">{new Date(event.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
