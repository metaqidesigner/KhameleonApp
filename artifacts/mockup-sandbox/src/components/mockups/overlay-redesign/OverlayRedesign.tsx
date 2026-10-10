import { useState, type CSSProperties, type ReactNode } from "react";
import {
  Crosshair, Table2, ZoomIn,
  PenLine, FileText, AlignLeft,
  Filter, RefreshCw, Sparkles,
  MessageCircle, Search, HelpCircle,
  ChevronLeft, ChevronRight,
  X, Send, Mic, Minus, Sparkle, LayoutGrid,
  Sun, Moon, User, Radio,
} from "lucide-react";

/**
 * Phase 1 sample — ui-overlay-redesign. Standalone, static/fake data only,
 * not wired into the real app. See docs/ui-inventory.md (Phase 0),
 * docs/ui-parity.md (Phase 2), DECISIONS.md / OPEN_QUESTIONS.md.
 *
 * Scope reminder for this pass: no pattern detection, no screen reading,
 * no accessibility-permission code. The "suggestion" slot is a static
 * design placeholder only. True OS-level click-through (letting a click
 * pass through to another real application behind this window) is an
 * Electron-level capability — demonstrated here structurally via
 * pointer-events (everything outside the toolbars/chat/head is
 * pointer-events:none, so clicks fall through to whatever's underneath
 * *in this page*), but can only be fully proven in the real desktop
 * shell once Phase 3 wires it up for real.
 */

// ── Palette (two options — see DECISIONS.md "palette conflict") ───────────

type PaletteId = "soft-blue" | "brand-teal";

interface Palette {
  label: string;
  glass: string;
  glassBorder: string;
  glassShadow: string;
  iconColor: string;
  iconHover: string;
  accent: string;
  accentSoft: string;
  text: string;
  textMuted: string;
  chatBg: string;
  chatBorder: string;
}

const PALETTES: Record<PaletteId, Palette> = {
  "soft-blue": {
    label: "Option A — Soft blue/white (matches the reference image)",
    glass: "rgba(255, 255, 255, 0.46)",
    glassBorder: "rgba(255, 255, 255, 0.65)",
    glassShadow: "0 8px 32px rgba(70, 110, 180, 0.14), 0 1px 2px rgba(70,110,180,0.08)",
    iconColor: "#5b7299",
    iconHover: "#2f5fb0",
    accent: "#4f83e6",
    accentSoft: "rgba(79, 131, 230, 0.12)",
    text: "#1f2b45",
    textMuted: "#6b7a9c",
    chatBg: "rgba(255, 255, 255, 0.72)",
    chatBorder: "rgba(255, 255, 255, 0.8)",
  },
  "brand-teal": {
    label: "Option B — Khameleon's existing teal/dark glass",
    glass: "rgba(10, 18, 36, 0.52)",
    glassBorder: "rgba(111, 230, 189, 0.28)",
    glassShadow: "0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(111,230,189,0.06)",
    iconColor: "#8fb4b6",
    iconHover: "#6FE6BD",
    accent: "#6FE6BD",
    accentSoft: "rgba(111, 230, 189, 0.14)",
    text: "#d6efee",
    textMuted: "#7fa3a6",
    chatBg: "rgba(8, 14, 28, 0.74)",
    chatBorder: "rgba(111, 230, 189, 0.22)",
  },
};

// ── Mock desktop behind the overlay — proves real transparency ────────────

