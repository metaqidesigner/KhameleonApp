import './orb.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useJarvisStore } from '@/store/jarvisStore';
import { OrbChatPanel } from './OrbChatPanel';
import { OutputWaveform } from './VoiceWaveform';

const ORB_SIZE = 90;
const ORB_SIZE_MIN = 48;
const PANEL_W = 310;
const PANEL_H = 420;

function getDefaultPos(): { x: number; y: number } {
  return {
    x: window.innerWidth - ORB_SIZE - 44,
    y: window.innerHeight - ORB_SIZE - 40,
  };
}

function clampPos(x: number, y: number, size: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(x, window.innerWidth - size)),
    y: Math.max(0, Math.min(y, window.innerHeight - size)),
  };
}

function calcPanelPos(orbX: number, orbY: number, orbSize: number): { left: number; top: number } {
  let left = orbX - PANEL_W + orbSize;
  let top = orbY - PANEL_H - 10;
  if (left < 4) left = 4;
  if (left + PANEL_W > window.innerWidth - 4) left = window.innerWidth - PANEL_W - 4;
  if (top < 4) top = orbY + orbSize + 10;
  if (top + PANEL_H > window.innerHeight - 4) top = window.innerHeight - PANEL_H - 4;
  return { left, top };
}

interface ContextMenuState {
  x: number;
  y: number;
  subMenu: 'agent' | null;
}

const QUICK_AGENTS = [
  { id: 'claude', label: 'Claude' },
  { id: 'gpt4o', label: 'GPT-4o' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'local', label: 'Local' },
];

function TickSVG({ size }: { size: number }) {
  const centre = size / 2;
  const r = size / 2 - 4;
  const ticks = Array.from({ length: 24 }, (_, i) => {
    const angle = (i * 15 * Math.PI) / 180;
    const major = i % 6 === 0;
    const len = major ? 8 : 4;
    const opacity = major ? 0.6 : 0.25;
    const x1 = centre + Math.cos(angle) * r;
    const y1 = centre + Math.sin(angle) * r;
    const x2 = centre + Math.cos(angle) * (r - len);
    const y2 = centre + Math.sin(angle) * (r - len);
    return { x1, y1, x2, y2, opacity };
  });
  return (
    <svg className="orb-tick-svg" viewBox={`0 0 ${size} ${size}`}>
      {ticks.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke="#00d4ff" strokeWidth="1" opacity={t.opacity} strokeLinecap="round" />
      ))}
    </svg>
  );
}

export function JarvisOrb() {
  const orbStatus          = useJarvisStore(s => s.orbStatus);
  const orbPosition        = useJarvisStore(s => s.orbPosition);
  const setOrbPosition     = useJarvisStore(s => s.setOrbPosition);
  const orbMinimized       = useJarvisStore(s => s.orbMinimized);
  const setOrbMinimized    = useJarvisStore(s => s.setOrbMinimized);
  const orbChatOpen        = useJarvisStore(s => s.orbChatOpen);
  const toggleOrbChat      = useJarvisStore(s => s.toggleOrbChat);
  const setOrbChatOpen     = useJarvisStore(s => s.setOrbChatOpen);
  const setOrbActiveAgentId = useJarvisStore(s => s.setOrbActiveAgentId);
  const toggleVoice        = useJarvisStore(s => s.toggleVoice);
  const setOrbStatus       = useJarvisStore(s => s.setOrbStatus);

  const pos = orbPosition ?? getDefaultPos();
  const orbSize = orbMinimized ? ORB_SIZE_MIN : ORB_SIZE;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const didDragRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dblClickRef = useRef(false);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const panelPos = calcPanelPos(pos.x, pos.y, orbSize);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
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

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('pointerdown', close, true);
    return () => window.removeEventListener('pointerdown', close, true);
  }, [contextMenu]);

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
      const clamped = clampPos(dragRef.current.origX + dx, dragRef.current.origY + dy, orbSize);
      setOrbPosition(clamped);
    }
  }, [orbSize, setOrbPosition]);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    if (!didDragRef.current) {
      // handled in onClick
    }
    didDragRef.current = false;
  }, []);

  const onClick = useCallback(() => {
    if (didDragRef.current) return;
    if (dblClickRef.current) return; // double click handled separately
    // if speaking, cancel it
    if (orbStatus === 'speaking') {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setOrbStatus('online');
      return;
    }
    // if minimized, restore
    if (orbMinimized) {
      setOrbMinimized(false);
      return;
    }
    // left-click no longer opens chat — use right-click instead
  }, [orbStatus, orbMinimized, setOrbMinimized, setOrbStatus]);

  const onDoubleClick = useCallback(() => {
    dblClickRef.current = true;
    setTimeout(() => { dblClickRef.current = false; }, 300);
    // double click = toggle listening (handled by voice in OrbChatPanel)
    // here we just open the chat panel and let it start listening
    if (!orbChatOpen) setOrbChatOpen(true);
    // dispatch a custom event that OrbChatPanel can listen to
    window.dispatchEvent(new CustomEvent('jarvis-orb-toggle-listen'));
  }, [orbChatOpen, setOrbChatOpen]);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); // suppress browser native context menu
    // Right-click opens (or closes) the chat panel
    if (orbMinimized) {
      setOrbMinimized(false);
    }
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
          <div className={`orb-glow ${orbStatus}`} />
          <TickSVG size={orbSize} />
          <div className="orb-ring orb-ring-3" />
          <div className="orb-ring orb-ring-2" />
          <div className="orb-ring orb-ring-1" />
          <div className="orb-core" />
        </div>
        <OutputWaveform visible={orbStatus === 'speaking'} />
      </div>

      {/* Chat panel */}
      {orbChatOpen && !orbMinimized && (
        <OrbChatPanel
          style={{ left: panelPos.left, top: panelPos.top }}
          onClose={() => setOrbChatOpen(false)}
        />
      )}

      {/* Context menu */}
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
            onMouseLeave={() => setContextMenu(m => m ? { ...m, subMenu: null } : m)}
          >
            SWITCH AGENT <span className="arrow">▶</span>
            {contextMenu.subMenu === 'agent' && (
              <div className="orb-context-submenu" style={{ top: 0 }}>
                {QUICK_AGENTS.map(a => (
                  <div key={a.id} className="orb-context-menu-item" onClick={() => { setOrbActiveAgentId(a.id); setContextMenu(null); }}>
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
          <div className="orb-context-menu-item" onClick={() => { setOrbMinimized(true); setOrbChatOpen(false); setContextMenu(null); }}>
            MINIMIZE
          </div>
          <div className="orb-context-menu-item" onClick={() => { setOrbPosition(getDefaultPos()); setContextMenu(null); }}>
            RESET POSITION
          </div>
        </div>
      )}
    </>
  );
}
