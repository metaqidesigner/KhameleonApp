import { lazy, Suspense, useEffect } from 'react';
import Background from './Background';
import TopBar from './TopBar';
import NewsTicker from './NewsTicker';
import CommandPalette from './CommandPalette';
import ChatWindow from './chatWindow/ChatWindow';
import { SuggestionSlot } from '@/components/notices/SuggestionSlot';
import { LoginRequests } from '@/components/notices/LoginRequests';
import { DetectionBadge } from '@/components/notices/DetectionBadge';
import { pairDesktopLink } from '@/lib/desktopBridge';
import { LeftSidebar } from './LeftSidebar';
import { KhameleonOrbPortal } from './orb/KhameleonOrbPortal';
import { VoiceController } from './orb/VoiceController';
import { OnboardingWizard } from './OnboardingWizard';
import { NeedsInputWatcher } from './NeedsInputWatcher';
import { useKhameleonStore } from '@/store/khameleonStore';

const Home = lazy(() => import('@/pages/home'));
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
        <div style={{ width: 48, height: 48, border: '2px solid rgba(0,196,184,0.25)', borderTop: '2px solid var(--j-teal)', borderRadius: '50%', animation: 'khameleon-spin 0.8s linear infinite' }} />
        <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 11, color: 'var(--j-text-muted)', letterSpacing: '0.15em' }}>LOADING MODULE…</span>
      </div>
    </div>
  );
}

function PageRouter() {
  const activeTab = useKhameleonStore(s => s.activeTab);
  return (
    <Suspense fallback={<Fallback />}>
      {activeTab === 'canvas'    && <Home />}
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
  // Build 7: let the chat's AI work in this computer's apps (pairs the desktop link; no-op in a browser).
  useEffect(() => { void pairDesktopLink().catch(() => {}); }, []);
  // Build 6: a detection offer's "Capture it" - Capture lives on the Skill Sets page in Classic.
  const setActiveTab = useKhameleonStore(s => s.setActiveTab);
  useEffect(() => {
    const go = () => { (window as unknown as { __khameleonCaptureRequested?: boolean }).__khameleonCaptureRequested = true; setActiveTab('skills'); };
    window.addEventListener('khameleon:start-capture', go);
    return () => window.removeEventListener('khameleon:start-capture', go);
  }, [setActiveTab]);
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
      <ChatWindow />
      {/* Same suggestion slot as the Overlay (components/notices). */}
      <div style={{ position: "fixed", top: 52, right: 16, zIndex: 60, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
        <LoginRequests tone="classic" />
        <DetectionBadge tone="classic" />
        <SuggestionSlot tone="classic" />
      </div>

      {/* Floating orb — always present */}
      <KhameleonOrbPortal />

      {/* design-spec.md §6.5.1 real needs-input interrupt (2026-10-01) */}
      <NeedsInputWatcher />

      <VoiceController />
      <OnboardingWizard />
    </>
  );
}
