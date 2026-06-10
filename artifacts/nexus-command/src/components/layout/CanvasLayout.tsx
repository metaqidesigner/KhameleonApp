import React, { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Bot, Inbox, FolderKanban, Calendar, MessageSquare,
  Workflow, ShieldAlert, Key, FlaskConical, BrainCircuit, Network,
  LineChart, CheckSquare, Store, Settings, Bell, Activity, X, Command,
} from 'lucide-react';
import { useGetCurrentMode } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';

// ── Lazy-loaded page components ───────────────────────────────────────────────
const Dashboard     = lazy(() => import('@/pages/dashboard'));
const Agents        = lazy(() => import('@/pages/agents'));
const InboxPage     = lazy(() => import('@/pages/inbox'));
const Projects      = lazy(() => import('@/pages/projects/index'));
const CalendarPage  = lazy(() => import('@/pages/calendar'));
const Communications = lazy(() => import('@/pages/communications'));
const Automations   = lazy(() => import('@/pages/automations'));
const Security      = lazy(() => import('@/pages/security'));
const Vault         = lazy(() => import('@/pages/vault'));
const Research      = lazy(() => import('@/pages/research'));
const Memory        = lazy(() => import('@/pages/memory'));
const KnowledgeGraph = lazy(() => import('@/pages/knowledge-graph'));
const Analytics     = lazy(() => import('@/pages/analytics'));
const Approvals     = lazy(() => import('@/pages/approvals'));
const Marketplace   = lazy(() => import('@/pages/marketplace'));
const SettingsPage  = lazy(() => import('@/pages/settings'));

// ── Module definitions ────────────────────────────────────────────────────────
interface ModuleDef {
  id: string;
  label: string;
  Icon: React.FC<{ className?: string }>;
  color: string;
  glow: string;
  angle: number;        // degrees, 0 = top
  ring: 'inner' | 'outer';
}

const MODULES: ModuleDef[] = [
  // Inner ring — 9 core modules, evenly spaced
  { id: 'dashboard',      label: 'Dashboard',     Icon: LayoutDashboard, color: '#00d4ff', glow: '0,212,255',   angle: 0,   ring: 'inner' },
  { id: 'inbox',          label: 'Inbox',         Icon: Inbox,           color: '#00d4ff', glow: '0,212,255',   angle: 40,  ring: 'inner' },
  { id: 'projects',       label: 'Projects',      Icon: FolderKanban,    color: '#c9a84c', glow: '201,168,76',  angle: 80,  ring: 'inner' },
  { id: 'calendar',       label: 'Calendar',      Icon: Calendar,        color: '#c9a84c', glow: '201,168,76',  angle: 120, ring: 'inner' },
  { id: 'approvals',      label: 'Approvals',     Icon: CheckSquare,     color: '#f59e0b', glow: '245,158,11',  angle: 160, ring: 'inner' },
  { id: 'security',       label: 'Security',      Icon: ShieldAlert,     color: '#ef4444', glow: '239,68,68',   angle: 200, ring: 'inner' },
  { id: 'automations',    label: 'Automations',   Icon: Workflow,        color: '#a855f7', glow: '168,85,247',  angle: 240, ring: 'inner' },
  { id: 'communications', label: 'Comms',         Icon: MessageSquare,   color: '#00d4ff', glow: '0,212,255',   angle: 280, ring: 'inner' },
  { id: 'agents',         label: 'Agents',        Icon: Bot,             color: '#00d4ff', glow: '0,212,255',   angle: 320, ring: 'inner' },
  // Outer ring — 6 deep-intelligence modules
  { id: 'research',       label: 'Research',      Icon: FlaskConical,    color: '#38bdf8', glow: '56,189,248',  angle: 15,  ring: 'outer' },
  { id: 'analytics',      label: 'Analytics',     Icon: LineChart,       color: '#10b981', glow: '16,185,129',  angle: 75,  ring: 'outer' },
  { id: 'vault',          label: 'Vault',         Icon: Key,             color: '#c9a84c', glow: '201,168,76',  angle: 135, ring: 'outer' },
  { id: 'memory',         label: 'Memory',        Icon: BrainCircuit,    color: '#a855f7', glow: '168,85,247',  angle: 195, ring: 'outer' },
  { id: 'knowledge',      label: 'Knowledge',     Icon: Network,         color: '#38bdf8', glow: '56,189,248',  angle: 255, ring: 'outer' },
  { id: 'marketplace',    label: 'Marketplace',   Icon: Store,           color: '#10b981', glow: '16,185,129',  angle: 315, ring: 'outer' },
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
};