function MockDesktopWindow({ top, left, width, height, title, accent, children }: {
  top: number; left: number; width: number; height: number; title: string; accent: string; children?: ReactNode;
}) {
  return (
    <div style={{
      position: "absolute", top, left, width, height,
      background: "#ffffff", borderRadius: 10, overflow: "hidden",
      boxShadow: "0 24px 60px rgba(20,30,60,0.28), 0 2px 8px rgba(20,30,60,0.12)",
      border: "1px solid rgba(20,30,60,0.06)",
    }}>
      <div style={{ height: 34, background: "#f4f6fa", display: "flex", alignItems: "center", gap: 6, padding: "0 12px", borderBottom: "1px solid rgba(20,30,60,0.06)" }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
        <span style={{ marginLeft: 8, fontSize: 11, color: "#7a8396", fontFamily: "-apple-system,sans-serif" }}>{title}</span>
      </div>
      <div style={{ padding: 16, height: "calc(100% - 34px)", overflow: "hidden" }}>
        {children ?? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ height: 10, width: `${80 - i * 7}%`, borderRadius: 4, background: accent, opacity: 0.15 + (i % 3) * 0.05 }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MockDesktop() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(135deg, #cfe0f5 0%, #e8eef8 45%, #f3e9f2 100%)",
      }} />
      {/* A few ambient shapes so the wallpaper doesn't read as flat */}
      <div style={{ position: "absolute", top: "-10%", right: "-6%", width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle, rgba(140,170,230,0.35), transparent 70%)" }} />
      <div style={{ position: "absolute", bottom: "-15%", left: "-8%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(230,180,210,0.3), transparent 70%)" }} />

      <MockDesktopWindow top={70} left={90} width={560} height={360} title="Quarterly-Report.xlsx" accent="#2f6fd6">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 2 }}>
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} style={{ height: 24, background: i < 5 ? "#eaf0fb" : "#fff", border: "1px solid #eef1f6", fontSize: 9, color: "#9aa5bd", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {i < 5 ? ["Region", "Q1", "Q2", "Q3", "Q4"][i] : i % 7 === 0 ? "" : (120 + i * 7) % 900}
            </div>
          ))}
        </div>
      </MockDesktopWindow>

      <MockDesktopWindow top={130} left={700} width={460} height={300} title="Inbox — client@acme.com" accent="#7a5fd6">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {["Re: contract renewal", "Invoice #4471 overdue", "Meeting notes — Tuesday"].map((s) => (
            <div key={s} style={{ fontSize: 12, color: "#2a3450", paddingBottom: 8, borderBottom: "1px solid #f0f2f8" }}>{s}</div>
          ))}
        </div>
      </MockDesktopWindow>

      <MockDesktopWindow top={430} left={260} width={620} height={280} title="Finder — Projects" accent="#2fa06a">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: 40, height: 32, borderRadius: 4, background: "#cfe0f5" }} />
              <div style={{ width: "80%", height: 6, borderRadius: 3, background: "#e4e8f2" }} />
            </div>
          ))}
        </div>
      </MockDesktopWindow>
    </div>
  );
}

// ── Toolbar pill ────────────────────────────────────────────────────────

interface ToolbarIcon { icon: ReactNode; label: string }

