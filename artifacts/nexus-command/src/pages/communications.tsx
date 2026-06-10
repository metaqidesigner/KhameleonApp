import { motion } from 'framer-motion';
import { useListCommunications, getListCommunicationsQueryKey, useGetCommunicationAnalytics, getGetCommunicationAnalyticsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Sparkles, Mail, MessageCircle, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';

export default function Communications() {
  const { data: comms, isLoading } = useListCommunications({ query: { queryKey: getListCommunicationsQueryKey() } });
  const { data: analytics, isLoading: analyticsLoading } = useGetCommunicationAnalytics({ query: { queryKey: getGetCommunicationAnalyticsQueryKey() } });

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="flex items-center gap-3">
        <MessageSquare className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Communications Hub</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <div className="lg:col-span-8 flex flex-col gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="glass-panel border-white/5 h-40 animate-pulse bg-secondary/30" />
            ))
          ) : (
            comms?.map((comm, i) => (
              <motion.div 
                key={comm.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className={cn(
                  "glass-panel transition-all relative overflow-hidden group",
                  comm.isRead ? "border-white/5 opacity-80" : "border-primary/30 shadow-[0_0_15px_rgba(0,212,255,0.1)]"
                )}>
                  <CardContent className="p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center border border-border">
                          {comm.source === 'Email' ? <Mail className="w-5 h-5 text-muted-foreground" /> : <MessageCircle className="w-5 h-5 text-muted-foreground" />}
                        </div>
                        <div>
                          <div className="font-bold text-foreground">{comm.sender}</div>
                          <div className="text-xs text-muted-foreground">{comm.senderEmail || comm.source}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-mono border",
                          comm.sentiment === 'Negative' || comm.sentiment === 'Urgent' ? "bg-destructive/10 text-destructive border-destructive/20" :
                          comm.sentiment === 'Positive' ? "bg-green-500/10 text-green-400 border-green-500/20" :
                          "bg-secondary text-muted-foreground border-border"
                        )}>
                          {comm.sentiment}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs font-mono border bg-primary/10 text-primary border-primary/20">
                          {comm.priority} Priority
                        </span>
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-medium text-foreground mt-1">{comm.subject}</h3>
                    
                    <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 relative">
                      <Sparkles className="w-4 h-4 text-accent absolute top-3 left-3" />
                      <div className="pl-6 text-sm text-foreground/80 leading-relaxed">
                        <span className="font-semibold text-primary mr-1">AI Analysis:</span>
                        {comm.summary}
                      </div>
                    </div>

                    {comm.suggestedResponse && (
                      <div className="mt-2 text-sm text-muted-foreground bg-secondary/30 p-3 rounded border border-border">
                        <span className="font-mono text-xs text-foreground block mb-1">SUGGESTED RESPONSE:</span>
                        {comm.suggestedResponse}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6">
          <Card className="glass-panel border-white/5">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Communication Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              {analyticsLoading ? <div className="h-48 animate-pulse bg-secondary rounded" /> : (
                <div className="flex flex-col gap-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-secondary/50 p-4 rounded-lg border border-border text-center">
                      <div className="text-2xl font-mono text-primary font-bold">{analytics?.totalMessages}</div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Total</div>
                    </div>
                    <div className="bg-secondary/50 p-4 rounded-lg border border-border text-center">
                      <div className="text-2xl font-mono text-accent font-bold">{analytics?.avgResponseTime}h</div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Avg Response</div>
                    </div>
                  </div>

                  <div className="h-[200px]">
                    <h4 className="text-xs font-medium text-muted-foreground text-center mb-2">By Source</h4>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics?.bySource}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {analytics?.bySource.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color || 'hsl(var(--primary))'} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'rgba(10, 22, 40, 0.9)', borderColor: 'rgba(0, 212, 255, 0.2)' }}
                          itemStyle={{ color: '#fff' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
