import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { getSessionStatus } from "@/lib/sessionApi";
import ChatWindow from "@/components/chatWindow/ChatWindow";
import { KhameleonHead } from "./KhameleonHead";
import { OVERLAY_PALETTES } from "./palettes";
import { useClickThrough } from "./useClickThrough";
import { Toolbars, defaultToolbarGroups } from "./Toolbars";
import { useKhameleonStore } from "@/store/khameleonStore";
import { EdgeChrome, BOTTOM_BAR_HEIGHT } from "./EdgeChrome";
import { LookLayoutControls, useSyncAcrossWindows } from "./LookLayoutControls";
import type { OverlayPalette } from "./palettes";
import { SkillsPanel } from "./SkillsPanel";
import { pairDesktopLink } from "@/lib/desktopBridge";
import { SettingsPanel } from "./SettingsPanel";
import { OverlayTips, TIPS_DONE_KEY } from "./OverlayTips";
import { KhamiProgress } from "./KhamiProgress";
import { FirstRunSetup } from "@/components/setup/FirstRunSetup";
import { EmailAssistant } from "./EmailAssistant";
import { SuggestionSlot } from "@/components/notices/SuggestionSlot";
import { LoginRequests } from "@/components/notices/LoginRequests";
import { DetectionBadge } from "@/components/notices/DetectionBadge";
import { CaptureBar, useCaptureTask, type CaptureDraft } from "@/components/skills/CaptureTask";
import { WorkspacePanel } from "./workspace/WorkspacePanel";
import { KhamiSetup } from "@/components/khami/KhamiSetup";
import { AboutLicences } from "@/components/about/AboutLicences";
import { GetIntegrations } from "@/components/integrations/GetIntegrations";
import { KHAMI_HOME } from '@/lib/where';


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

