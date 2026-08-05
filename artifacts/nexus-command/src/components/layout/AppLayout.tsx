import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  LayoutDashboard, 
  Bot, 
  Inbox, 
  FolderKanban, 
  Calendar, 
  MessageSquare, 
  Workflow, 
  ShieldAlert, 
  Key, 
  FlaskConical, 
  BrainCircuit, 
  Network, 
  LineChart, 
  CheckSquare, 
  Store, 
  Settings,
  Bell,
  Activity,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGetCurrentMode } from '@workspace/api-client-react';

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/agents', icon: Bot, label: 'Agents' },
  { href: '/inbox', icon: Inbox, label: 'Inbox' },
  { href: '/projects', icon: FolderKanban, label: 'Projects' },
  { href: '/calendar', icon: Calendar, label: 'Calendar' },
  { href: '/communications', icon: MessageSquare, label: 'Comms' },
  { href: '/automations', icon: Workflow, label: 'Automations' },
  { href: '/security', icon: ShieldAlert, label: 'Security' },
  { href: '/vault', icon: Key, label: 'Vault' },
  { href: '/research', icon: FlaskConical, label: 'Research' },
  { href: '/memory', icon: BrainCircuit, label: 'Memory' },
  { href: '/knowledge-graph', icon: Network, label: 'Knowledge Graph' },
  { href: '/analytics', icon: LineChart, label: 'Analytics' },
  { href: '/approvals', icon: CheckSquare, label: 'Approvals' },
  { href: '/marketplace', icon: Store, label: 'Marketplace' },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { data: currentMode } = useGetCurrentMode({ query: { queryKey: ['currentMode'] } });

  // Add dark mode explicitly
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground font-sans">
      {/* Sidebar */}
      <aside 
        className={cn(
          "relative flex flex-col h-full border-r border-sidebar-border bg-sidebar transition-all duration-300 z-20 neon-glow",
          collapsed ? "w-[80px]" : "w-[240px]"
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
          {!collapsed && <span className="font-bold tracking-wider text-primary truncate text-sm">NEWTONIA</span>}
          {collapsed && <span className="font-bold text-primary mx-auto text-sm">NW</span>}
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 scrollbar-hide">
          <nav className="flex flex-col gap-1 px-2">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <div className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-all duration-200 group",
                    isActive 
                      ? "bg-primary/10 text-primary neon-glow" 
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}>
                    <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-primary" : "group-hover:text-primary")} />
                    {!collapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-sidebar-border flex flex-col gap-2">
          <Link href="/settings">
            <div className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-all duration-200 text-muted-foreground hover:bg-secondary hover:text-foreground",
              location === '/settings' && "bg-primary/10 text-primary neon-glow"
            )}>
              <Settings className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="text-sm font-medium">Settings</span>}
            </div>
          </Link>
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full p-2 mt-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-border glass-panel z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 border border-border">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-semibold tracking-wide text-primary uppercase">
                {currentMode?.name || 'SYSTEM ONLINE'}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 border border-border">
              <Activity className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs font-medium text-green-400">99.9% HEALTH</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-full hover:bg-secondary transition-colors">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />
            </button>
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center overflow-hidden">
              <span className="text-xs font-bold text-primary">EX</span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide relative z-0">
          {/* Subtle background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
          
          <div className="relative z-10 h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