function ToolbarPill({
  title, icons, palette, side, collapsed, onCollapseToggle, chevronEdge, bare,
}: {
  title: string;
  icons: ToolbarIcon[];
  palette: Palette;
  side: "left" | "right";
  collapsed: boolean;
  onCollapseToggle: () => void;
  /** Only render the collapse chevron on one of the two stacked pills (vertical middle of the edge). */
  chevronEdge?: boolean;
  /** Option 5: no pill/oval background at all — bare icon glyphs only, with a drop-shadow for legibility over whatever's underneath. */
  bare?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const dropShadow = "drop-shadow(0 1px 2px rgba(0,0,0,0.45)) drop-shadow(0 1px 6px rgba(0,0,0,0.25))";

  if (collapsed) {
    return (
      <button
        className="khi-icon-btn"
        onClick={onCollapseToggle}
        title="Show toolbars"
        style={{
          pointerEvents: "auto", cursor: "pointer", background: "none", border: "none", padding: 6,
          filter: bare ? dropShadow : undefined,
          ...(bare ? {} : {
            width: 14, height: 54, borderRadius: side === "left" ? "0 8px 8px 0" : "8px 0 0 8px",
            background: palette.glass, border: `1px solid ${palette.glassBorder}`,
            borderLeft: side === "left" ? "none" : `1px solid ${palette.glassBorder}`,
            borderRight: side === "right" ? "none" : `1px solid ${palette.glassBorder}`,
            backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
            boxShadow: palette.glassShadow,
          }),
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {side === "left" ? <ChevronRight size={bare ? 14 : 11} color={bare ? "#fff" : palette.iconColor} /> : <ChevronLeft size={bare ? 14 : 11} color={bare ? "#fff" : palette.iconColor} />}
      </button>
    );
  }

  return (
    <div style={{ position: "relative", pointerEvents: "auto" }}>
      <div
        style={
          bare
            ? { display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "6px 0" }
            : {
                width: 36, padding: "10px 0", borderRadius: 18,
                background: palette.glass, border: `1px solid ${palette.glassBorder}`,
                backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
                boxShadow: palette.glassShadow,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
              }
        }
      >
        {icons.map((it, i) => (
          <button
            key={i}
            className="khi-icon-btn"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            title={it.label}
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center",
              color: bare ? "#fff" : (hovered === i ? palette.iconHover : palette.iconColor),
              filter: bare ? dropShadow : undefined,
              transition: "color 120ms ease",
            }}
          >
            {it.icon}
          </button>
        ))}
      </div>

      {/* Hover tooltip for the toolbar group label + active icon */}
      {hovered !== null && (
        <div
          style={{
            position: "absolute", top: 10 + hovered * 34, [side === "left" ? "left" : "right"]: 46,
            background: "rgba(20,28,48,0.92)", color: "#f0f4fb",
            fontSize: 10.5, padding: "5px 9px", borderRadius: 6, whiteSpace: "nowrap",
            boxShadow: "0 4px 14px rgba(0,0,0,0.25)", pointerEvents: "none",
          } as CSSProperties}
        >
          {icons[hovered].label}
        </div>
      )}

      {chevronEdge && (
        <button
          className="khi-icon-btn"
          onClick={onCollapseToggle}
          title="Hide toolbars"
          style={{
            position: "absolute", top: "50%", [side === "left" ? "right" : "left"]: bare ? -18 : -11, transform: "translateY(-50%)",
            cursor: "pointer", background: bare ? "none" : palette.glass,
            border: bare ? "none" : `1px solid ${palette.glassBorder}`,
            width: 22, height: 22, borderRadius: "50%",
            backdropFilter: bare ? undefined : "blur(10px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: bare ? "none" : palette.glassShadow,
            filter: bare ? dropShadow : undefined,
          } as CSSProperties}
        >
          {side === "left" ? <ChevronLeft size={11} color={bare ? "#fff" : palette.iconColor} /> : <ChevronRight size={11} color={bare ? "#fff" : palette.iconColor} />}
        </button>
      )}
    </div>
  );
}

// ── Suggestion slot (design only — no detection logic in this pass) ──────

function SuggestionSlot({ palette, top = 18 }: { palette: Palette; top?: number }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div
      style={{
        pointerEvents: "auto",
        position: "fixed", top, left: "50%", transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 10px 8px 12px", borderRadius: 12,
        background: palette.glass, border: `1px solid ${palette.glassBorder}`,
        backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
        boxShadow: palette.glassShadow,
        maxWidth: 360,
      }}
    >
      <Sparkle size={13} color={palette.accent} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 11.5, color: palette.text, lineHeight: 1.3 }}>
        This is a design slot only — Khameleon will surface real suggestions here later (e.g. "Extract this table into a sheet?").
      </span>
      <button className="khi-icon-btn" onClick={() => setDismissed(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0 }}>
        <X size={12} color={palette.textMuted} />
      </button>
    </div>
  );
}

// ── Khameleon Head (small, bottom-right, non-intrusive) ───────────────────

