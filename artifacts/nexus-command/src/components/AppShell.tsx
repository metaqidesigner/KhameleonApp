import { lazy, Suspense } from 'react';
import { TopBar } from './TopBar';
import { NavRail } from './NavRail';
import { StatusBar } from './StatusBar';
import { CommandPalette } from './CommandPalette';
import { useJarvisStore, type ModuleId } from '@/store/jarvisStore';

// Lazy load all pages
const Dashboard      = lazy(() => import('@/pages/dashboard'));
const Chat           = lazy(() => import('@/pages/chat'));
const Inbox          = lazy(() => import('@/pages/inbox'));
const Projects       = lazy(() => import('@/pages/projects/index'));
const Approvals      = lazy(() => import('@/pages/approvals'));
const Calendar       = lazy(() => import('@/pages/calendar'));
const Research       = lazy(() => import('@/pages/research'));
const Memory         = lazy(() => import('@/pages/memory'));
const Knowledge      = lazy(() => import('@/pages/knowledge-graph'));
const Analytics      = lazy(() => import('@/pages/analytics'));
const Automations    = lazy(() => import('@/pages/automations'));
const Agents         = lazy(() => import('@/pages/agents'));
const Skills         = lazy(() => import('@/pages/skills'));
const Security       = lazy(() => import('@/pages/security'));
const Vault          = lazy(() => import('@/pages/vault'));
const Communications = lazy(() => import('@/pages/communications'));
const Marketplace    = lazy(() => import('@/pages/marketplace'));
const SettingsPage   = lazy(() => import('@/pages/settings'));

function PageFallback() {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="j-skeleton" style={{ height: 80, borderRadius: 6 }} />
      ))}
    </div>
  );
}

function PageRouter({ module }: { module: ModuleId }) {
  switch (module) {
    case 'dashboard':      return <Dashboard />;
    case 'chat':           return <Chat />;
    case 'inbox':          return <Inbox />;
    case 'projects':       return <Projects />;
    case 'approvals':      return <Approvals />;
    case 'calendar':       return <Calendar />;
    case 'research':       return <Research />;
    case 'memory':         return <Memory />;
    case 'knowledge':      return <Knowledge />;
    case 'analytics':      return <Analytics />;
    case 'automations':    return <Automations />;
    case 'agents':         return <Agents />;
    case 'skills':         return <Skills />;
    case 'security':       return <Security />;
    case 'vault':          return <Vault />;
    case 'communications': return <Communications />;
    case 'marketplace':    return <Marketplace />;
    case 'settings':       return <SettingsPage />;
    default:               return <Dashboard />;
  }
}

// Mobile tab bar — 5 core items only
function MobileTabBar() {
  const { activeModule, setActiveModule } = useJarvisStore();
  const tabs: { id: ModuleId; label: string }[] = [
    { id: 'dashboard', label: '⊞' },
    { id: 'chat',      label: '💬' },
    { id: 'research',  label: '⚗' },
    { id: 'memory',    label: '🧠' },
    { id: 'settings',  label: '⚙' },
  ];
  return (
    <div className="j-mobile-tabs">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => setActiveModule(t.id)}
          style={{
            flex: 1, border: 'none', background: 'transparent',
            color: activeModule === t.id ? '#58a6ff' : '#8b949e',
            fontSize: 18, cursor: 'pointer', display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function AppShell() {
  const activeModule = useJarvisStore(s => s.activeModule);

  return (
    <div className="j-shell">
      <TopBar />
      <div className="j-body">
        <NavRail />
        <main className="j-main scrollbar-thin">
          <Suspense fallback={<PageFallback />}>
            <PageRouter module={activeModule} />
          </Suspense>
        </main>
      </div>
      <StatusBar />
      <CommandPalette />
      <MobileTabBar />
    </div>
  );
}
