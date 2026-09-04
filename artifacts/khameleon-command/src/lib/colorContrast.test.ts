import { describe, it, expect } from 'vitest';
import { contrastRatio, meetsWcagAA, WCAG_AA_NORMAL_TEXT } from './colorContrast';

// Kept in sync with index.css's actual custom-property values by hand -
// a change to either theme's accent/background colors should update
// this test alongside it, the same way a schema change updates its
// matching test elsewhere in this session's work.
const DARK_BG = '#080c1a';
const LIGHT_BG = '#f0f4f8';

const DARK_ACCENTS = {
  teal: '#6FE6BD', violet: '#8C7CF0', amber: '#F0A34C', coral: '#E77A7A', green: '#38cf8a',
};
const LIGHT_ACCENTS = {
  teal: '#167e5a', violet: '#4a31e7', amber: '#a55e0e', coral: '#d42626', green: '#1f7f53',
};

describe('contrastRatio (sanity)', () => {
  it('is 21:1 for pure black on pure white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });
  it('is 1:1 for identical colors', () => {
    expect(contrastRatio('#6FE6BD', '#6FE6BD')).toBeCloseTo(1, 5);
  });
});

describe('design-spec.md §9: every accent color must hold 4.5:1 against its actual theme background', () => {
  for (const [name, hex] of Object.entries(DARK_ACCENTS)) {
    it(`dark theme: --j-${name} (${hex}) vs --j-bg (${DARK_BG})`, () => {
      expect(contrastRatio(hex, DARK_BG)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
    });
  }
  for (const [name, hex] of Object.entries(LIGHT_ACCENTS)) {
    it(`light theme: --j-${name} (${hex}) vs --j-bg (${LIGHT_BG})`, () => {
      expect(contrastRatio(hex, LIGHT_BG)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
    });
  }

  // The bug this test suite exists to catch: light mode used to reuse
  // the dark-theme accent hex values unchanged (1.38:1-3.04:1 against
  // #f0f4f8, all failing) - this guards against that regression too.
  it('regression guard: the old dark-tuned hues would fail in light mode', () => {
    for (const hex of Object.values(DARK_ACCENTS)) {
      expect(meetsWcagAA(hex, LIGHT_BG)).toBe(false);
    }
  });
});