function KhameleonHead({ palette, onClick, open }: { palette: Palette; onClick: () => void; open: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div style={{ position: "fixed", bottom: 18, right: 18, pointerEvents: "auto" }}>
      {menuOpen && (
        <div
          onMouseLeave={() => setMenuOpen(false)}
          style={{
            position: "absolute", bottom: 54, right: 0, width: 208,
            background: palette.chatBg, border: `1px solid ${palette.chatBorder}`,
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            borderRadius: 12, boxShadow: palette.glassShadow, padding: 6,
          }}
        >
          <button
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8,
              padding: "8px 9px", borderRadius: 8, background: "none", border: "none",
              cursor: "pointer", fontSize: 11.5, color: palette.text, textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = palette.accentSoft)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <LayoutGrid size={14} color={palette.iconColor} />
            Open full Khameleon
          </button>
          <div style={{ fontSize: 9.5, color: palette.textMuted, padding: "2px 9px 4px" }}>
            Tasks, Calendar, Inbox, Settings, Analytics and everything else that needs real screen space — the existing dashboard, unchanged, one click away.
          </div>
        </div>
      )}
      <button
        className="khi-icon-btn"
        onClick={onClick}
        onContextMenu={(e) => { e.preventDefault(); setMenuOpen((v) => !v); }}
        title={open ? "Hide Khameleon chat (right-click: more)" : "Open Khameleon chat (right-click: more)"}
        style={{
          cursor: "pointer", padding: 0,
          width: 46, height: 46, borderRadius: "50%",
          background: palette.glass, border: `1.5px solid ${open ? palette.accent : palette.glassBorder}`,
          backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
          boxShadow: open ? `0 0 0 3px ${palette.accentSoft}, ${palette.glassShadow}` : palette.glassShadow,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "box-shadow 150ms ease, border-color 150ms ease",
          overflow: "hidden",
        }}
      >
        <img src="/khameleon-head.webp" alt="Khameleon" style={{ width: 30, height: 30, objectFit: "contain" }} />
      </button>
    </div>
  );
}

// ── Chat box (restyled to the new glass language, static/fake data) ───────

function ChatBox({ palette, onClose }: { palette: Palette; onClose: () => void }) {
  const [routeMode, setRouteMode] = useState<"Single" | "Parallel" | "Vote" | "Council">("Single");
  const [reasoningOn, setReasoningOn] = useState(false);
  const messages = [
    { role: "user", text: "Pull the Q3 totals from the spreadsheet behind this window." },
    { role: "assistant", text: "Found it — Q3 total is $482,900 across 5 regions. Want me to drop that into a new doc, or just read out the breakdown?" },
  ];
  return (
    <div
      style={{
        pointerEvents: "auto",
        position: "fixed", bottom: 76, right: 18,
        width: 320, maxHeight: 460, display: "flex", flexDirection: "column",
        borderRadius: 16, overflow: "hidden",
        background: palette.chatBg, border: `1px solid ${palette.chatBorder}`,
        backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)",
        boxShadow: palette.glassShadow,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: `1px solid ${palette.glassBorder}` }}>
        <img src="/khameleon-head.webp" alt="" style={{ width: 18, height: 18, objectFit: "contain", borderRadius: "50%" }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: palette.text, flex: 1 }}>Khameleon</span>
        <button
          className="khi-icon-btn"
          onClick={() => setReasoningOn((v) => !v)}
          title="Show reasoning"
          style={{ background: reasoningOn ? palette.accentSoft : "none", border: "none", borderRadius: 5, cursor: "pointer", padding: "3px 5px" }}
        >
          <Sparkle size={12} color={reasoningOn ? palette.accent : palette.textMuted} />
        </button>
        <button className="khi-icon-btn" style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
          <Minus size={13} color={palette.textMuted} />
        </button>
        <button className="khi-icon-btn" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
          <X size={13} color={palette.textMuted} />
        </button>
      </div>

      {/* Relocated from the old Live Wall top bar's real route-mode picker (the decorative one on the Canvas page did nothing; this is the one that's always been real, on the Chat Window). */}
      <div style={{ display: "flex", gap: 4, padding: "7px 10px", borderBottom: `1px solid ${palette.glassBorder}` }}>
        {(["Single", "Parallel", "Vote", "Council"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setRouteMode(m)}
            style={{
              fontSize: 9.5, padding: "3px 7px", borderRadius: 999, cursor: "pointer",
              border: `1px solid ${m === routeMode ? palette.accent : palette.glassBorder}`,
              background: m === routeMode ? palette.accentSoft : "transparent",
              color: m === routeMode ? palette.accent : palette.textMuted,
            }}
          >
            {m}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {reasoningOn && (
          <div style={{ fontSize: 10, color: palette.textMuted, background: "rgba(120,140,180,0.06)", borderRadius: 8, padding: "6px 9px", fontFamily: "monospace" }}>
            reasoning → read_screen_region(spreadsheet) · sum(Q3 column) · 212ms
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%", padding: "8px 11px", borderRadius: 12,
              background: m.role === "user" ? palette.accentSoft : "rgba(120,140,180,0.08)",
              color: palette.text, fontSize: 12, lineHeight: 1.45,
            }}
          >
            {m.text}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderTop: `1px solid ${palette.glassBorder}` }}>
        <input
          placeholder="Ask Khameleon anything…"
          readOnly
          style={{
            flex: 1, border: "none", outline: "none", background: "transparent",
            fontSize: 12, color: palette.text,
          }}
        />
        <button className="khi-icon-btn" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <Mic size={14} color={palette.textMuted} />
        </button>
        <button className="khi-icon-btn" style={{ background: palette.accent, border: "none", borderRadius: 8, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Send size={12} color="#fff" />
        </button>
      </div>
    </div>
  );
}

