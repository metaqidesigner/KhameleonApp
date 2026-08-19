import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FOCUS_CARD_BOTTOM,
  FOCUS_CARD_HEIGHT,
  FOCUS_CARD_LEFT,
  FOCUS_CARD_WIDTH,
  clampOrbPosition,
  getFocusCardRect,
  getOrbRect,
  getOrbVisualRect,
  rectsOverlap,
} from './orbLayout';

const canvasCss = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

function extractBlock(source: string, start: number): string {
  const openingBrace = source.indexOf('{', start);
  if (openingBrace < 0) throw new Error('CSS block has no opening brace');

  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(openingBrace + 1, index);
    }
  }

  throw new Error('CSS block has no closing brace');
}

function mediaBlock(query: string): string {
  const marker = `@media ${query}`;
  const start = canvasCss.indexOf(marker);
  if (start < 0) throw new Error(`Missing media query: ${marker}`);
  return extractBlock(canvasCss, start);
}

function ruleBlock(source: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exactMatches = [
    ...source.matchAll(new RegExp(`(?:^|[}\\n])\\s*${escapedSelector}\\s*\\{`, 'g')),
  ];
  const exactMatch = exactMatches.at(-1);
  if (exactMatch?.index !== undefined) return extractBlock(source, exactMatch.index);

  const groupedMatch = new RegExp(
    `(?:^|,|})\\s*${escapedSelector}\\s*(?:,\\s*[^{}]+)*\\{`,
  ).exec(source);
  if (groupedMatch?.index === undefined) throw new Error(`Missing CSS rule: ${selector}`);
  return extractBlock(source, groupedMatch.index);
}

