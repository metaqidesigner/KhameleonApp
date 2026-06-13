import { useRef, useState, useCallback, ReactNode, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight } from 'lucide-react';

interface PanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  accentGlow?: string;
  accentColor?: string;
  agentBadge?: string;
  maxWidth: number;
  children: ReactNode;
}

export function Panel({
  open, onClose, title, subtitle, icon, accentGlow, accentColor,
  agentBadge, maxWidth, children,
}: PanelProps) {
  const [panelWidth, setPanelWidth] = useState(maxWidth);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartW = useRef(0);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartW.current = panelWidth;
    e.preventDefault();

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartX.current - ev.clientX;
      const next = Math.max(480, Math.min(1100, dragStartW.current + delta));
      setPanelWidth(next);
    };
    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [panelWidth]);

  const borderColor = accentGlow ? `rgba(${accentGlow},0.25)` : 'rgba(0,212,255,0.15)';
  const shadowColor = accentGlow ? `rgba(${accentGlow},0.07)` : 'rgba(0,0,0,0)';

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            style={{
              position: 'absolute', inset: 0, zIndex: 38,
              background: 'rgba(1,6,14,0.55)', backdropFilter: 'blur(2px)',
            }}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 30, mass: 0.9 }}
            style={{
              position: 'absolute', top: 54, right: 0, bottom: 0,
              width: panelWidth, zIndex: 40,
              background: 'rgba(2,10,22,0.97)', backdropFilter: 'blur(28px)',
              borderLeft: `1px solid ${borderColor}`,
              display: 'flex', flexDirection: 'column',
              boxShadow: `-12px 0 80px ${shadowColor}, -4px 0 30px rgba(0,0,0,0.5)`,
            }}
          >
            {/* Drag resize handle */}
            <div
              onMouseDown={onDragStart}
              style={{
                position: 'absolute', top: 0, left: -3, bottom: 0, width: 6,
                cursor: 'ew-resize', zIndex: 10,
                background: 'transparent',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.15)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            />

            {/* Header */}
            <div style={{
              padding: '14px 24px',
              borderBottom: `1px solid ${accentGlow ? `rgba(${accentGlow},0.12)` : 'rgba(0,212,255,0.08)'}`,
              flexShrink: 0,
            }}>
              {/* Breadcrumb */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 9.5, color: 'rgba(0,212,255,0.35)', letterSpacing: '0.18em',
                fontWeight: 500, marginBottom: 10,
              }}>
                <span>NEXUS</span>
                <ChevronRight style={{ width: 10, height: 10 }} />
                <span style={{ color: accentColor ?? '#00d4ff' }}>{title?.toUpperCase() ?? 'MODULE'}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {icon && (
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: accentGlow ? `rgba(${accentGlow},0.12)` : 'rgba(0,212,255,0.1)',
                      border: `1px solid ${accentGlow ? `rgba(${accentGlow},0.35)` : 'rgba(0,212,255,0.3)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: accentGlow ? `0 0 16px rgba(${accentGlow},0.3)` : 'none',
                    }}>
                      {icon}
                    </div>
                  )}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>
                        {title}
                      </div>
                      {agentBadge && (
                        <span style={{
                          fontSize: 9, letterSpacing: '0.16em', fontWeight: 600,
                          padding: '2px 8px', borderRadius: 20,
                          background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)',
                          color: '#a855f7',
                        }}>
                          AGENT: {agentBadge.toUpperCase()}
                        </span>
                      )}
                    </div>
                    {subtitle && (
                      <div style={{ fontSize: 11, color: 'rgba(130,170,200,0.5)', marginTop: 2 }}>
                        {subtitle}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={onClose}
                  style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(200,220,240,0.7)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </div>

            {/* Content with fade-in */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, delay: 0.1 }}
              style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '24px' }}
              className="scrollbar-hide"
            >
              <Suspense fallback={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={{
                      height: 80, borderRadius: 12,
                      background: 'rgba(0,212,255,0.04)',
                      border: '1px solid rgba(0,212,255,0.06)',
                      animation: 'nexus-shimmer 1.5s ease-in-out infinite',
                    }} />
                  ))}
                </div>
              }>
                {children}
              </Suspense>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
