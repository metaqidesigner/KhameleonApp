import { lazy, Suspense } from 'react';
import Background from './Background';
import TopBar from './TopBar';
import NewsTicker from './NewsTicker';
import CommandPalette from './CommandPalette';
import ChatPanel from './ChatPanel';
import { LeftSidebar } from './LeftSidebar';
import { JarvisOrbPortal } from './orb/JarvisOrbPortal';
import { VoiceController } from './orb/VoiceController';
import { OnboardingWizard } from './OnboardingWizard';
import { useJarvisStore } from '@/store/jarvisStore';

const UnifiedCanvas = lazy(() => import('@/pages/canvas'));
const Agents     = lazy(() => import('@/pages/agents'));
const Research   = lazy(() => import('@/pages/research'));
const Memory     = lazy(() => import('@/pages/memory'));
const Comms      = lazy(() => import('@/pages/communications'));
const Analytics  = lazy(() => import('@/pages/analytics'));
const Security   = lazy(() => import('@/pages/security'));
const Vault      = lazy(() => import('@/pages/vault'));
const Skills     = lazy(() => import('@/pages/skills'));
const Integrations = lazy(() => import('@/pages/integrations'));
const Settings   = lazy(() => import('@/pages/settings'));
const Tasks      = lazy(() => import('@/pages/tasks'));
const Approvals  = lazy(() => import('@/pages/approvals'));
const Projects   = lazy(() => import('@/pages/projects'));
const Calendar   = lazy(() => import('@/pages/calendar'));
const Inbox      = lazy(() => import('@/pages/inbox'));

function Fallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 48, height: 48, border: '2px solid rgba(0,196,184,0.25)', borderTop: '2px solid var(--j-teal)', borderRadius: '50%', animation: 'jarvis-spin 0.8s linear infinite' }} />
        <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 11, color: 'var(--j-text-muted)', letterSpacing: '0.15em' }}>LOADING MODULE…</span>
      </div>
    </div>
  );
}

function PageRouter() {
  const activeTab = useJarvisStore(s => s.activeTab);
  return (
    <Suspense fallback={<Fallback />}>
      {activeTab === 'canvas'    && <UnifiedCanvas />}
      {activeTab === 'agents'    && <Agents />}
      {activeTab === 'research'  && <Research />}
      {activeTab === 'memory'    && <Memory />}
      {activeTab === 'comms'     && <Comms />}
      {activeTab === 'analytics' && <Analytics />}
      {activeTab === 'security'  && <Security />}
      {activeTab === 'vault'     && <Vault />}
      {activeTab === 'skills'    && <Skills />}
      {activeTab === 'integrations' && <Integrations />}
      {activeTab === 'approvals' && <Approvals />}
      {activeTab === 'settings'  && <Settings />}
      {activeTab === 'tasks'     && <Tasks />}
      {activeTab === 'projects'  && <Projects />}
      {activeTab === 'calendar'  && <Calendar />}
      {activeTab === 'inbox'     && <Inbox />}
    </Suspense>
  );
}

export function AppShell() {
  return (
    <>
      <Background />
      <div className="j-shell" style={{ position: 'relative', zIndex: 1 }}>
        <TopBar />
        <div className="j-body-row">
          <LeftSidebar />
          <div className="j-main-area" style={{ flex: 1 }}>
            <PageRouter />
          </div>
        </div>
        <NewsTicker />
      </div>

      <CommandPalette />
      <ChatPanel />

      {/* Floating orb — always present */}
      <JarvisOrbPortal />

      <VoiceController />
      <OnboardingWizard />
    </>
  );
}