// ── Option 3 example: top + bottom chrome (for comparison only — not the ──
// default design; toggled live so it can be compared directly against the
// left/right-only version).

function TopChrome({ palette }: { palette: Palette }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  return (
    <div
      style={{
        pointerEvents: "auto",
        position: "fixed", top: 0, left: 0, right: 0, height: 40,
        display: "flex", alignItems: "center", gap: 16, padding: "0 16px",
        background: palette.glass, borderBottom: `1px solid ${palette.glassBorder}`,
        backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
      }}
    >
      <span style={{ fontSize: 11.5, fontWeight: 600, color: palette.text }}>Khameleon</span>
      <div style={{ width: 1, height: 16, background: palette.glassBorder }} />
      {[
        ["Queries", "128"],
        ["Latency", "340ms"],
        ["Cost", "$0.42"],
        ["Energy", "0.6Wh"],
      ].map(([label, val]) => (
        <span key={label} style={{ fontSize: 10.5, color: palette.textMuted }}>
          {label} <span style={{ color: palette.text, fontWeight: 600 }}>{val}</span>
        </span>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", gap: 6 }}>
        {["All domains", "Finance", "Clients"].map((d, i) => (
          <span
            key={d}
            style={{
              fontSize: 9.5, padding: "3px 8px", borderRadius: 999,
              border: `1px solid ${i === 0 ? palette.accent : palette.glassBorder}`,
              color: i === 0 ? palette.accent : palette.textMuted,
            }}
          >
            {d}
          </span>
        ))}
      </div>
      <button className="khi-icon-btn" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} style={{ background: "none", border: "none", cursor: "pointer", padding: 3 }}>
        {theme === "dark" ? <Moon size={13} color={palette.iconColor} /> : <Sun size={13} color={palette.iconColor} />}
      </button>
      <button className="khi-icon-btn" style={{ background: "none", border: "none", cursor: "pointer", padding: 3 }}>
        <User size={13} color={palette.iconColor} />
      </button>
    </div>
  );
}

function BottomChrome({ palette }: { palette: Palette }) {
  return (
    <div
      style={{
        pointerEvents: "auto",
        position: "fixed", bottom: 0, left: 0, right: 0, height: 28,
        display: "flex", alignItems: "center", gap: 8, padding: "0 16px",
        background: palette.glass, borderTop: `1px solid ${palette.glassBorder}`,
        backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
        overflow: "hidden",
      }}
    >
      <Radio size={11} color={palette.accent} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 10, color: palette.textMuted, whiteSpace: "nowrap" }}>
        Khameleon feed — Drafted a reply to client@acme.com /// Classified 6 unread messages /// Q3 totals extracted to Quarterly-Report.xlsx
      </span>
    </div>
  );
}