function IntegrationsPanel({ palette, onClose }: { palette: OverlayPalette; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div data-overlay-hit role="dialog" aria-label="Integrations"
      style={{
        position: "fixed", bottom: 80, right: 84, width: 420, maxHeight: "calc(100vh - 120px)", overflowY: "auto",
        zIndex: 450, padding: 16, borderRadius: 16,
        background: "rgba(8, 14, 28, 0.9)", border: `1px solid ${palette.chatBorder}`,
        backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", boxShadow: palette.glassShadow,
        fontFamily: "var(--j-font-ui)",
      }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#d6efee" }}>Integrations</span>
        <button type="button" className="khi-icon-btn" onClick={onClose} aria-label="Close"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
          <X size={15} color="#8fb4b6" />
        </button>
      </div>
      <GetIntegrations tone="overlay" />
    </div>
  );
}

function AboutPanel({ palette, onClose }: { palette: OverlayPalette; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div data-overlay-hit role="dialog" aria-label="About Khameleon"
      style={{
        position: "fixed", bottom: 80, right: 84, width: 400, maxHeight: "calc(100vh - 120px)", overflowY: "auto",
        zIndex: 450, padding: 16, borderRadius: 16,
        background: "rgba(8, 14, 28, 0.9)", border: `1px solid ${palette.chatBorder}`,
        backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", boxShadow: palette.glassShadow,
        fontFamily: "var(--j-font-ui)",
      }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#d6efee" }}>About Khameleon · Licences</span>
        <button type="button" className="khi-icon-btn" onClick={onClose} aria-label="Close"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
          <X size={15} color="#8fb4b6" />
        </button>
      </div>
      <AboutLicences tone="overlay" />
    </div>
  );
}

function KhamiPanel({ palette, onClose }: { palette: OverlayPalette; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div data-overlay-hit role="dialog" aria-label="Khami setup"
      style={{
        position: "fixed", bottom: 80, right: 84, width: 380, maxHeight: "calc(100vh - 120px)", overflowY: "auto",
        zIndex: 450, padding: 16, borderRadius: 16,
        background: "rgba(8, 14, 28, 0.9)", border: `1px solid ${palette.chatBorder}`,
        backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", boxShadow: palette.glassShadow,
        fontFamily: "var(--j-font-ui)",
      }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#d6efee" }}>Khami setup</span>
        <button type="button" className="khi-icon-btn" onClick={onClose} aria-label="Close"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
          <X size={15} color="#8fb4b6" />
        </button>
      </div>
      <KhamiSetup tone="overlay" />
    </div>
  );
}

export function OverlayLayout({ locked = false }: { locked?: boolean }) {
  useClickThrough();
  useSyncAcrossWindows();
  const prefs = useKhameleonStore(s => s.overlayPrefs);
  const [lookOpen, setLookOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [khamiOpen, setKhamiOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [tips, setTips] = useState(false);
  const [captureDraft, setCaptureDraft] = useState<CaptureDraft | null>(null);
  const capture = useCaptureTask(useCallback((d: CaptureDraft) => { setCaptureDraft(d); setSkillsOpen(true); }, []));
  // Build 6: a detection offer's "Capture it" opens Capture here.
  useEffect(() => {
    const go = () => capture.open();
    window.addEventListener('khameleon:start-capture', go);
    return () => window.removeEventListener('khameleon:start-capture', go);
  }, [capture.open]);

  // Build 7: let the chat's AI work in this computer's apps (pairs the desktop link).
  useEffect(() => { if (!locked) void pairDesktopLink().catch(() => {}); }, [locked]);

  // Three quick tips after first-run setup, once per computer (also if setup finished in the Classic window).
  const startTips = useCallback(() => {
    let done = false;
    try { done = localStorage.getItem(TIPS_DONE_KEY) === "1"; } catch { /* storage blocked */ }
    if (!done) setTips(true);
  }, []);

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
  const setChatOpen = useKhameleonStore(s => s.setChatOpen);
  const setChatMinimized = useKhameleonStore(s => s.setChatWindowMinimized);
  const requestChatTool = useKhameleonStore(s => s.requestChatTool);
  const toolbarGroups = useMemo(() => defaultToolbarGroups({
    askKhameleon: () => { setChatMinimized(false); setChatOpen(true); },
    openTool: requestChatTool,
    openSkills: () => setSkillsOpen(o => !o),
    captureTask: capture.available ? capture.open : undefined,
  }), [setChatOpen, setChatMinimized, requestChatTool, capture.available, capture.open]);

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
      {skillsOpen && !locked && <SkillsPanel palette={palette} draft={captureDraft} onDraftDone={() => setCaptureDraft(null)} onClose={() => { setSkillsOpen(false); setCaptureDraft(null); }} />}
      {!locked && <EmailAssistant palette={palette} />}
      {!locked && (
        <div style={{ position: "fixed", top: 14, right: 84, zIndex: 58, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
          <LoginRequests tone="overlay" />
          <DetectionBadge tone="overlay" />
          <SuggestionSlot tone="overlay" />
        </div>
      )}
      {!locked && <CaptureBar capture={capture} tone="overlay" onDescribeInstead={() => { setCaptureDraft({ name: '', description: '', steps: '', source: '' }); setSkillsOpen(true); }} />}
      {workspaceOpen && !locked && <WorkspacePanel palette={palette} onClose={() => setWorkspaceOpen(false)} />}
      {integrationsOpen && !locked && <IntegrationsPanel palette={palette} onClose={() => setIntegrationsOpen(false)} />}
      {aboutOpen && <AboutPanel palette={palette} onClose={() => setAboutOpen(false)} />}
      {khamiOpen && !locked && <KhamiPanel palette={palette} onClose={() => setKhamiOpen(false)} />}
      {!locked && <FirstRunSetup tone="overlay" onFinished={startTips} />}
      {!locked && !tips && <KhamiProgress palette={palette} bottom={76 + bottomBar} />}
      {tips && !locked && <OverlayTips palette={palette} bottomOffset={bottomBar} onDone={() => setTips(false)} />}
      {lookOpen && <SettingsPanel palette={palette} onClose={() => setLookOpen(false)} onOpenIntegrations={() => { setLookOpen(false); setIntegrationsOpen(true); }} />}
      <KhameleonHead palette={palette} locked={locked} bottom={18 + bottomBar} onOpenLook={locked ? undefined : () => { setWorkspaceOpen(false); setKhamiOpen(false); setLookOpen(true); }}
        onOpenWorkspace={locked ? undefined : () => { setLookOpen(false); setKhamiOpen(false); setWorkspaceOpen(true); }}
        onOpenKhami={locked ? undefined : () => { setLookOpen(false); setWorkspaceOpen(false); setKhamiOpen(true); }}
        onOpenAbout={() => { setLookOpen(false); setWorkspaceOpen(false); setKhamiOpen(false); setIntegrationsOpen(false); setAboutOpen(true); }}
        onOpenIntegrations={locked ? undefined : () => { setLookOpen(false); setWorkspaceOpen(false); setKhamiOpen(false); setAboutOpen(false); setIntegrationsOpen(true); }} />
    </>
  );
}
