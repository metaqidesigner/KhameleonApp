import { lazy, Suspense } from 'react';
import Background from './Background';
import TopBar from './TopBar';
import NewsTicker from './NewsTicker';
import CommandPalette from './CommandPalette';
import ChatPanel from './ChatPanel';
import { JarvisOrbPortal } from './orb/JarvisOrbPortal';
import { VoiceController } from './orb/VoiceController';
import { useJarvisStore } from '@/store/jarvisStore';

const Overview    = lazy(() => import('@/pages/overview'));
const Agents      = lazy(() => import('@/pages/agents'));
const Research    = lazy(() => import('@/pages/research'));
const Memory      = lazy(() => import('@/pages/memory'));
const Comms       = lazy(() => import('@/pages/communications'));
const Analytics   = lazy(() => import('@/pages/analytics'));
const Security    = lazy(() => import('@/pages/security'));
const Vault       = lazy(() => import('@/pages/vault'));
const Skills      = lazy(() => import('@/pages/skills'));
const Settings    = lazy(() => import('@/pages/settings'));

function Fallback() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
        <div style={{ width:48, height:48, border:'2px solid rgba(0,212,255,0.3)', borderTop:'2px solid var(--j-cyan)', borderRadius:'50%', animation:'jarvis-spin 0.8s linear infinite' }} />
        <span style={{ fontFamily:'var(--j-font-mono)', fontSize:11, color:'var(--j-text-muted)', letterSpacing:'0.15em' }}>LOADING MODULE...</span>
      </div>
    </div>
  );
}

function PageRouter() {
  const activeTab = useJarvisStore(s => s.activeTab);
  return (
    <Suspense fallback={<Fallback />}>
      {activeTab === 'overview'  && <Overview />}
      {activeTab === 'agents'    && <Agents />}
      {activeTab === 'research'  && <Research />}
      {activeTab === 'memory'    && <Memory />}
      {activeTab === 'comms'     && <Comms />}
      {activeTab === 'analytics' && <Analytics />}
      {activeTab === 'security'  && <Security />}
      {activeTab === 'vault'     && <Vault />}
      {activeTab === 'skills'    && <Skills />}
      {activeTab === 'settings'  && <Settings />}
    </Suspense>
  );
}

export function AppShell() {
  return (
    <>
      <Background />
      <div className="j-shell" style={{ position:'relative', zIndex:1 }}>
        <TopBar />
        <div className="j-content-area" style={{ overflow:'hidden', flex:1 }}>
          <PageRouter />
        </div>
        <NewsTicker />
      </div>
      <CommandPalette />
      <ChatPanel />
      <JarvisOrbPortal />
      <VoiceController />
    </>
  );
}
