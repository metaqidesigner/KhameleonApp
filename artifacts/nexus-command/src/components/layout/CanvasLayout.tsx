import React, { useEffect, useRef, useState, useCallback, lazy } from 'react';
import {
  LayoutDashboard, Bot, Inbox, FolderKanban, Calendar, MessageSquare,
  Workflow, ShieldAlert, Key, FlaskConical, BrainCircuit, Network,
  LineChart, CheckSquare, Store, Settings, Puzzle, WifiOff,
} from 'lucide-react';
import { BrainCanvas } from '@/components/BrainCanvas';
import { TopBar } from '@/components/TopBar';
import { CommandBar } from '@/components/CommandBar';
import { Panel } from '@/components/Panel';
import { useNexusStore } from '@/store/nexusStore';
import { useJarvisHealth, useJarvisConnectors } from '@/hooks/useJarvis';

// ── Lazy-loaded page components ───────────────────────────────────────────────
const Dashboard      = lazy(() => import('@/pages/dashboard'));
const Agents         = lazy(() => import('@/pages/agents'));
const InboxPage      = lazy(() => import('@/pages/inbox'));
const Projects       = lazy(() => import('@/pages/projects/index'));
const CalendarPage   = lazy(() => import('@/pages/calendar'));
const Communications = lazy(() => import('@/pages/communications'));
const Automations    = lazy(() => import('@/pages/automations'));
const Security       = lazy(() => import('@/pages/security'));
const Vault          = lazy(() => import('@/pages/vault'));
const Research       = lazy(() => import('@/pages/research'));
const Memory         = lazy(() => import('@/pages/memory'));
const KnowledgeGraph = lazy(() => import('@/pages/knowledge-graph'));
const Analytics      = lazy(() => import('@/pages/analytics'));
const Approvals      = lazy(() => import('@/pages/approvals'));
const Marketplace    = lazy(() => import('@/pages/marketplace'));
const SettingsPage   = lazy(() => import('@/pages/settings'));
const Skills         = lazy(() => import('@/pages/skills'));

// ── Module definitions ────────────────────────────────────────────────────────
interface ModuleDef {
  id: string;
  label: string;
  Icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  glow: string;
  angle: number;
  ring: 'inner' | 'middle' | 'outer';
  agentBadge?: string;
  description: string;
}

const MODULES: ModuleDef[] = [
  // Inner ring — 6 core operational (evenly at 60° apart)
  { id: 'dashboard',      label: 'Dashboard',     Icon: LayoutDashboard, color: '#00d4ff', glow: '0,212,255',   angle: 0,   ring: 'inner', agentBadge: 'orchestrator', description: 'Executive overview' },
  { id: 'inbox',          label: 'Inbox',         Icon: Inbox,           color: '#00d4ff', glow: '0,212,255',   angle: 60,  ring: 'inner', agentBadge: 'simple',       description: 'Messages & alerts' },
  { id: 'agents',         label: 'Agents',        Icon: Bot,             color: '#00d4ff', glow: '0,212,255',   angle: 120, ring: 'inner', agentBadge: 'orchestrator', description: 'AI agent control' },
  { id: 'communications', label: 'Comms',         Icon: MessageSquare,   color: '#38bdf8', glow: '56,189,248',  angle: 180, ring: 'inner', agentBadge: 'channel_agent',description: 'Integrations & connectors' },
  { id: 'calendar',       label: 'Calendar',      Icon: Calendar,        color: '#c9a84c', glow: '201,168,76',  angle: 240, ring: 'inner', agentBadge: 'simple',       description: 'Schedule & events' },
  { id: 'approvals',      label: 'Approvals',     Icon: CheckSquare,     color: '#f59e0b', glow: '245,158,11',  angle: 300, ring: 'inner', agentBadge: 'simple',       description: 'Pending decisions' },

  // Middle ring — 6 intelligence modules (offset by 30°)
  { id: 'research',       label: 'Research',      Icon: FlaskConical,    color: '#38bdf8', glow: '56,189,248',  angle: 30,  ring: 'middle', agentBadge: 'deep_research',description: 'Deep AI research' },
  { id: 'analytics',      label: 'Analytics',     Icon: LineChart,       color: '#10b981', glow: '16,185,129',  angle: 90,  ring: 'middle', agentBadge: 'operative',   description: 'Data & metrics' },
  { id: 'memory',         label: 'Memory',        Icon: BrainCircuit,    color: '#a855f7', glow: '168,85,247',  angle: 150, ring: 'middle', agentBadge: 'simple',      description: 'Indexed knowledge' },
  { id: 'knowledge',      label: 'Knowledge',     Icon: Network,         color: '#38bdf8', glow: '56,189,248',  angle: 210, ring: 'middle', agentBadge: 'simple',      description: 'Knowledge graph' },
  { id: 'security',       label: 'Security',      Icon: ShieldAlert,     color: '#ef4444', glow: '239,68,68',   angle: 270, ring: 'middle', agentBadge: 'operative',   description: 'Access & threats' },
  { id: 'automations',    label: 'Automations',   Icon: Workflow,        color: '#a855f7', glow: '168,85,247',  angle: 330, ring: 'middle', agentBadge: 'proactive_agent', description: 'Scheduled agents' },

  // Outer ring — 4 utility/config (evenly at 90°)
  { id: 'vault',          label: 'Vault',         Icon: Key,             color: '#c9a84c', glow: '201,168,76',  angle: 45,  ring: 'outer', description: 'Encrypted secrets' },
  { id: 'marketplace',    label: 'Marketplace',   Icon: Store,           color: '#10b981', glow: '16,185,129',  angle: 135, ring: 'outer', description: 'Extensions & apps' },
  { id: 'settings',       label: 'Settings',      Icon: Settings,        color: '#00d4ff', glow: '0,212,255',   angle: 225, ring: 'outer', description: 'System config' },
  { id: 'skills',         label: 'Skills',        Icon: Puzzle,          color: '#f59e0b', glow: '245,158,11',  angle: 315, ring: 'outer', description: 'Installed skills' },
];

