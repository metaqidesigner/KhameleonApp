import './orb.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useJarvisStore } from '@/store/jarvisStore';
import { OrbChatPanel } from './OrbChatPanel';
import { OutputWaveform } from './VoiceWaveform';
import {
  clampOrbPosition,
  getDefaultOrbPosition,
  getDashboardProtectedRects,
  getOrbChatPanelPosition,
  getOrbChatPanelSize,
  ORB_SIZE,
  ORB_SIZE_MIN,
} from '@/lib/orbLayout';

function getDefaultPos(): { x: number; y: number } {
  return getDefaultOrbPosition(window.innerWidth, window.innerHeight);
}

interface ContextMenuState { x: number; y: number; subMenu: 'agent' | null; }

const QUICK_AGENTS = [
  { id: 'claude', label: 'Claude'  },
  { id: 'gpt4o',  label: 'GPT-4o'  },
  { id: 'gemini', label: 'Gemini'  },
  { id: 'local',  label: 'Local'   },
];

export function JarvisOrb() {
  const orbStatus           = useJarvisStore(s => s.orbStatus);
  const orbPosition         = useJarvisStore(s => s.orbPosition);
  const setOrbPosition      = useJarvisStore(s => s.setOrbPosition);
  const orbMinimized        = useJarvisStore(s => s.orbMinimized);
  const setOrbMinimized     = useJarvisStore(s => s.setOrbMinimized);
  const orbChatOpen         = useJarvisStore(s => s.orbChatOpen);
  const toggleOrbChat       = useJarvisStore(s => s.toggleOrbChat);
  const setOrbChatOpen      = useJarvisStore(s => s.setOrbChatOpen);
  const setOrbActiveAgentId = useJarvisStore(s => s.setOrbActiveAgentId);
  const toggleVoice         = useJarvisStore(s => s.toggleVoice);
  const setOrbStatus        = useJarvisStore(s => s.setOrbStatus);

  const pos     = orbPosition ?? getDefaultPos();
  const orbSize = orbMinimized ? ORB_SIZE_MIN : ORB_SIZE;

  const wrapperRef   = useRef<HTMLDivElement>(null);
  const coreRef      = useRef<HTMLDivElement>(null);
  const dragRef      = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const didDragRef   = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dblClickRef  = useRef(false);
  const ampRafRef    = useRef<number>(0);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  const panelSize = getOrbChatPanelSize(viewport.width, viewport.height);
  const panelPos = getOrbChatPanelPosition(
    pos.x,
    pos.y,
    orbSize,
    viewport.width,
    viewport.height,
    getDashboardProtectedRects(viewport.height),
    panelSize.width,
    panelSize.height,
  );

  useEffect(() => {
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  // A saved position can outlive a viewport resize. Normalize it before the
  // next interaction so the orb never starts on top of the focus card.
  useEffect(() => {
    if (!orbPosition) return;
    const normalizePosition = () => {
      const safePosition = clampOrbPosition(
        orbPosition.x,
        orbPosition.y,
        window.innerWidth,
        window.innerHeight,
        orbSize,
      );
      if (safePosition.x !== orbPosition.x || safePosition.y !== orbPosition.y) {
        setOrbPosition(safePosition);
      }
    };

    normalizePosition();
    window.addEventListener('resize', normalizePosition);
    return () => window.removeEventListener('resize', normalizePosition);
  }, [orbPosition, orbSize, setOrbPosition]);

  // ── Speaking amplitude pulse ──────────────────────────────────
  // Overlapping sine waves simulate organic TTS amplitude so the core
  // visibly breathes in sync with speech louder/quieter moments.
  useEffect(() => {
    cancelAnimationFrame(ampRafRef.current);
    if (orbStatus !== 'speaking') {
      if (coreRef.current) {
        coreRef.current.style.transform = 'translate(-50%, -50%) scale(1)';
      }
      return;
    }
    const animate = () => {
      if (coreRef.current) {
        const t   = Date.now() / 1000;
        const amp =
          0.45 * Math.abs(Math.sin(t * 3.1))      +
          0.30 * Math.abs(Math.sin(t * 5.7 + 1.2)) +
          0.25 * Math.abs(Math.sin(t * 2.1 + 0.7));
        const scale = 1 + amp * 0.14; // breathes between 1.0 and ~1.14
        coreRef.current.style.transform = `translate(-50%, -50%) scale(${scale})`;
      }
      ampRafRef.current = requestAnimationFrame(animate);
    };
    ampRafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(ampRafRef.current);
  }, [orbStatus]);

  // ── Keyboard shortcuts ────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' ||
          (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        if (contextMenu) { setContextMenu(null); return; }
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        setOrbStatus('online');
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        toggleOrbChat();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [contextMenu, setContextMenu, setOrbStatus, toggleOrbChat]);

  // ── Close context menu on outside click ───────────────────────
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('pointerdown', close, true);
    return () => window.removeEventListener('pointerdown', close, true);
  }, [contextMenu]);

  // ── Drag ──────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    didDragRef.current = false;
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      didDragRef.current = true;
      if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
      const clamped = clampOrbPosition(
        dragRef.current.origX + dx,
        dragRef.current.origY + dy,
        window.innerWidth,
        window.innerHeight,
        orbSize,
      );
      setOrbPosition(clamped);
    }
  }, [orbSize, setOrbPosition]);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    didDragRef.current = false;
  }, []);

  // ── Click — left click: cancel speech / restore only ─────────
  const onClick = useCallback(() => {
    if (didDragRef.current) return;
    if (dblClickRef.current) return;
    if (orbStatus === 'speaking') {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setOrbStatus('online');
      return;
    }
    if (orbMinimized) {
      setOrbMinimized(false);
      return;
    }
    // left-click does not open chat — use right-click
  }, [orbStatus, orbMinimized, setOrbMinimized, setOrbStatus]);

  // ── Double-click: open chat + start listening ─────────────────
  const onDoubleClick = useCallback(() => {
    dblClickRef.current = true;
    setTimeout(() => { dblClickRef.current = false; }, 300);
    if (!orbChatOpen) setOrbChatOpen(true);
    window.dispatchEvent(new CustomEvent('jarvis-orb-toggle-listen'));
  }, [orbChatOpen, setOrbChatOpen]);

  // ── Right-click: open / close chat panel ─────────────────────
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (orbMinimized) setOrbMinimized(false);
    toggleOrbChat();
  }, [orbMinimized, setOrbMinimized, toggleOrbChat]);

  return (
    <>
      <div
        ref={wrapperRef}
        className="jarvis-orb-wrapper"
        style={{ left: pos.x, top: pos.y, cursor: didDragRef.current ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
      >
        <div className={`jarvis-orb-container ${orbStatus}${orbMinimized ? ' minimized' : ''}`}>
          {/* Ambient bloom behind everything */}
          <div className={`orb-glow ${orbStatus}`} />

          {/* Layer 1 — outer decorative partial arcs (slow, counter-rotating) */}
          <div className="orb-arc orb-arc-1" />
          <div className="orb-arc orb-arc-2" />

          {/* Layer 2 — inner functional rings */}
          {/* Outer ring: carries an orbiting "moon" dot */}
          <div className="orb-ring orb-ring-outer">
            <div className="orb-moon" />
          </div>
          {/* Inner ring: has a fixed bright beacon that sweeps around */}
          <div className="orb-ring orb-ring-inner">
            <div className="orb-beacon" />
          </div>

          {/* Layer 3 — core sphere with nebula texture */}
          <div className="orb-core" ref={coreRef} />
        </div>

        <OutputWaveform visible={orbStatus === 'speaking'} />
      </div>

      {/* Chat panel — functionality completely unchanged */}
      {orbChatOpen && !orbMinimized && (
        <OrbChatPanel
          style={{ left: panelPos.left, top: panelPos.top }}
          onClose={() => setOrbChatOpen(false)}
        />
      )}

      {/* Context menu (still wired, accessible via code) */}
      {contextMenu && (
        <div
          className="orb-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={e => e.stopPropagation()}
        >
          <div
            className="orb-context-menu-item"
            style={{ position: 'relative' }}
            onMouseEnter={() => setContextMenu(m => m ? { ...m, subMenu: 'agent' } : m)}
            onMouseLeave={() => setContextMenu(m => m ? { ...m, subMenu: null  } : m)}
          >
            SWITCH AGENT <span className="arrow">▶</span>
            {contextMenu.subMenu === 'agent' && (
              <div className="orb-context-submenu" style={{ top: 0 }}>
                {QUICK_AGENTS.map(a => (
                  <div key={a.id} className="orb-context-menu-item"
                    onClick={() => { setOrbActiveAgentId(a.id); setContextMenu(null); }}>
                    {a.label}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="orb-context-menu-item" onClick={() => { toggleVoice(); setContextMenu(null); }}>
            VOICE MODE
          </div>
          <div className="orb-context-menu-divider" />
          <div className="orb-context-menu-item"
            onClick={() => { setOrbMinimized(true); setOrbChatOpen(false); setContextMenu(null); }}>
            MINIMIZE
          </div>
          <div className="orb-context-menu-item"
            onClick={() => { setOrbPosition(getDefaultPos()); setContextMenu(null); }}>
            RESET POSITION
          </div>
        </div>
      )}
    </>
  );
}
