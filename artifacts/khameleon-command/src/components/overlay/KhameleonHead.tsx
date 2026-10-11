import { useEffect, useRef, useState } from "react";
import { EyeOff, LayoutGrid, LogIn } from "lucide-react";
import { overlayBridge } from "@/lib/desktopBridge";
import type { OverlayPalette } from "./palettes";

const isMac = navigator.platform.toLowerCase().includes("mac");
const SHORTCUT = isMac ? "⌘⇧K" : "Ctrl+Shift+K";

/**
 * The small head in the bottom-right corner (46px, so it doesn't get in the
 * way of the desktop). For now both clicks open a small menu; once the chat
 * lands (Build 2 step c) a normal click opens the chat and right-click keeps
 * the menu, which later gains the Workspace panel (Build 3).
 */
export function KhameleonHead({ palette, locked = false }: { palette: OverlayPalette; locked?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
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
    <div ref={rootRef} data-overlay-hit style={{ position: "fixed", bottom: 18, right: 18 }}>
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
          <button role="menuitem" style={rowStyle} onClick={hide} {...hover}>
            <EyeOff size={14} color={palette.iconColor} />
            <span style={{ flex: 1 }}>Hide overlay</span>
            <span style={{ fontSize: 10.5, color: palette.textMuted }}>{SHORTCUT}</span>
          </button>
        </div>
      )}
      <button
        className="khi-icon-btn"
        aria-label="Khameleon menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(v => !v)}
        onContextMenu={(e) => { e.preventDefault(); setMenuOpen(v => !v); }}
        title="Khameleon"
        style={{
          cursor: "pointer", padding: 0,
          width: 46, height: 46, borderRadius: "50%",
          background: palette.glass, border: `1.5px solid ${menuOpen ? palette.accent : palette.glassBorder}`,
          backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
          boxShadow: menuOpen ? `0 0 0 3px ${palette.accentSoft}, ${palette.glassShadow}` : palette.glassShadow,
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
