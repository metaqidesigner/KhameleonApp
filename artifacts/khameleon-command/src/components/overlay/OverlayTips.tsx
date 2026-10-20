import { useState } from "react";
import type { OverlayPalette } from "./palettes";

/**
 * Three quick tips after first-run setup (download decisions, step 2), each
 * pointing at the real thing on screen. "Got it" moves on; "Skip tips" ends
 * them. Shown once per computer.
 */
export const TIPS_DONE_KEY = "khameleon-tips-done";

const TIPS: { text: string; where: React.CSSProperties; arrow: "right" | "left" | "down" }[] = [
  { text: "This is Khameleon. Click the head to chat - ask anything, or ask it to do something in your apps.", where: { right: 86, bottom: 34 }, arrow: "right" },
  { text: "Your tools are on the edges of the screen: Capture, drafting, research and more. Move the mouse near an edge to see them.", where: { left: 70, top: "42%" }, arrow: "left" },
  { text: "Right-click the head for Settings, the full Khameleon window and more.", where: { right: 86, bottom: 96 }, arrow: "down" },
];

export function OverlayTips({ palette, bottomOffset, onDone }: { palette: OverlayPalette; bottomOffset: number; onDone: () => void }) {
  const [i, setI] = useState(0);
  const tip = TIPS[i];
  const end = () => { try { localStorage.setItem(TIPS_DONE_KEY, "1"); } catch { /* storage blocked */ } onDone(); };
  const where = { ...tip.where, ...(typeof tip.where.bottom === "number" ? { bottom: (tip.where.bottom as number) + bottomOffset } : {}) };
  return (
    <div data-overlay-hit role="dialog" aria-label={`Tip ${i + 1} of ${TIPS.length}`} style={{
      position: "fixed", ...where, zIndex: 460, width: 270, padding: "12px 14px", borderRadius: 14,
      background: palette.chatBg, border: `1px solid ${palette.accent}`, boxShadow: palette.glassShadow,
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", fontFamily: "var(--j-font-ui)", color: palette.text,
    }}>
      <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{tip.text}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
        <span style={{ flex: 1, fontSize: 11, color: palette.textMuted }}>{i + 1} of {TIPS.length}</span>
        {i < TIPS.length - 1 && <button type="button" onClick={end} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", background: "transparent", border: `1px solid ${palette.glassBorder}`, color: palette.textMuted }}>Skip tips</button>}
        <button type="button" autoFocus onClick={() => (i < TIPS.length - 1 ? setI(i + 1) : end())} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", background: palette.accentSoft, border: `1px solid ${palette.accent}`, color: palette.text }}>{i < TIPS.length - 1 ? "Next" : "Got it"}</button>
      </div>
    </div>
  );
}
