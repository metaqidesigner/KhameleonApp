import { useEffect } from "react";
import { getSessionStatus } from "@/lib/sessionApi";
import { KhameleonHead } from "./KhameleonHead";
import { OVERLAY_PALETTES } from "./palettes";
import { useClickThrough } from "./useClickThrough";

/**
 * The Overlay layout (docs/build-review.md, Builds 0-2): rendered inside the
 * desktop app's full-screen, see-through, always-on-top window. Everything
 * not marked `data-overlay-hit` is invisible and lets clicks through.
 *
 * Build 2 step (a): the window itself plus the head. Toolbars (step b) and
 * the real chat (step c) are added next.
 */
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
      <KhameleonHead palette={palette} locked={locked} />
    </>
  );
}
