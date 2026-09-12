import './orb.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MicOff } from 'lucide-react';
import { useJarvisStore } from '@/store/jarvisStore';
import { OrbChatPanel } from './OrbChatPanel';
import { OutputWaveform } from './VoiceWaveform';
import {
  clampOrbPosition,
  getDefaultOrbPosition,
  getDashboardProtectedRects,
  getOrbAutoAvoidPosition,
  getOrbChatPanelPosition,
  getOrbChatPanelSize,
  ORB_SIZE,
  ORB_SIZE_MIN,
  type LayoutRect,
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
  const setOrbChatOpen      = useJarvisStore(s => s.setOrbChatOpen);
  const setOrbActiveAgentId = useJarvisStore(s => s.setOrbActiveAgentId);
  const toggleVoice         = useJarvisStore(s => s.toggleVoice);
  const setOrbStatus        = useJarvisStore(s => s.setOrbStatus);
  const voiceEnabled        = useJarvisStore(s => s.voiceEnabled);

  const pos     = orbPosition ?? getDefaultPos();
  const orbSize = orbMinimized ? ORB_SIZE_MIN : ORB_SIZE;

  const wrapperRef      = useRef<HTMLDivElement>(null);
  const panelWrapperRef = useRef<HTMLDivElement>(null);
  const coreRef      = useRef<HTMLDivElement>(null);
  const dragRef      = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const didDragRef   = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ampRafRef    = useRef<number>(0);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [dragging, setDragging] = useState(false);

  // The popup's rect is fixed to wherever the orb was when it opened — it
  // does not follow the orb around afterward (the orb is what moves; see
  // the auto-avoid effect below and getOrbAutoAvoidPosition's own comment).
  const [panelPos, setPanelPos] = useState<{ left: number; top: number } | null>(null);

  // ── Popup open/close: anchor the panel, move the orb clear of it,
  //    and animate the orb back to its resting corner on close ──────
  useEffect(() => {
    if (orbChatOpen) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const size = getOrbChatPanelSize(vw, vh);
      const protectedRects = getDashboardProtectedRects(vh);
      const anchoredPos = getOrbChatPanelPosition(
        pos.x, pos.y, orbSize, vw, vh, protectedRects, size.width, size.height,
      );
      setPanelPos(anchoredPos);

      const panelRect: LayoutRect = { left: anchoredPos.left, top: anchoredPos.top, width: size.width, height: size.height };
      setOrbPosition(getOrbAutoAvoidPosition(panelRect, vw, vh, orbSize, protectedRects));
    } else {
      setPanelPos(null);
      setOrbPosition(getDefaultPos());
    }
    // Only the open/close transition itself should trigger this — not
    // every subsequent orb move (dragging, etc.), or the panel would chase
    // the orb around instead of staying put.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orbChatOpen]);

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
        setOrbChatOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [contextMenu, setContextMenu, setOrbStatus, setOrbChatOpen]);

  // ── Close context menu on outside click ───────────────────────
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('pointerdown', close, true);
    return () => window.removeEventListener('pointerdown', close, true);
  }, [contextMenu]);

  // ── Close chat popup on outside click ─────────────────────────
  // The orb itself is excluded — it already has its own right-click/
  // double-click handling for opening and closing the popup.
  useEffect(() => {
    if (!orbChatOpen) return;
    const closeOnOutsideClick = (e: PointerEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (panelWrapperRef.current?.contains(target)) return;
      setOrbChatOpen(false);
    };
    window.addEventListener('pointerdown', closeOnOutsideClick, true);
    return () => window.removeEventListener('pointerdown', closeOnOutsideClick, true);
  }, [orbChatOpen, setOrbChatOpen]);

  // ── Drag ──────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    didDragRef.current = false;
    setDragging(true);
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
    setDragging(false);
  }, []);

  // ── Click — left click: start voice input ────────────────────
  const onClick = useCallback(() => {
    if (didDragRef.current) return;
    if (orbStatus === 'speaking') {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setOrbStatus('online');
      return;
    }
    if (orbMinimized) {
      setOrbMinimized(false);
      return;
    }
    setOrbStatus('listening');
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('jarvis-orb-start-listening')), 0);
  }, [orbStatus, orbMinimized, setOrbMinimized, setOrbStatus]);

  // ── Right-click: open the typed greeting panel ───────────────
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (orbMinimized) setOrbMinimized(false);
    setOrbStatus('online');
    setOrbChatOpen(true);
  }, [orbMinimized, setOrbMinimized, setOrbStatus, setOrbChatOpen]);

  return (
    <>
      <div
        ref={wrapperRef}
        className={`jarvis-orb-wrapper${dragging ? '' : ' orb-animated'}`}
        style={{ left: pos.x, top: pos.y, cursor: didDragRef.current ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onClick}
        onContextMenu={onContextMenu}
      >
        <div className={`jarvis-orb-container ${voiceEnabled || orbStatus !== 'online' ? orbStatus : 'muted'}${orbMinimized ? ' minimized' : ''}`}>
          {/* Ambient bloom behind everything */}
          <div className={`orb-glow ${voiceEnabled || orbStatus !== 'online' ? orbStatus : 'muted'}`} />

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
          <div className="orb-core" ref={coreRef}>
            <div className="orb-dust" />
          </div>
          {!voiceEnabled && orbStatus === 'online' && !orbMinimized && <MicOff size={16} className="orb-muted-icon" />}
        </div>

        <OutputWaveform visible={orbStatus === 'speaking'} />
      </div>

      {/* Chat panel — functionality completely unchanged. Position is fixed
          for as long as it's open (see the open/close effect above) — it
          does not follow the orb around; the orb moves clear of it instead. */}
      {orbChatOpen && !orbMinimized && panelPos && (
        <div ref={panelWrapperRef}>
          <OrbChatPanel
            style={{ left: panelPos.left, top: panelPos.top }}
            onClose={() => setOrbChatOpen(false)}
          />
        </div>
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
