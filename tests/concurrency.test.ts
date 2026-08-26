import { describe, it, expect, vi } from 'vitest';
import { mapWithConcurrency } from '../src/utils/concurrency';

describe('mapWithConcurrency', () => {
  it('preserves order and respects concurrency limit', async () => {
    const items = [1, 2, 3, 4, 5];
    let concurrent = 0;
    let maxConcurrent = 0;

    const fn = async (n: number) => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 10));
      concurrent--;
      return n * 2;
    };

    const res = await mapWithConcurrency(items, 2, fn, 0);
    expect(res).toEqual([2, 4, 6, 8, 10]);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('applies delay between items and still resolves', async () => {
    const items = [1, 2, 3];
    const start = Date.now();
    const res = await mapWithConcurrency(items, 1, async (n) => n, 20);
    const elapsed = Date.now() - start;
    expect(res).toEqual([1, 2, 3]);
    expect(elapsed).toBeGreaterThanOrEqual(40); // 2 delays × 20ms
  });

  it('downgrade-guard pattern: fresh partial must not overwrite good cache', async () => {
    // Mirrors BackgroundMessageHandler.streamLobbyDataInner guard
    const prev = { statsAvailable: true, elo: 2000 } as any;
    const freshPartial = { statsAvailable: false, elo: 2000 } as any;
    const freshGood = { statsAvailable: true, elo: 2100 } as any;

    const shouldKeepPrev = (prev: any, fresh: any): boolean =>
      Boolean(fresh.statsAvailable === false && prev && prev.statsAvailable !== false);

    expect(shouldKeepPrev(prev, freshPartial)).toBe(true);
    expect(shouldKeepPrev(prev, freshGood)).toBe(false);
    expect(shouldKeepPrev(null, freshPartial)).toBe(false);
  });
});
