import { useGetDashboardAnalytics, getGetDashboardAnalyticsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart as LineChartIcon, Activity } from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

export default function Analytics() {
  const { data: analytics, isLoading } = useGetDashboardAnalytics({ query: { queryKey: getGetDashboardAnalyticsQueryKey() }});

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="flex items-center gap-3">
        <LineChartIcon className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Analytics Engine</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <Card className="glass-panel border-white/5 h-[350px]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Task Completion (30 Days)</CardTitle>
          </CardHeader>
          <CardContent className="h-[270px]">
            {isLoading ? <div className="w-full h-full bg-secondary/50 animate-pulse rounded" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics?.taskCompletion || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="label" stroke="rgba(255,255,255,0.5)" fontSize={12} />
                  <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(10, 22, 40, 0.9)', borderColor: 'rgba(0, 212, 255, 0.2)' }} />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: 'hsl(var(--primary))' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel border-white/5 h-[350px]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Communication Volume</CardTitle>
          </CardHeader>
          <CardContent className="h-[270px]">
            {isLoading ? <div className="w-full h-full bg-secondary/50 animate-pulse rounded" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics?.communicationVolume || []}>
                  <defs>
                    <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="label" stroke="rgba(255,255,255,0.5)" fontSize={12} />
                  <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(10, 22, 40, 0.9)', borderColor: 'rgba(0, 212, 255, 0.2)' }} />
                  <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-3))" fillOpacity={1} fill="url(#colorVolume)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel border-white/5 h-[350px]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Time Allocation</CardTitle>
          </CardHeader>
          <CardContent className="h-[270px] flex items-center justify-center">
            {isLoading ? <div className="w-full h-full bg-secondary/50 animate-pulse rounded" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics?.timeAllocation || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {(analytics?.timeAllocation || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(10, 22, 40, 0.9)', borderColor: 'rgba(0, 212, 255, 0.2)' }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel border-white/5 h-[350px]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Project Progress</CardTitle>
          </CardHeader>
          <CardContent className="h-[270px]">
            {isLoading ? <div className="w-full h-full bg-secondary/50 animate-pulse rounded" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.projectProgress || []} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={true} vertical={false} />
                  <XAxis type="number" domain={[0, 100]} stroke="rgba(255,255,255,0.5)" fontSize={12} />
                  <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.8)" fontSize={12} width={100} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(10, 22, 40, 0.9)', borderColor: 'rgba(0, 212, 255, 0.2)' }} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                  <Bar dataKey="progress" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
