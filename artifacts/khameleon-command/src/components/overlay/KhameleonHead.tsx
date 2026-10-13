import { useEffect, useRef, useState } from "react";
import { Briefcase, EyeOff, LayoutGrid, LogIn, SlidersHorizontal } from "lucide-react";
import { overlayBridge } from "@/lib/desktopBridge";
import { useJarvisStore } from "@/store/jarvisStore";
import type { OverlayPalette } from "./palettes";

const isMac = navigator.platform.toLowerCase().includes("mac");
const SHORTCUT = isMac ? "⌘⇧K" : "Ctrl+Shift+K";

/**
 * The small head in the bottom-right corner (46px, so it doesn't get in the
 * way of the desktop). Click opens/closes the chat; right-click opens a small
 * menu, which later gains the Workspace panel (Build 3). When logged out,
 * both clicks open the menu, since chat needs a session.
 */
export function KhameleonHead({ palette, locked = false, bottom = 18, onOpenLook, onOpenWorkspace }: {
  palette: OverlayPalette;
  locked?: boolean;
  /** Raised when the bottom bar is showing. */
  bottom?: number;
  onOpenLook?: () => void;
  onOpenWorkspace?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const chatOpen = useJarvisStore(s => s.chatOpen);
  const setChatOpen = useJarvisStore(s => s.setChatOpen);
  const setChatMinimized = useJarvisStore(s => s.setChatWindowMinimized);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const openClassic = () => { setMenuOpen(false); overlayBridge()?.openClassicWindow(); };
  const hide = () => { setMenuOpen(false); overlayBridge()?.hide(); };
  const toggleChat = () => {
    setMenuOpen(false);
    if (chatOpen) setChatOpen(false);
    else { setChatMinimized(false); setChatOpen(true); }
  };
  const active = menuOpen || (!locked && chatOpen);

  const rowStyle: React.CSSProperties = {
    width: "100%", display: "flex", alignItems: "center", gap: 8,
    padding: "8px 9px", borderRadius: 8, background: "none", border: "none",
    cursor: "pointer", fontSize: 12, color: palette.text, textAlign: "left",
    fontFamily: "inherit",
  };
  const hover = {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = palette.accentSoft; },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = "none"; },
  };

  return (
    <div ref={rootRef} data-overlay-hit style={{ position: "fixed", bottom, right: 18, zIndex: 400 }}>
      {menuOpen && (
        <div
          role="menu"
          style={{
            position: "absolute", bottom: 54, right: 0, width: 220,
            background: palette.chatBg, border: `1px solid ${palette.chatBorder}`,
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            borderRadius: 12, boxShadow: palette.glassShadow, padding: 6,
          }}
        >
          <button role="menuitem" style={rowStyle} onClick={openClassic} {...hover}>
            {locked ? <LogIn size={14} color={palette.iconColor} /> : <LayoutGrid size={14} color={palette.iconColor} />}
            {locked ? "Log in to Khameleon" : "Open Classic window"}
          </button>
          {onOpenWorkspace && (
            <button role="menuitem" style={rowStyle} onClick={() => { setMenuOpen(false); onOpenWorkspace(); }} {...hover}>
              <Briefcase size={14} color={palette.iconColor} />
              Workspace
            </button>
          )}
          {onOpenLook && (
            <button role="menuitem" style={rowStyle} onClick={() => { setMenuOpen(false); onOpenLook(); }} {...hover}>
              <SlidersHorizontal size={14} color={palette.iconColor} />
              Look &amp; layout…
            </button>
          )}
          <button role="menuitem" style={rowStyle} onClick={hide} {...hover}>
            <EyeOff size={14} color={palette.iconColor} />
            <span style={{ flex: 1 }}>Hide overlay</span>
            <span style={{ fontSize: 10.5, color: palette.textMuted }}>{SHORTCUT}</span>
          </button>
        </div>
      )}
      <button
        className="khi-icon-btn"
        aria-label={locked ? "Khameleon menu" : chatOpen ? "Close Khameleon chat" : "Open Khameleon chat"}
        aria-expanded={locked ? menuOpen : chatOpen}
        onClick={locked ? () => setMenuOpen(v => !v) : toggleChat}
        onContextMenu={(e) => { e.preventDefault(); setMenuOpen(v => !v); }}
        title={locked ? "Khameleon" : chatOpen ? "Close chat (right-click: more)" : "Open chat (right-click: more)"}
        style={{
          cursor: "pointer", padding: 0,
          width: 46, height: 46, borderRadius: "50%",
          background: palette.glass, border: `1.5px solid ${active ? palette.accent : palette.glassBorder}`,
          backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
          boxShadow: active ? `0 0 0 3px ${palette.accentSoft}, ${palette.glassShadow}` : palette.glassShadow,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "box-shadow 150ms ease, border-color 150ms ease",
          overflow: "hidden",
        }}
      >
        <img src="/khameleon-head.webp" alt="" style={{ width: 30, height: 30, objectFit: "contain" }} />
      </button>
    </div>
  );
}