// ── Option 4: same content as Options 3's top/bottom bars, but as separate
// floating icon pills (matching the left/right toolbars' own visual
// language) instead of one continuous strip — "just the icons," no bar
// background connecting them.

const BARE_DROP_SHADOW = "drop-shadow(0 1px 2px rgba(0,0,0,0.45)) drop-shadow(0 1px 6px rgba(0,0,0,0.25))";

function IconPill({ palette, children, style, bare }: { palette: Palette; children: ReactNode; style?: CSSProperties; bare?: boolean }) {
  return (
    <div
      style={
        bare
          ? { pointerEvents: "auto", display: "flex", alignItems: "center", gap: 14, filter: BARE_DROP_SHADOW }
          : {
              pointerEvents: "auto",
              display: "flex", alignItems: "center", gap: 10,
              padding: "7px 12px", borderRadius: 999,
              background: palette.glass, border: `1px solid ${palette.glassBorder}`,
              backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
              boxShadow: palette.glassShadow,
              ...style,
            }
      }
    >
      {children}
    </div>
  );
}

function StatIcon({ palette, icon, label, value, bare }: { palette: Palette; icon: ReactNode; label: string; value: string; bare?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="khi-icon-btn"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: "relative", display: "flex", alignItems: "center", color: bare ? "#fff" : palette.iconColor }}
    >
      {icon}
      {hover && (
        <div style={{ position: "absolute", top: "130%", left: "50%", transform: "translateX(-50%)", background: "rgba(20,28,48,0.92)", color: "#f0f4fb", fontSize: 10, padding: "4px 8px", borderRadius: 6, whiteSpace: "nowrap", pointerEvents: "none" }}>
          {label}: {value}
        </div>
      )}
    </div>
  );
}

function TopIcons({ palette, bare }: { palette: Palette; bare?: boolean }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const iconColor = bare ? "#fff" : palette.iconColor;
  return (
    <div style={{ position: "fixed", top: 14, left: 14, right: 14, display: "flex", alignItems: "center", pointerEvents: "none" }}>
      <IconPill palette={palette} bare={bare}>
        <img src="/khameleon-head.webp" alt="" style={{ width: 14, height: 14, objectFit: "contain" }} />
      </IconPill>

      <div style={{ width: 10 }} />

      <IconPill palette={palette} bare={bare}>
        <StatIcon palette={palette} bare={bare} icon={<Search size={13} strokeWidth={1.5} />} label="Queries" value="128" />
        <StatIcon palette={palette} bare={bare} icon={<RefreshCw size={13} strokeWidth={1.5} />} label="Latency" value="340ms" />
        <StatIcon palette={palette} bare={bare} icon={<Sparkles size={13} strokeWidth={1.5} />} label="Cost" value="$0.42" />
      </IconPill>

      <div style={{ flex: 1 }} />

      <div style={{ position: "relative" }}>
        <IconPill palette={palette} bare={bare}>
          <button className="khi-icon-btn" onClick={() => setFiltersOpen((v) => !v)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: iconColor }}>
            <Filter size={13} strokeWidth={1.5} />
          </button>
        </IconPill>
        {filtersOpen && (
          <div style={{ position: "absolute", top: "130%", right: 0, display: "flex", gap: 4, pointerEvents: "auto" }}>
            {["All", "Finance", "Clients"].map((d, i) => (
              <span key={d} style={{ fontSize: 9, padding: "4px 8px", borderRadius: 999, background: palette.glass, border: `1px solid ${i === 0 ? palette.accent : palette.glassBorder}`, color: i === 0 ? palette.accent : palette.textMuted, backdropFilter: "blur(12px)" }}>
                {d}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ width: 10 }} />

      <IconPill palette={palette} bare={bare}>
        <button className="khi-icon-btn" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: iconColor }}>
          {theme === "dark" ? <Moon size={13} strokeWidth={1.5} /> : <Sun size={13} strokeWidth={1.5} />}
        </button>
        <button className="khi-icon-btn" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: iconColor }}>
          <User size={13} strokeWidth={1.5} />
        </button>
      </IconPill>
    </div>
  );
}