const PAGE_MAP: Record<string, React.ReactNode> = {
  dashboard:      <Dashboard />,
  inbox:          <InboxPage />,
  projects:       <Projects />,
  calendar:       <CalendarPage />,
  approvals:      <Approvals />,
  security:       <Security />,
  automations:    <Automations />,
  communications: <Communications />,
  agents:         <Agents />,
  research:       <Research />,
  analytics:      <Analytics />,
  vault:          <Vault />,
  memory:         <Memory />,
  knowledge:      <KnowledgeGraph />,
  marketplace:    <Marketplace />,
  settings:       <SettingsPage />,
  skills:         <Skills />,
};

// ── Module node ───────────────────────────────────────────────────────────────
function ModuleNode({
  mod, cx, cy, r, active, hovered, connectedIds,
  onClick, onHover, onLeave,
}: {
  mod: ModuleDef; cx: number; cy: number; r: number;
  active: boolean; hovered: boolean; connectedIds: Set<string>;
  onClick: () => void; onHover: () => void; onLeave: () => void;
}) {
  const rad = (mod.angle - 90) * (Math.PI / 180);
  const nx = cx + Math.cos(rad) * r;
  const ny = cy + Math.sin(rad) * r;
  const nodeSize = active ? 52 : hovered ? 48 : 42;
  const { Icon } = mod;
  const isConnected = connectedIds.has(mod.id);

  return (
    <div
      style={{
        position: 'absolute', left: nx, top: ny,
        transform: 'translate(-50%,-50%)',
        zIndex: 20, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
      }}
      onClick={onClick} onMouseEnter={onHover} onMouseLeave={onLeave}
    >
      {/* Line to brain */}
      <svg style={{ position: 'absolute', overflow: 'visible', pointerEvents: 'none', zIndex: -1 }} width={1} height={1}>
        <line
          x1={0} y1={0} x2={cx - nx} y2={cy - ny}
          stroke={active ? mod.color : hovered ? `rgba(${mod.glow},0.3)` : `rgba(0,212,255,0.07)`}
          strokeWidth={active ? 1.5 : 1}
          strokeDasharray={active ? 'none' : '3 7'}
          style={{ transition: 'stroke 0.3s ease' }}
        />
      </svg>

      {/* Node */}
      <div
        style={{
          width: nodeSize, height: nodeSize, borderRadius: '50%', position: 'relative',
          background: active
            ? `radial-gradient(circle, rgba(${mod.glow},0.22) 0%, rgba(${mod.glow},0.06) 100%)`
            : hovered ? `rgba(${mod.glow},0.1)` : 'rgba(2,14,28,0.85)',
          border: `1.5px solid ${active || hovered ? mod.color : 'rgba(0,212,255,0.18)'}`,
          boxShadow: active
            ? `0 0 22px rgba(${mod.glow},0.5), 0 0 50px rgba(${mod.glow},0.18), inset 0 0 18px rgba(${mod.glow},0.1)`
            : hovered ? `0 0 14px rgba(${mod.glow},0.38)` : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(12px)',
          transition: 'background 0.25s, border-color 0.25s, box-shadow 0.25s, width 0.2s, height 0.2s',
        }}
      >
        <Icon className="w-5 h-5" style={{ color: active || hovered ? mod.color : 'rgba(0,212,255,0.55)', transition: 'color 0.25s', width: 18, height: 18 }} />
        {/* Connected indicator */}
        {isConnected && (
          <div style={{
            position: 'absolute', bottom: 1, right: 1,
            width: 7, height: 7, borderRadius: '50%',
            background: '#10b981', boxShadow: '0 0 5px #10b981',
            border: '1px solid rgba(2,14,28,0.8)',
          }} />
        )}
      </div>

      {/* Label */}
      <span style={{
        fontSize: 9, fontWeight: 600, letterSpacing: '0.1em',
        color: active || hovered ? mod.color : 'rgba(130,190,220,0.5)',
        textTransform: 'uppercase', whiteSpace: 'nowrap',
        textShadow: active ? `0 0 8px rgba(${mod.glow},0.8)` : 'none',
        transition: 'color 0.25s',
      }}>
        {mod.label}
      </span>
    </div>
  );
}

