import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { getSessionStatus } from "@/lib/sessionApi";
import ChatWindow from "@/components/chatWindow/ChatWindow";
import { KhameleonHead } from "./KhameleonHead";
import { OVERLAY_PALETTES } from "./palettes";
import { useClickThrough } from "./useClickThrough";
import { Toolbars, defaultToolbarGroups } from "./Toolbars";
import { useJarvisStore } from "@/store/jarvisStore";
import { EdgeChrome, BOTTOM_BAR_HEIGHT } from "./EdgeChrome";
import { LookLayoutControls, useSyncAcrossWindows } from "./LookLayoutControls";
import type { OverlayPalette } from "./palettes";
import { SkillsPanel } from "./SkillsPanel";
import { WorkspacePanel } from "./workspace/WorkspacePanel";

/**
 * The Overlay layout (docs/build-review.md, Builds 0-2): rendered inside the
 * desktop app's full-screen, see-through, always-on-top window. Everything
 * not marked `data-overlay-hit` is invisible and lets clicks through.
 *
 * Contents: the head, the real chat (the same ChatWindow Classic uses - one
 * implementation, two layouts), the four edge toolbars, optional top/bottom
 * chrome, and the Look & layout panel. Look choices are saved and shared
 * with Classic's Settings -> Appearance.
 */
/** Room the right-hand toolbars take up, kept clear of the chat window. */
const TOOLBAR_CLEARANCE = 72;

function LookPanel({ palette, onClose }: { palette: OverlayPalette; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      data-overlay-hit
      role="dialog"
      aria-label="Look and layout"
      style={{
        position: "fixed", bottom: 80, right: 84, width: 340, maxHeight: "calc(100vh - 120px)", overflowY: "auto",
        zIndex: 450, padding: 16, borderRadius: 16,
        background: "rgba(8, 14, 28, 0.9)", border: `1px solid ${palette.chatBorder}`,
        backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", boxShadow: palette.glassShadow,
        fontFamily: "var(--j-font-ui)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#d6efee" }}>Look &amp; layout</span>
        <button type="button" className="khi-icon-btn" onClick={onClose} aria-label="Close"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
          <X size={15} color="#8fb4b6" />
        </button>
      </div>
      <LookLayoutControls tone="overlay" />
    </div>
  );
}

export function OverlayLayout({ locked = false }: { locked?: boolean }) {
  useClickThrough();
  useSyncAcrossWindows();
  const prefs = useJarvisStore(s => s.overlayPrefs);
  const [lookOpen, setLookOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  // index.css paints html/body/#root with the dashboard background; the
  // overlay has to be genuinely transparent so the desktop shows through.
  useEffect(() => {
    const els = [document.documentElement, document.body, document.getElementById("root")];
    for (const el of els) if (el) el.style.background = "transparent";
  }, []);

  // When locked, logging in happens in the Classic window (same session
  // cookie); pick that up here without the user having to restart.
  useEffect(() => {
    if (!locked) return;
    const id = window.setInterval(() => {
      getSessionStatus()
        .then(s => { if (s.authenticated) window.location.reload(); })
        .catch(() => {});
    }, 4000);
    return () => window.clearInterval(id);
  }, [locked]);

  const palette = OVERLAY_PALETTES[prefs.palette] ?? OVERLAY_PALETTES["brand-teal"];
  const bare = prefs.iconStyle === "bare";
  const bottomBar = prefs.edgeChrome === "bars" ? BOTTOM_BAR_HEIGHT : 0;
  const setChatOpen = useJarvisStore(s => s.setChatOpen);
  const setChatMinimized = useJarvisStore(s => s.setChatWindowMinimized);
  const requestChatTool = useJarvisStore(s => s.requestChatTool);
  const toolbarGroups = useMemo(() => defaultToolbarGroups({
    askKhameleon: () => { setChatMinimized(false); setChatOpen(true); },
    openTool: requestChatTool,
    openSkills: () => setSkillsOpen(o => !o),
  }), [setChatOpen, setChatMinimized, requestChatTool]);

  return (
    <>
      <style>{`
        .khi-icon-btn svg, .khi-icon-btn img { transition: transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1), filter 160ms ease; }
        .khi-icon-btn:hover svg, .khi-icon-btn:hover img { transform: scale(1.55); filter: brightness(1.45) saturate(1.4); }
        .khi-icon-btn:active svg, .khi-icon-btn:active img { transform: scale(1.3); }
        @media (prefers-reduced-motion: reduce) {
          .khi-icon-btn svg, .khi-icon-btn img { transition: none; }
        }
      `}</style>
      {!locked && (
        // Wrapper only carries the hit marker; ChatWindow positions itself.
        <div data-overlay-hit>
          <ChatWindow bottomInset={64 + bottomBar} rightInset={TOOLBAR_CLEARANCE} showToolsMenu={false} />
        </div>
      )}
      {!locked && <Toolbars palette={palette} groups={toolbarGroups} bare={bare} idleStyle={prefs.idleStyle} />}
      {!locked && <EdgeChrome mode={prefs.edgeChrome} palette={palette} bare={bare} />}
      {skillsOpen && !locked && <SkillsPanel palette={palette} onClose={() => setSkillsOpen(false)} />}
      {workspaceOpen && !locked && <WorkspacePanel palette={palette} onClose={() => setWorkspaceOpen(false)} />}
      {lookOpen && <LookPanel palette={palette} onClose={() => setLookOpen(false)} />}
      <KhameleonHead palette={palette} locked={locked} bottom={18 + bottomBar} onOpenLook={locked ? undefined : () => { setWorkspaceOpen(false); setLookOpen(true); }}
        onOpenWorkspace={locked ? undefined : () => { setLookOpen(false); setWorkspaceOpen(true); }} />
    </>
  );
}
