import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  useGetDashboardSummary, 
  getGetDashboardSummaryQueryKey,
  useGetDashboardAnalytics,
  getGetDashboardAnalyticsQueryKey,
  useListInsights,
  getListInsightsQueryKey
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BrainCircuit, Command, ShieldAlert, Zap, Layers, Server, Lightbulb, TrendingUp, AlertTriangle } from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() }});
  const { data: analytics, isLoading: loadingAnalytics } = useGetDashboardAnalytics({ query: { queryKey: getGetDashboardAnalyticsQueryKey() }});
  const { data: insights, isLoading: loadingInsights } = useListInsights({ query: { queryKey: getListInsightsQueryKey() }});

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-10 relative">
      
      {/* Executive Insights Floating Panel */}
      <div className="hidden 2xl:flex flex-col gap-3 absolute -right-80 top-0 w-72">
        <div className="flex items-center gap-2 text-accent font-semibold tracking-wider text-xs uppercase mb-2">
          <Lightbulb className="w-4 h-4" /> Executive Insights
        </div>
        {loadingInsights ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-secondary/50 animate-pulse rounded-lg border border-white/5" />
          ))
        ) : (
          insights?.map((insight, i) => (
            <motion.div 
              key={insight.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 + 0.5 }}
              className="bg-card/80 backdrop-blur-md border border-primary/20 rounded-lg p-4 shadow-[0_0_15px_rgba(0,212,255,0.05)]"
            >
              <div className="flex items-start justify-between mb-2">
                <span className={cn(
                  "text-[10px] font-mono px-2 py-0.5 rounded border uppercase",
                  insight.category === 'Risk' ? "bg-destructive/10 border-destructive/20 text-destructive" :
                  insight.category === 'Opportunity' ? "bg-green-500/10 border-green-500/20 text-green-400" :
                  "bg-primary/10 border-primary/20 text-primary"
                )}>
                  {insight.category}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                  {insight.confidenceScore}% CONF
                </span>
              </div>
              <p className="text-sm text-foreground/90 leading-snug">{insight.message}</p>
              {insight.actionRequired && (
                <div className="mt-3 text-xs font-semibold text-accent flex items-center gap-1 cursor-pointer hover:underline">
                  <TrendingUp className="w-3 h-3" /> ACTION REQUIRED
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Top command input */}
      <div className="w-full max-w-2xl mx-auto mb-4 relative group">
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        <div className="relative flex items-center bg-card/80 backdrop-blur-md border border-primary/30 rounded-xl overflow-hidden shadow-[0_0_15px_rgba(0,212,255,0.1)] focus-within:shadow-[0_0_25px_rgba(0,212,255,0.2)] focus-within:border-primary transition-all">
          <div className="pl-4 text-primary">
            <Command className="w-5 h-5" />
          </div>
          <Input 
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground placeholder:text-muted-foreground/70 h-14 text-lg"
            placeholder="Ask Nexus Command anything... e.g. 'Prepare me for tomorrow'"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Panel */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <Card className="glass-panel border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-accent" /> Today's Priorities
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSummary ? <div className="h-20 animate-pulse bg-secondary rounded" /> : (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-foreground">Pending Tasks</span>
                    <span className="font-mono text-lg font-bold text-primary">{summary?.pendingTasks || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-foreground">Pending Approvals</span>
                    <span className="font-mono text-lg font-bold text-accent">{summary?.pendingApprovals || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-foreground">Today's Meetings</span>
                    <span className="font-mono text-lg font-bold text-white">{summary?.todayMeetings || 0}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card className="glass-panel border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> Projects Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSummary ? <div className="h-10 animate-pulse bg-secondary rounded" /> : (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground">Active Projects</span>
                  <span className="font-mono text-2xl font-bold text-primary">{summary?.activeProjects || 0}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Center - NEXUS CORE */}
        <div className="lg:col-span-6 flex items-center justify-center relative min-h-[400px]">
          {/* Core Animation */}
          <div className="relative w-72 h-72 flex items-center justify-center">
            {/* Outer rings */}
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full border border-primary/20 border-t-primary/60 border-b-primary/60"
            />
            <motion.div 
              animate={{ rotate: -360 }} 
              transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
              className="absolute inset-4 rounded-full border border-primary/10 border-l-primary/50 border-r-primary/50"
            />
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-8 rounded-full border border-dashed border-primary/30"
            />
            
            {/* Inner Core */}
            <div className="absolute inset-16 rounded-full bg-card/80 backdrop-blur-xl border border-primary/40 flex items-center justify-center neon-glow">
              <motion.div 
                animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="flex flex-col items-center justify-center text-center"
              >
                <BrainCircuit className="w-12 h-12 text-primary mb-2" />
                <span className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Nexus Core</span>
                <span className="text-2xl font-mono font-light text-white mt-1">ONLINE</span>
              </motion.div>
            </div>
            
            {/* Orbiting particles */}
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0"
            >
              <div className="w-2 h-2 bg-accent rounded-full absolute -top-1 left-1/2 shadow-[0_0_10px_rgba(201,168,76,0.8)]" />
            </motion.div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <Card className="glass-panel border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-destructive" /> Security Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSummary ? <div className="h-10 animate-pulse bg-secondary rounded" /> : (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground">System Score</span>
                  <span className="font-mono text-2xl font-bold text-green-400">{summary?.securityScore || 0}/100</span>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card className="glass-panel border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" /> System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSummary ? <div className="h-20 animate-pulse bg-secondary rounded" /> : (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-foreground">Active Agents</span>
                    <span className="font-mono text-lg font-bold text-primary">{summary?.activeAgents || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-foreground">Unread Messages</span>
                    <span className="font-mono text-lg font-bold text-white">{summary?.unreadMessages || 0}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
        <Card className="glass-panel border-white/5 h-[300px]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Task Completion Trends</CardTitle>
          </CardHeader>
          <CardContent className="h-[220px]">
            {loadingAnalytics ? <div className="w-full h-full bg-secondary/50 animate-pulse rounded" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics?.taskCompletion || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="label" stroke="rgba(255,255,255,0.5)" fontSize={12} />
                  <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(10, 22, 40, 0.9)', borderColor: 'rgba(0, 212, 255, 0.2)' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel border-white/5 h-[300px]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Agent Performance</CardTitle>
          </CardHeader>
          <CardContent className="h-[220px]">
            {loadingAnalytics ? <div className="w-full h-full bg-secondary/50 animate-pulse rounded" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.agentPerformance || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" fontSize={12} />
                  <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(10, 22, 40, 0.9)', borderColor: 'rgba(0, 212, 255, 0.2)' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="reliability" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cost" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
