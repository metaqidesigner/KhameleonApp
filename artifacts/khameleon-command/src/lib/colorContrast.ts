/**
 * WCAG 2.x contrast ratio - pure math, no DOM, so this is unit-testable
 * against the theme's actual color values (see colorContrast.test.ts,
 * design-spec.md §9's "every color pairing must hold 4.5:1 minimum").
 */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [R, G, B] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** WCAG contrast ratio between two hex colors, e.g. contrastRatio('#6FE6BD', '#080c1a') -> 12.74 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA minimum for normal-size text (design-spec.md §9). */
export const WCAG_AA_NORMAL_TEXT = 4.5;

export function meetsWcagAA(fg: string, bg: string): boolean {
  return contrastRatio(fg, bg) >= WCAG_AA_NORMAL_TEXT;
}