function BottomIcons({ palette, bare }: { palette: Palette; bare?: boolean }) {
  const [open, setOpen] = useState(false);
  const iconColor = bare ? "#fff" : palette.iconColor;
  return (
    <div style={{ position: "fixed", bottom: 14, left: 14, pointerEvents: "none" }}>
      {open && (
        <div style={{ pointerEvents: "auto", marginBottom: 8 }}>
          <IconPill palette={palette} bare={bare} style={{ borderRadius: 10 }}>
            <span style={{ fontSize: 10, color: bare ? "#fff" : palette.textMuted, whiteSpace: "nowrap" }}>
              Drafted a reply to client@acme.com /// Classified 6 unread messages
            </span>
          </IconPill>
        </div>
      )}
      <IconPill palette={palette} bare={bare}>
        <button className="khi-icon-btn" onClick={() => setOpen((v) => !v)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: open ? palette.accent : iconColor }}>
          <Radio size={13} strokeWidth={1.5} />
        </button>
      </IconPill>
    </div>
  );
}

// ── Main sample ─────────────────────────────────────────────────────────

export default function OverlayRedesign() {
  const [paletteId, setPaletteId] = useState<PaletteId>("soft-blue");
  const [chromeMode, setChromeMode] = useState<"minimal" | "full" | "icons">("minimal");
  const [bareIcons, setBareIcons] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const palette = PALETTES[paletteId];

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Every interactive icon in this sample gets the same "comes alive" hover
          micro-interaction: a slight scale-up with a touch of overshoot, not a
          flat linear ease, so it reads as responsive rather than mechanical.
          Targets the icon's own <svg> on hover of its wrapping button, not the
          button itself - several buttons (e.g. the edge collapse chevrons)
          already use `transform` for positioning, and animating that same
          property on the same element would fight the positioning transform. */}
      <style>{`
        .khi-icon-btn svg, .khi-icon-btn img { transition: transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1), filter 160ms ease; }
        .khi-icon-btn:hover svg, .khi-icon-btn:hover img { transform: scale(1.55); filter: brightness(1.45) saturate(1.4); }
        .khi-icon-btn:active svg, .khi-icon-btn:active img { transform: scale(1.3); }
      `}</style>
      <MockDesktop />

      {/* Glass overlay layer: pointer-events none everywhere except the real controls, so the mock desktop beneath is genuinely clickable through the gaps. */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 10 }}>
        {chromeMode === "full" && <TopChrome palette={palette} />}
        {chromeMode === "full" && <BottomChrome palette={palette} />}
        {chromeMode === "icons" && <TopIcons palette={palette} bare={bareIcons} />}
        {chromeMode === "icons" && <BottomIcons palette={palette} bare={bareIcons} />}
        <SuggestionSlot palette={palette} top={chromeMode === "full" ? 52 : chromeMode === "icons" ? 56 : 18} />

        {/* Left edge, stacked */}
        <div style={{ position: "fixed", left: 14, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 14, pointerEvents: "none" }}>
          <ToolbarPill
            title="Capture & Extract"
            palette={palette}
            bare={bareIcons}
            side="left"
            collapsed={leftCollapsed}
            onCollapseToggle={() => setLeftCollapsed((v) => !v)}
            chevronEdge={!leftCollapsed}
            icons={[
              { icon: <Crosshair size={15} strokeWidth={1.5} />, label: "Extract data" },
              { icon: <Table2 size={15} strokeWidth={1.5} />, label: "To spreadsheet" },
              { icon: <ZoomIn size={15} strokeWidth={1.5} />, label: "Inspect region" },
            ]}
          />
          {!leftCollapsed && (
            <ToolbarPill
              title="Create & Draft"
              palette={palette}
              bare={bareIcons}
              side="left"
              collapsed={false}
              onCollapseToggle={() => setLeftCollapsed(true)}
              icons={[
                { icon: <PenLine size={15} strokeWidth={1.5} />, label: "Draft reply" },
                { icon: <FileText size={15} strokeWidth={1.5} />, label: "New document" },
                { icon: <AlignLeft size={15} strokeWidth={1.5} />, label: "Summarize to text" },
              ]}
            />
          )}
        </div>

        {/* Right edge, stacked */}
        <div style={{ position: "fixed", right: 14, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 14, pointerEvents: "none" }}>
          <ToolbarPill
            title="Transform & Clean"
            palette={palette}
            bare={bareIcons}
            side="right"
            collapsed={rightCollapsed}
            onCollapseToggle={() => setRightCollapsed((v) => !v)}
            chevronEdge={!rightCollapsed}
            icons={[
              { icon: <Filter size={15} strokeWidth={1.5} />, label: "Clean up data" },
              { icon: <RefreshCw size={15} strokeWidth={1.5} />, label: "Reformat" },
              { icon: <Sparkles size={15} strokeWidth={1.5} />, label: "Polish / tidy" },
            ]}
          />
          {!rightCollapsed && (
            <ToolbarPill
              title="Ask & Find"
              palette={palette}
              bare={bareIcons}
              side="right"
              collapsed={false}
              onCollapseToggle={() => setRightCollapsed(true)}
              icons={[
                { icon: <MessageCircle size={15} strokeWidth={1.5} />, label: "Ask Khameleon" },
                { icon: <Search size={15} strokeWidth={1.5} />, label: "Find on screen" },
                { icon: <HelpCircle size={15} strokeWidth={1.5} />, label: "What is this?" },
              ]}
            />
          )}
        </div>

        {chatOpen && <ChatBox palette={palette} onClose={() => setChatOpen(false)} />}
        <KhameleonHead palette={palette} open={chatOpen} onClick={() => setChatOpen((v) => !v)} />
      </div>

      {/* Sample-only controls, not part of the real design — let you compare options live. Positioned bottom-left so they never collide with the top/bottom chrome variant. */}
      <div style={{ position: "fixed", bottom: 14, left: 14, zIndex: 20, display: "flex", flexDirection: "column", gap: 6, background: "rgba(10,14,24,0.85)", padding: 6, borderRadius: 10, backdropFilter: "blur(8px)" }}>
      <div style={{ display: "flex", gap: 6 }}>
        {(Object.keys(PALETTES) as PaletteId[]).map((id) => (
          <button
            key={id}
            onClick={() => setPaletteId(id)}
            style={{
              fontSize: 10, padding: "6px 10px", borderRadius: 7, cursor: "pointer",
              border: `1px solid ${id === paletteId ? "#fff" : "rgba(255,255,255,0.2)"}`,
              background: id === paletteId ? "rgba(255,255,255,0.18)" : "transparent",
              color: "#fff", fontFamily: "monospace",
            }}
          >
            {id === "soft-blue" ? "A · Soft blue" : "B · Brand teal"}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {(["minimal", "full", "icons"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setChromeMode(m)}
            style={{
              fontSize: 10, padding: "6px 10px", borderRadius: 7, cursor: "pointer",
              border: `1px solid ${m === chromeMode ? "#fff" : "rgba(255,255,255,0.2)"}`,
              background: m === chromeMode ? "rgba(255,255,255,0.18)" : "transparent",
              color: "#fff", fontFamily: "monospace",
            }}
          >
            {m === "minimal" ? "Left/right only" : m === "full" ? "+ Top/bottom bar (Opt. 3)" : "+ Top/bottom icons (Opt. 4)"}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={() => setBareIcons((v) => !v)}
          style={{
            fontSize: 10, padding: "6px 10px", borderRadius: 7, cursor: "pointer",
            border: `1px solid ${bareIcons ? "#fff" : "rgba(255,255,255,0.2)"}`,
            background: bareIcons ? "rgba(255,255,255,0.18)" : "transparent",
            color: "#fff", fontFamily: "monospace",
          }}
        >
          {bareIcons ? "Bare icons ON (Opt. 5, no oval at all)" : "Bare icons OFF (pill backgrounds)"}
        </button>
      </div>
      </div>
    </div>
  );
}
