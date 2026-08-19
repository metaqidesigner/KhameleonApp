import { useEffect, useState } from 'react';

interface Props {
  onGranted: () => void;
  onSkipped: () => void;
}

export function MicPermissionModal({ onGranted, onSkipped }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.3s',
    }}>
      <div style={{
        position: 'relative',
        width: 360,
        padding: '24px',
        background: 'rgba(2,10,22,0.97)',
        border: '1px solid rgba(0,212,255,0.35)',
        boxShadow: '0 0 40px rgba(0,212,255,0.12), inset 0 0 60px rgba(0,212,255,0.03)',
      }}>
        {/* Corner brackets */}
        <span style={{
          position: 'absolute', top: -1, left: -1,
          width: 12, height: 12,
          borderTop: '2px solid rgba(0,212,255,0.8)',
          borderLeft: '2px solid rgba(0,212,255,0.8)',
        }} />
        <span style={{
          position: 'absolute', top: -1, right: -1,
          width: 12, height: 12,
          borderTop: '2px solid rgba(0,212,255,0.8)',
          borderRight: '2px solid rgba(0,212,255,0.8)',
        }} />
        <span style={{
          position: 'absolute', bottom: -1, left: -1,
          width: 12, height: 12,
          borderBottom: '2px solid rgba(0,212,255,0.8)',
          borderLeft: '2px solid rgba(0,212,255,0.8)',
        }} />
        <span style={{
          position: 'absolute', bottom: -1, right: -1,
          width: 12, height: 12,
          borderBottom: '2px solid rgba(0,212,255,0.8)',
          borderRight: '2px solid rgba(0,212,255,0.8)',
        }} />

        {/* Red header bar */}
        <div style={{
          background: 'linear-gradient(90deg, rgba(192,21,42,0.9) 0%, rgba(192,21,42,0.5) 100%)',
          margin: '-24px -24px 16px -24px',
          padding: '8px 14px',
          fontFamily: 'var(--j-font-mono)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.18em',
          color: '#fff',
        }}>
          MICROPHONE ACCESS REQUIRED
        </div>

        {/* Icon */}
        <div style={{
          textAlign: 'center', marginBottom: 14,
          fontSize: 32,
          filter: 'drop-shadow(0 0 8px rgba(0,212,255,0.5))',
        }}>🎤</div>

        {/* Body text */}
        <p style={{
          fontFamily: 'var(--j-font-ui)',
          fontSize: 13,
          color: '#b8d4e8',
          lineHeight: 1.6,
          textAlign: 'center',
          margin: '0 0 20px 0',
        }}>
          KHAMELEON requires microphone access to enable
          wake word detection and voice commands.<br />
          Say <span style={{ color: '#00d4ff', fontWeight: 600 }}>"Hello Khameleon"</span> at any time to activate.
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onGranted}
            style={{
              flex: 1,
              padding: '10px 0',
              background: 'linear-gradient(135deg, rgba(192,21,42,0.8) 0%, rgba(160,10,30,0.8) 100%)',
              border: '1px solid rgba(192,21,42,0.6)',
              color: '#fff',
              fontFamily: 'var(--j-font-mono)',
              fontSize: 10,
              letterSpacing: '0.15em',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={e => (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(220,30,55,0.9) 0%, rgba(192,21,42,0.9) 100%)')}
            onMouseOut={e => (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(192,21,42,0.8) 0%, rgba(160,10,30,0.8) 100%)')}
          >
            ▶ GRANT ACCESS
          </button>
          <button
            onClick={onSkipped}
            style={{
              flex: 1,
              padding: '10px 0',
              background: 'transparent',
              border: '1px solid rgba(0,212,255,0.2)',
              color: 'rgba(0,212,255,0.5)',
              fontFamily: 'var(--j-font-mono)',
              fontSize: 10,
              letterSpacing: '0.15em',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(0,212,255,0.5)'; e.currentTarget.style.color = 'rgba(0,212,255,0.8)'; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(0,212,255,0.2)'; e.currentTarget.style.color = 'rgba(0,212,255,0.5)'; }}
          >
            SKIP
          </button>
        </div>

        <p style={{
          fontFamily: 'var(--j-font-mono)',
          fontSize: 9,
          color: 'rgba(184,212,232,0.35)',
          textAlign: 'center',
          margin: '12px 0 0 0',
          letterSpacing: '0.06em',
        }}>
          Wake word requires Chrome or Edge. Enable later in Settings › Voice.
        </p>
      </div>
    </div>
  );
}
