import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Settings as SettingsIcon, User, Bell, Shield, Database, Cpu } from 'lucide-react';
import { useListModes, getListModesQueryKey, useSetCurrentMode, getGetCurrentModeQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

export default function Settings() {
  const { data: modes } = useListModes({ query: { queryKey: getListModesQueryKey() } });
  const setMode = useSetCurrentMode();
  const queryClient = useQueryClient();

  const handleModeChange = (modeId: number) => {
    setMode.mutate({ data: { modeId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListModesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCurrentModeQueryKey() });
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-10">
      <div className="flex items-center gap-3">
        <SettingsIcon className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight text-foreground">System Settings</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 flex flex-col gap-2">
          {['Profile', 'Operating Modes', 'Notifications', 'Security', 'Data & Memory', 'Advanced'].map((tab, i) => (
            <div 
              key={tab} 
              className={cn(
                "px-4 py-3 rounded-lg text-sm font-medium cursor-pointer transition-colors",
                i === 1 ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              {tab}
            </div>
          ))}
        </div>

        <div className="md:col-span-2 flex flex-col gap-6">
          <Card className="glass-panel border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Cpu className="w-5 h-5 text-primary" /> Operating Modes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground mb-2">Configure how Nexus Command behaves across different contexts. Selecting a mode changes UI density, notification routing, and active agents.</p>
              
              <div className="flex flex-col gap-3">
                {modes?.map(mode => (
                  <div 
                    key={mode.id} 
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg border transition-all cursor-pointer",
                      mode.isActive ? "bg-primary/5 border-primary/40 shadow-[0_0_10px_rgba(0,212,255,0.1)]" : "bg-secondary/30 border-white/5 hover:border-white/20"
                    )}
                    onClick={() => handleModeChange(mode.id)}
                  >
                    <div>
                      <div className={cn("font-bold", mode.isActive ? "text-primary" : "text-foreground")}>{mode.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{mode.description}</div>
                    </div>
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2",
                      mode.isActive ? "border-primary bg-primary" : "border-muted-foreground/50"
                    )} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel border-white/10 opacity-70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Bell className="w-5 h-5 text-muted-foreground" /> Notifications</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="notif-sound" className="flex flex-col gap-1 cursor-pointer">
                  <span>Audio Alerts</span>
                  <span className="font-normal text-xs text-muted-foreground">Play subtle sci-fi sounds for critical alerts</span>
                </Label>
                <Switch id="notif-sound" defaultChecked />
              </div>
              <div className="flex items-center justify-between mt-2">
                <Label htmlFor="notif-agent" className="flex flex-col gap-1 cursor-pointer">
                  <span>Agent Proactivity</span>
                  <span className="font-normal text-xs text-muted-foreground">Allow agents to initiate actions without prompt</span>
                </Label>
                <Switch id="notif-agent" defaultChecked />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
