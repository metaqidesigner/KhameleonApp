import { describe, it, expect } from 'vitest';
import { formatMs } from './settings';

describe('formatMs (Spotify now-playing progress display)', () => {
  it('formats whole minutes with zero-padded seconds', () => {
    expect(formatMs(65000)).toBe('1:05');
  });

  it('formats sub-minute durations', () => {
    expect(formatMs(9000)).toBe('0:09');
  });

  it('formats zero', () => {
    expect(formatMs(0)).toBe('0:00');
  });

  it('truncates rather than rounds partial seconds', () => {
    expect(formatMs(65999)).toBe('1:05');
  });

  it('handles durations over an hour by keeping raw minutes, not wrapping to hours', () => {
    // Spotify tracks rarely exceed an hour, but the display shouldn't silently
    // wrap or truncate if one ever does.
    expect(formatMs(61 * 60 * 1000)).toBe('61:00');
  });
});