// ── Neural brain canvas animation ─────────────────────────────────────────────
interface Neuron { x: number; y: number; vx: number; vy: number; r: number; pulse: number; speed: number; brightness: number; }
interface Conn   { a: number; b: number; signal: number; signalSpeed: number; active: boolean; }

function BrainCanvas({ w, h }: { w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!w || !h) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = w / 2, cy = h / 2;
    const brainR = Math.min(w, h) * 0.2;
    const N = 70;

    const neurons: Neuron[] = Array.from({ length: N }, () => {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.pow(Math.random(), 0.6) * brainR * 0.9;
      return {
        x: cx + Math.cos(ang) * dist,
        y: cy + Math.sin(ang) * dist,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: 1.2 + Math.random() * 2.8,
        pulse: Math.random() * Math.PI * 2,
        speed: 0.018 + Math.random() * 0.035,
        brightness: 0.5 + Math.random() * 0.5,
      };
    });

    const conns: Conn[] = [];
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = neurons[i].x - neurons[j].x;
        const dy = neurons[i].y - neurons[j].y;
        if (Math.sqrt(dx * dx + dy * dy) < brainR * 0.48) {
          conns.push({ a: i, b: j, signal: 0, signalSpeed: 0.005 + Math.random() * 0.015, active: false });
        }
      }
    }

    let frame = 0;
    let raf: number;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // Deep ambient glow
      const amb = ctx.createRadialGradient(cx, cy, 0, cx, cy, brainR * 1.8);
      amb.addColorStop(0, 'rgba(0,90,180,0.1)');
      amb.addColorStop(0.5, 'rgba(0,40,80,0.05)');
      amb.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = amb;
      ctx.fillRect(0, 0, w, h);

      // Randomly fire signals
      if (frame % 6 === 0 && conns.length) {
        const c = conns[Math.floor(Math.random() * conns.length)];
        if (!c.active) { c.active = true; c.signal = 0; }
      }

      // Draw connections
      for (const c of conns) {
        const na = neurons[c.a], nb = neurons[c.b];
        const dx = nb.x - na.x, dy = nb.y - na.y;

        if (c.active) {
          c.signal += c.signalSpeed;
          if (c.signal >= 1) { c.active = false; c.signal = 0; }

          const sx = na.x + dx * c.signal, sy = na.y + dy * c.signal;

          // Lit axon
          ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y);
          ctx.strokeStyle = 'rgba(0,212,255,0.45)'; ctx.lineWidth = 1.2; ctx.stroke();

          // Signal pulse
          const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 7);
          sg.addColorStop(0, 'rgba(180,240,255,0.95)');
          sg.addColorStop(0.4, 'rgba(0,212,255,0.6)');
          sg.addColorStop(1, 'rgba(0,212,255,0)');
          ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();
        } else {
          const dist = Math.sqrt(dx * dx + dy * dy);
          const op = Math.max(0, 0.14 - dist / (brainR * 7));
          ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y);
          ctx.strokeStyle = `rgba(0,130,210,${op})`; ctx.lineWidth = 0.5; ctx.stroke();
        }
      }

      // Draw neurons
      for (const n of neurons) {
        n.pulse += n.speed;
        const pm = 0.75 + 0.25 * Math.sin(n.pulse);
        const r = n.r * pm;
        const alpha = (0.55 + 0.45 * pm) * n.brightness;

        const ng = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 5);
        ng.addColorStop(0, `rgba(0,212,255,${alpha * 0.9})`);
        ng.addColorStop(0.35, `rgba(0,160,230,${alpha * 0.35})`);
        ng.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(n.x, n.y, r * 5, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = `rgba(200,245,255,${alpha})`;
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();

        // Confine neurons to brain sphere
        n.x += n.vx; n.y += n.vy;
        const ex = n.x - cx, ey = n.y - cy;
        const ed = Math.sqrt(ex * ex + ey * ey);
        if (ed > brainR * 0.92) { n.vx -= (ex / ed) * 0.06; n.vy -= (ey / ed) * 0.06; }
        if (ed < 8) { n.vx += (Math.random() - 0.5) * 0.15; n.vy += (Math.random() - 0.5) * 0.15; }
      }

      // Expanding pulse rings
      const t = frame * 0.01;
      for (let i = 0; i < 4; i++) {
        const phase = ((t + i / 4) % 1);
        const rr = brainR * (1.05 + phase * 0.7);
        const alpha = (1 - phase) * 0.22;
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,212,255,${alpha})`; ctx.lineWidth = 1.5; ctx.stroke();
      }

      // Static boundary ring
      ctx.beginPath(); ctx.arc(cx, cy, brainR * 1.02, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,212,255,0.1)'; ctx.lineWidth = 1; ctx.stroke();

      // Slow rotating arc
      const arcAng = frame * 0.004;
      ctx.beginPath();
      ctx.arc(cx, cy, brainR * 1.1, arcAng, arcAng + Math.PI * 0.6);
      ctx.strokeStyle = 'rgba(0,212,255,0.18)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, brainR * 1.1, arcAng + Math.PI, arcAng + Math.PI * 1.4);
      ctx.strokeStyle = 'rgba(201,168,76,0.15)'; ctx.lineWidth = 1.5; ctx.stroke();

      frame++;
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [w, h]);

  return <canvas ref={ref} width={w} height={h} style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }} />;
}

// ── Module node ───────────────────────────────────────────────────────────────
function ModuleNode({
  mod, cx, cy, innerR, outerR, active, hovered,
  onClick, onHover, onLeave,
}: {
  mod: ModuleDef; cx: number; cy: number; innerR: number; outerR: number;
  active: boolean; hovered: boolean;
  onClick: () => void; onHover: () => void; onLeave: () => void;
}) {
  const r = mod.ring === 'inner' ? innerR : outerR;
  const rad = (mod.angle - 90) * (Math.PI / 180);
  const nx = cx + Math.cos(rad) * r;
  const ny = cy + Math.sin(rad) * r;
  const nodeSize = active ? 54 : hovered ? 50 : 44;
  const { Icon } = mod;

  return (
    <div
      style={{
        position: 'absolute', left: nx, top: ny,
        transform: 'translate(-50%,-50%)',
        zIndex: 20, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      }}
      onClick={onClick} onMouseEnter={onHover} onMouseLeave={onLeave}
    >
      {/* Connection line to brain */}
      <svg style={{ position: 'absolute', overflow: 'visible', pointerEvents: 'none', zIndex: -1 }} width={1} height={1}>
        <line
          x1={0} y1={0} x2={cx - nx} y2={cy - ny}
          stroke={active ? mod.color : hovered ? `rgba(${mod.glow},0.3)` : `rgba(0,212,255,0.07)`}
          strokeWidth={active ? 1.5 : 1}
          strokeDasharray={active ? 'none' : '3 7'}
          style={{ transition: 'stroke 0.3s ease' }}
        />
      </svg>

      {/* Node ring */}
      <motion.div
        animate={{ width: nodeSize, height: nodeSize }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        style={{
          borderRadius: '50%',
          background: active
            ? `radial-gradient(circle, rgba(${mod.glow},0.22) 0%, rgba(${mod.glow},0.06) 100%)`
            : hovered
            ? `rgba(${mod.glow},0.1)`
            : 'rgba(2,14,28,0.85)',
          border: `1.5px solid ${active || hovered ? mod.color : 'rgba(0,212,255,0.18)'}`,
          boxShadow: active
            ? `0 0 22px rgba(${mod.glow},0.5), 0 0 50px rgba(${mod.glow},0.18), inset 0 0 18px rgba(${mod.glow},0.1)`
            : hovered
            ? `0 0 14px rgba(${mod.glow},0.38)`
            : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(12px)',
          transition: 'background 0.25s, border-color 0.25s, box-shadow 0.25s',
        }}
      >
        <Icon className="w-5 h-5" style={{ color: active || hovered ? mod.color : 'rgba(0,212,255,0.55)', transition: 'color 0.25s' }} />
      </motion.div>

      {/* Label */}
      <span style={{
        fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em',
        color: active || hovered ? mod.color : 'rgba(130,190,220,0.55)',
        textTransform: 'uppercase', whiteSpace: 'nowrap',
        textShadow: active ? `0 0 8px rgba(${mod.glow},0.8)` : 'none',
        transition: 'color 0.25s, text-shadow 0.25s',
      }}>
        {mod.label}
      </span>
    </div>
  );
}

// ── Main layout ───────────────────────────────────────────────────────────────
export function CanvasLayout() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [renderedModule, setRenderedModule] = useState<string | null>(null);
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const { data: currentMode } = useGetCurrentMode({ query: { queryKey: ['currentMode'] } });

  useEffect(() => { document.documentElement.classList.add('dark'); }, []);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setSize({ w: containerRef.current.clientWidth, h: containerRef.current.clientHeight });
      }
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
    setShowSettings(false);
  }, []);

  const openSettings = useCallback(() => {
    setRenderedModule('settings');
    setActiveModule(null);
    setPanelOpen(true);
    setShowSettings(true);
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setTimeout(() => { setActiveModule(null); setRenderedModule(null); setShowSettings(false); }, 380);
  }, []);

  const { w, h } = size;
  const cx = w / 2, cy = h / 2;
  const safeH = h - 54 - 80; // account for top bar + command bar
  const safeArea = Math.min(w * 0.9, safeH * 0.88);
  const innerR = safeArea * 0.34;
  const outerR = safeArea * 0.46;

  const activeMod = MODULES.find(m => m.id === activeModule);
  const panelWidth = Math.min(Math.max(w * 0.62, 560), 1100);

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

      {/* Neural brain canvas */}
      {w > 0 && <BrainCanvas w={w} h={h} />}

      {/* NEXUS CORE centre label */}
      {w > 0 && (
        <div style={{
          position: 'absolute', left: cx, top: cy, zIndex: 10,
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 10.5, letterSpacing: '0.28em', color: 'rgba(0,212,255,0.55)', fontWeight: 500 }}>NEXUS CORE</div>
          <div style={{
            fontSize: 20, fontWeight: 800, letterSpacing: '0.12em', color: '#fff', marginTop: 4,
            textShadow: '0 0 24px rgba(0,212,255,0.9), 0 0 60px rgba(0,212,255,0.3)',
          }}>ONLINE</div>
        </div>
      )}

      {/* Orbit ring guides */}
      {w > 0 && (
        <svg style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }} width={w} height={h}>
          <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="rgba(0,212,255,0.055)" strokeWidth={1} strokeDasharray="4 8" />
          <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="rgba(0,212,255,0.035)" strokeWidth={1} strokeDasharray="2 10" />
        </svg>
      )}

      {/* Module nodes */}
      {w > 0 && MODULES.map(mod => (
        <ModuleNode
          key={mod.id} mod={mod} cx={cx} cy={cy} innerR={innerR} outerR={outerR}
          active={activeModule === mod.id} hovered={hoveredModule === mod.id}
          onClick={() => openModule(mod.id)}
          onHover={() => setHoveredModule(mod.id)}
          onLeave={() => setHoveredModule(null)}
        />
      ))}

      {/* ── TOP BAR ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 54, zIndex: 50,
        background: 'rgba(2,8,16,0.82)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0,212,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%', background: '#00d4ff',
            boxShadow: '0 0 8px #00d4ff, 0 0 18px rgba(0,212,255,0.5)',
            animation: 'nexus-pulse 2.4s ease-in-out infinite',
          }} />
          <span style={{ color: '#00d4ff', fontWeight: 800, fontSize: 14, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            NEXUS COMMAND
          </span>
        </div>

        {/* Status pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="nexus-pill nexus-pill-cyan">
            <span className="nexus-dot nexus-dot-cyan" />
            <span>{currentMode?.name?.toUpperCase() || 'WORK MODE'}</span>
          </div>
          <div className="nexus-pill nexus-pill-green">
            <Activity style={{ width: 11, height: 11, color: '#10b981' }} />
            <span>99.9% HEALTH</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="nexus-icon-btn" aria-label="Notifications">
            <Bell style={{ width: 16, height: 16 }} />
            <span style={{
              position: 'absolute', top: 5, right: 5,
              width: 7, height: 7, borderRadius: '50%',
              background: '#ef4444', boxShadow: '0 0 6px #ef4444',
            }} />
          </button>
          <button onClick={openSettings} className={cn('nexus-icon-btn', showSettings && 'nexus-icon-btn-active')}>
            <Settings style={{ width: 16, height: 16 }} />
          </button>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(0,212,255,0.18), rgba(0,212,255,0.08))',
            border: '1px solid rgba(0,212,255,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#00d4ff', fontWeight: 700, fontSize: 11, letterSpacing: '0.05em' }}>EX</span>
          </div>
        </div>
      </div>

      {/* ── COMMAND BAR (bottom) ── */}
      <div style={{
        position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
        width: Math.min(w * 0.5, 640), zIndex: 50,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(3,14,28,0.88)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(0,212,255,0.2)', borderRadius: 40,
          padding: '11px 20px',
          boxShadow: '0 0 30px rgba(0,212,255,0.08), 0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <Command style={{ width: 15, height: 15, color: 'rgba(0,212,255,0.6)', flexShrink: 0 }} />
          <input
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'rgba(200,230,250,0.9)', fontSize: 13, fontFamily: 'inherit',
            }}
            placeholder="Ask Nexus Command anything…  e.g. 'Prepare me for tomorrow'"
          />
          <kbd style={{
            fontSize: 10, color: 'rgba(0,212,255,0.35)', background: 'rgba(0,212,255,0.08)',
            border: '1px solid rgba(0,212,255,0.12)', borderRadius: 6,
            padding: '2px 7px', fontFamily: 'monospace', flexShrink: 0,
          }}>⌘K</kbd>
        </div>
      </div>

      {/* ── SLIDE-IN MODULE PANEL ── */}
      <AnimatePresence>
        {panelOpen && renderedModule && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={closePanel}
              style={{
                position: 'absolute', inset: 0, zIndex: 38,
                background: 'rgba(1,6,14,0.55)', backdropFilter: 'blur(2px)',
              }}
            />

            {/* Panel */}
            <motion.div
              key="panel"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 280, damping: 30, mass: 0.9 }}
              style={{
                position: 'absolute', top: 54, right: 0, bottom: 0,
                width: panelWidth, zIndex: 40,
                background: 'rgba(2,10,22,0.97)', backdropFilter: 'blur(28px)',
                borderLeft: `1px solid ${activeMod ? `rgba(${activeMod.glow},0.25)` : 'rgba(0,212,255,0.15)'}`,
                display: 'flex', flexDirection: 'column',
                boxShadow: activeMod
                  ? `-12px 0 80px rgba(${activeMod.glow},0.07), -4px 0 30px rgba(0,0,0,0.5)`
                  : '-4px 0 40px rgba(0,0,0,0.5)',
              }}
            >
              {/* Panel top bar */}
              <div style={{
                padding: '16px 28px',
                borderBottom: `1px solid ${activeMod ? `rgba(${activeMod.glow},0.15)` : 'rgba(0,212,255,0.08)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {activeMod && (
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: `rgba(${activeMod.glow},0.12)`,
                      border: `1px solid rgba(${activeMod.glow},0.35)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: `0 0 16px rgba(${activeMod.glow},0.3)`,
                    }}>
                      <activeMod.Icon className="w-4 h-4" style={{ color: activeMod.color }} />
                    </div>
                  )}
                  {showSettings && (
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Settings className="w-4 h-4" style={{ color: '#00d4ff' }} />
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 9, letterSpacing: '0.22em', color: 'rgba(0,212,255,0.45)', fontWeight: 500, textTransform: 'uppercase', marginBottom: 2 }}>MODULE</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>
                      {showSettings ? 'Settings' : activeMod?.label}
                    </div>
                  </div>
                </div>
                <button onClick={closePanel} style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(200,220,240,0.7)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s, color 0.2s',
                }}>
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>

              {/* Panel content */}
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '24px 28px' }} className="scrollbar-hide">
                <Suspense fallback={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} style={{ height: 80, borderRadius: 12, background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.06)', animation: 'nexus-shimmer 1.5s ease-in-out infinite' }} />
                    ))}
                  </div>
                }>
                  {PAGE_MAP[renderedModule]}
                </Suspense>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
