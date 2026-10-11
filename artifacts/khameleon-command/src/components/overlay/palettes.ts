/**
 * The two overlay palettes from the Phase 1 sample
 * (artifacts/mockup-sandbox/.../OverlayRedesign.tsx), now real. Which one is
 * active becomes a saved user choice in Build 2 step (d); until then the
 * overlay uses Khameleon's existing teal.
 */
export type OverlayPaletteId = "soft-blue" | "brand-teal";

export interface OverlayPalette {
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

export const OVERLAY_PALETTES: Record<OverlayPaletteId, OverlayPalette> = {
  "soft-blue": {
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