function declaration(source: string, property: string): string | undefined {
  const match = source.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`));
  return match?.[1].trim();
}

const responsiveRulesStart = canvasCss.indexOf('/* ── Tablet canvas:');
if (responsiveRulesStart < 0) throw new Error('Missing responsive canvas rules');
const desktopRules = canvasCss.slice(0, responsiveRulesStart);
const baseCanvas = ruleBlock(desktopRules, '.kc-canvas');
const baseLeft = ruleBlock(desktopRules, '.kc-col-left');
const baseCentre = ruleBlock(desktopRules, '.kc-col-centre');
const baseRight = ruleBlock(desktopRules, '.kc-col-right');
const focusCard = ruleBlock(desktopRules, '.ac-focus-card');
const tablet = mediaBlock('(min-width: 1001px) and (max-width: 1400px)');
const narrow = mediaBlock('(max-width: 1000px)');

describe('canvas responsive layout contract', () => {
  it.each([
    ['one-column', 1000],
    ['two-column', 1200],
    ['three-column', 1401],
  ] as const)('keeps the %s canvas arrangement at %dpx', (arrangement, width) => {
    if (arrangement === 'one-column') {
      const canvas = ruleBlock(narrow, '.kc-canvas');
      expect(declaration(canvas, 'flex-direction')).toBe('column');
      expect(declaration(canvas, 'height')).toBe('auto');
      expect(declaration(canvas, 'overflow')).toBe('visible');
      expect(declaration(ruleBlock(narrow, '.kc-col-left'), 'width')).toBe('100%');
      expect(declaration(ruleBlock(narrow, '.kc-col-centre'), 'width')).toBe('100%');
      expect(declaration(ruleBlock(narrow, '.kc-col-right'), 'width')).toBe('100%');
      return;
    }

    if (arrangement === 'two-column') {
      const canvas = ruleBlock(tablet, '.kc-canvas');
      expect(declaration(canvas, 'display')).toBe('grid');
      expect(declaration(canvas, 'grid-template-columns')).toBe('minmax(0, 1fr) minmax(0, 1fr)');
      expect(declaration(canvas, 'grid-template-rows')).toBe('repeat(2, minmax(0, 1fr))');
      expect(declaration(ruleBlock(tablet, '.kc-col-left'), 'grid-column')).toBe('1');
      expect(declaration(ruleBlock(tablet, '.kc-col-left'), 'grid-row')).toBe('1');
      expect(declaration(ruleBlock(tablet, '.kc-col-centre'), 'grid-column')).toBe('1');
      expect(declaration(ruleBlock(tablet, '.kc-col-centre'), 'grid-row')).toBe('2');
      expect(declaration(ruleBlock(tablet, '.kc-col-right'), 'grid-column')).toBe('2');
      expect(declaration(ruleBlock(tablet, '.kc-col-right'), 'grid-row')).toBe('1 / span 2');
      return;
    }

    expect(declaration(baseCanvas, 'display')).toBe('flex');
    expect(declaration(baseCanvas, 'height')).toBe('100%');
    expect(declaration(baseLeft, 'flex')).toBe('0 0 28%');
    expect(declaration(baseCentre, 'flex')).toBe('1 1 40%');
    expect(declaration(baseRight, 'flex')).toBe('0 0 30%');
    expect(width).toBeGreaterThan(1400);
  });
});

describe('canvas floating controls', () => {
  it('keeps the focus card in its fixed bottom-left safe area', () => {
    expect(declaration(focusCard, 'position')).toBe('fixed');
    expect(declaration(focusCard, 'left')).toBe(`${FOCUS_CARD_LEFT}px`);
    expect(declaration(focusCard, 'bottom')).toBe(`${FOCUS_CARD_BOTTOM}px`);
    expect(declaration(focusCard, 'width')).toBe(`${FOCUS_CARD_WIDTH}px`);
    expect(declaration(focusCard, 'height')).toBe(`${FOCUS_CARD_HEIGHT}px`);
  });

  it.each([320, 360, 1000, 1200, 1401])(
    'keeps the default orb envelope separate from the fixed focus card at %dpx',
    width => {
      const viewportHeight = 800;
      const orb = getOrbRect(width, viewportHeight);
      expect(
        rectsOverlap(
          getFocusCardRect(viewportHeight),
          getOrbVisualRect(orb.left, orb.top),
        ),
      ).toBe(false);
    },
  );

  it.each([360, 768, 1000, 1200, 1401, 1920])(
    'keeps a dragged full-size orb out of the focus card at %dpx',
    width => {
      const viewportHeight = 800;
      const focus = getFocusCardRect(viewportHeight);
      const position = clampOrbPosition(focus.left, focus.top, width, viewportHeight);

      expect(rectsOverlap(
        getOrbVisualRect(position.x, position.y),
        focus,
      )).toBe(false);
    },
  );

  it.each([
    ['left', { x: 250, y: 320 }, 'left'],
    ['right', { x: 410, y: 320 }, 'right'],
    ['top', { x: 320, y: 250 }, 'top'],
    ['bottom', { x: 320, y: 420 }, 'bottom'],
  ] as const)(
    'keeps the full orb envelope clear when clamping from the %s card edge',
    (_edge, target, clearSide) => {
      const protectedRect = { left: 300, top: 300, width: 100, height: 100 };
      const position = clampOrbPosition(target.x, target.y, 1000, 800, 90, protectedRect);
      const visualRect = getOrbVisualRect(position.x, position.y);

      expect(rectsOverlap(visualRect, protectedRect)).toBe(false);

      if (clearSide === 'right') {
        expect(visualRect.left).toBeGreaterThanOrEqual(protectedRect.left + protectedRect.width);
      } else if (clearSide === 'left') {
        expect(visualRect.left + visualRect.width).toBeLessThanOrEqual(protectedRect.left);
      } else if (clearSide === 'bottom') {
        expect(visualRect.top).toBeGreaterThanOrEqual(protectedRect.top + protectedRect.height);
      } else {
        expect(visualRect.top + visualRect.height).toBeLessThanOrEqual(protectedRect.top);
      }
    },
  );

  it('keeps the orb within every viewport edge while avoiding the focus card', () => {
    const viewports = [
      { width: 320, height: 568 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
    ];

    for (const { width, height } of viewports) {
      const focus = getFocusCardRect(height);
      for (const target of [
        { x: -200, y: -200 },
        { x: width + 200, y: height + 200 },
        { x: focus.left + 2, y: focus.top + 2 },
      ]) {
        const position = clampOrbPosition(target.x, target.y, width, height);
        const orb = { left: position.x, top: position.y, width: 90, height: 90 };

        expect(position.x).toBeGreaterThanOrEqual(0);
        expect(position.y).toBeGreaterThanOrEqual(0);
        expect(position.x + orb.width).toBeLessThanOrEqual(width);
        expect(position.y + orb.height).toBeLessThanOrEqual(height);
        expect(rectsOverlap(getOrbVisualRect(position.x, position.y), focus)).toBe(false);
      }
    }
  });
});