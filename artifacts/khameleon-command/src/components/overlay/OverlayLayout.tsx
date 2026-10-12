import { useEffect, useMemo } from "react";
import { getSessionStatus } from "@/lib/sessionApi";
import ChatWindow from "@/components/chatWindow/ChatWindow";
import { KhameleonHead } from "./KhameleonHead";
import { OVERLAY_PALETTES } from "./palettes";
import { useClickThrough } from "./useClickThrough";
import { Toolbars, defaultToolbarGroups } from "./Toolbars";
import { useJarvisStore } from "@/store/jarvisStore";

/**
 * The Overlay layout (docs/build-review.md, Builds 0-2): rendered inside the
 * desktop app's full-screen, see-through, always-on-top window. Everything
 * not marked `data-overlay-hit` is invisible and lets clicks through.
 *
 * So far: the window, the head, the real chat (the same ChatWindow Classic
 * uses - one implementation, two layouts) and the four edge toolbars.
 */
/** Room the right-hand toolbars take up, kept clear of the chat window. */
const TOOLBAR_CLEARANCE = 72;

export function OverlayLayout({ locked = false }: { locked?: boolean }) {
  useClickThrough();

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

  const palette = OVERLAY_PALETTES["brand-teal"];
  const setChatOpen = useJarvisStore(s => s.setChatOpen);
  const setChatMinimized = useJarvisStore(s => s.setChatWindowMinimized);
  const toolbarGroups = useMemo(() => defaultToolbarGroups({
    askKhameleon: () => { setChatMinimized(false); setChatOpen(true); },
  }), [setChatOpen, setChatMinimized]);

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
          <ChatWindow bottomInset={64} rightInset={TOOLBAR_CLEARANCE} />
        </div>
      )}
      {!locked && <Toolbars palette={palette} groups={toolbarGroups} />}
      <KhameleonHead palette={palette} locked={locked} />
    </>
  );
}