// ── Mobile grid fallback ──────────────────────────────────────────────────────
function MobileGrid({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div style={{
      padding: '70px 16px 100px',
      overflowY: 'auto', height: '100%',
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
    }}>
      {MODULES.map(mod => {
        const { Icon } = mod;
        return (
          <button
            key={mod.id}
            onClick={() => onOpen(mod.id)}
            style={{
              background: 'rgba(2,14,28,0.85)', border: `1px solid rgba(${mod.glow},0.2)`,
              borderRadius: 16, padding: '20px 16px',
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10,
              cursor: 'pointer', textAlign: 'left',
              boxShadow: `0 0 20px rgba(${mod.glow},0.06)`,
              backdropFilter: 'blur(12px)',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: `rgba(${mod.glow},0.12)`, border: `1px solid rgba(${mod.glow},0.3)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon style={{ width: 18, height: 18, color: mod.color }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e0f0ff', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {mod.label}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(130,170,200,0.6)', marginTop: 3 }}>
                {mod.description}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Main layout ───────────────────────────────────────────────────────────────
export function CanvasLayout() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [renderedModule, setRenderedModule] = useState<string | null>(null);

  const { activeModule, panelOpen, isStreaming, setActiveModule, setPanelOpen } = useNexusStore();
  const { data: health } = useJarvisHealth();
  const { data: connectors } = useJarvisConnectors();

  const isOffline = health?.status === 'offline' || !health;
  const connectedIds = new Set((connectors ?? []).filter(c => c.connected).map(c => c.id));
  const connectedCount = connectedIds.size;

  useEffect(() => { document.documentElement.classList.add('dark'); }, []);

  useEffect(() => {
    const update = () => {
      if (containerRef.current)
        setSize({ w: containerRef.current.clientWidth, h: containerRef.current.clientHeight });
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const openModule = useCallback((id: string) => {
    setRenderedModule(id);
    setActiveModule(id);
    setPanelOpen(true);
    setShowSettings(id === 'settings');
  }, [setActiveModule, setPanelOpen]);

  const openSettings = useCallback(() => {
    openModule('settings');
  }, [openModule]);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setTimeout(() => { setActiveModule(null); setRenderedModule(null); setShowSettings(false); }, 380);
  }, [setPanelOpen, setActiveModule]);

  const { w, h } = size;
  const isMobile = w > 0 && w < 768;
  const cx = w / 2, cy = h / 2;
  const safeArea = Math.min(w * 0.9, (h - 54 - 80) * 0.88);
  const innerR  = safeArea * 0.28;
  const middleR = safeArea * 0.42;
  const outerR  = safeArea * 0.56;

  const activeMod = MODULES.find(m => m.id === activeModule);
  const activeAngle = activeMod ? activeMod.angle : null;
  const panelWidth = Math.min(Math.max(w * 0.58, 480), 1100);

  const getRingRadius = (ring: ModuleDef['ring']) => {
    if (ring === 'inner') return innerR;
    if (ring === 'middle') return middleR;
    return outerR;
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100vw', height: '100vh', overflow: 'hidden',
        position: 'relative', background: '#020810',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Background layers */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: 'radial-gradient(ellipse at 50% 50%, #030f1a 0%, #020810 55%, #010508 100%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(0,212,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.022) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
      }} />

      {/* Offline banner */}
      {isOffline && (
        <div style={{
          position: 'absolute', top: 54, left: 0, right: 0, zIndex: 48,
          background: 'rgba(239,68,68,0.12)', backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(239,68,68,0.2)',
          padding: '6px 24px',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11, color: 'rgba(239,68,68,0.9)', letterSpacing: '0.08em', fontWeight: 600,
        }}>
          <WifiOff style={{ width: 12, height: 12 }} />
          NEXUS OFFLINE — RUNNING IN DEMO MODE
        </div>
      )}

      {/* Neural brain canvas */}
      {w > 0 && (
        <BrainCanvas
          w={w} h={h}
          isStreaming={isStreaming}
          activeAngle={activeAngle}
          connectedModules={connectedCount}
          isOffline={isOffline}
        />
      )}

      {/* NEXUS CORE centre label */}
      {w > 0 && !isMobile && (
        <div style={{
          position: 'absolute', left: cx, top: cy, zIndex: 10,
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 10, letterSpacing: '0.28em', color: isOffline ? 'rgba(239,68,68,0.5)' : 'rgba(0,212,255,0.55)', fontWeight: 500 }}>
            NEXUS CORE
          </div>
          <div style={{
            fontSize: 19, fontWeight: 800, letterSpacing: '0.12em',
            color: isOffline ? 'rgba(239,68,68,0.8)' : '#fff', marginTop: 4,
            textShadow: isOffline
              ? '0 0 24px rgba(239,68,68,0.9)'
              : '0 0 24px rgba(0,212,255,0.9), 0 0 60px rgba(0,212,255,0.3)',
          }}>
            {isOffline ? 'OFFLINE' : isStreaming ? 'THINKING' : 'ONLINE'}
          </div>
        </div>
      )}

      {/* Orbit ring SVG guides with rotation animations */}
      {w > 0 && !isMobile && (
        <svg style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }} width={w} height={h}>
          <circle cx={cx} cy={cy} r={innerR}
            fill="none" stroke="rgba(0,212,255,0.065)" strokeWidth={1} strokeDasharray="4 8"
            style={{ transformOrigin: `${cx}px ${cy}px`, animation: 'orbit-cw 60s linear infinite' }}
          />
          <circle cx={cx} cy={cy} r={middleR}
            fill="none" stroke="rgba(0,212,255,0.04)" strokeWidth={1} strokeDasharray="2 10"
          />
          <circle cx={cx} cy={cy} r={outerR}
            fill="none" stroke="rgba(0,212,255,0.028)" strokeWidth={1} strokeDasharray="2 14"
            style={{ transformOrigin: `${cx}px ${cy}px`, animation: 'orbit-ccw 90s linear infinite' }}
          />
        </svg>
      )}

      {/* Module nodes (desktop orbital) */}
      {w > 0 && !isMobile && MODULES.map(mod => (
        <ModuleNode
          key={mod.id} mod={mod} cx={cx} cy={cy}
          r={getRingRadius(mod.ring)}
          active={activeModule === mod.id}
          hovered={hoveredModule === mod.id}
          connectedIds={connectedIds}
          onClick={() => openModule(mod.id)}
          onHover={() => setHoveredModule(mod.id)}
          onLeave={() => setHoveredModule(null)}
        />
      ))}

      {/* Mobile grid */}
      {isMobile && <MobileGrid onOpen={openModule} />}

      {/* TOP BAR */}
      <TopBar onOpenSettings={openSettings} showSettings={showSettings} />

      {/* COMMAND BAR */}
      <CommandBar width={w} />

      {/* SLIDE-IN PANEL */}
      <Panel
        open={panelOpen}
        onClose={closePanel}
        title={showSettings ? 'Settings' : (activeMod?.label ?? '')}
        icon={activeMod
          ? <activeMod.Icon style={{ width: 16, height: 16, color: activeMod.color }} />
          : showSettings
          ? <Settings style={{ width: 16, height: 16, color: '#00d4ff' }} />
          : null
        }
        accentGlow={activeMod?.glow}
        accentColor={activeMod?.color}
        agentBadge={activeMod?.agentBadge}
        maxWidth={panelWidth}
      >
        {renderedModule && (PAGE_MAP[renderedModule] ?? null)}
      </Panel>
    </div>
  );
}
