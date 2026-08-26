import { describe, it, expect } from 'vitest';
import { RenderScheduler } from '../src/content/renderScheduler';

/**
 * Manual frame pump: captures scheduled animation-frame callbacks so tests
 * decide exactly when a "frame" fires.
 */
function createFramePump() {
  const frames: Array<() => void> = [];
  const scheduleFrame = (cb: () => void) => frames.push(cb);
  const flush = () => {
    const pending = frames.splice(0);
    for (const cb of pending) cb();
  };
  return { scheduleFrame, flush, frames };
}

describe('RenderScheduler', () => {
  it('coalesces many schedule() calls within one frame into a single run', () => {
    const { scheduleFrame, flush, frames } = createFramePump();
    const scheduler = new RenderScheduler(scheduleFrame);

    let runs = 0;
    for (let i = 0; i < 10; i++) {
      scheduler.schedule(() => {
        runs += 1;
      });
    }

    // Nothing has executed yet — everything waits for the frame.
    expect(runs).toBe(0);
    expect(frames).toHaveLength(1);

    flush();
    expect(runs).toBe(1); // 10 requests -> exactly one render pass
  });

  it('keeps only the latest pending callback', () => {
    const { scheduleFrame, flush } = createFramePump();
    const scheduler = new RenderScheduler(scheduleFrame);

    let ranOld = false;
    let ranNew = false;
    scheduler.schedule(() => {
      ranOld = true;
    });
    scheduler.schedule(() => {
      ranNew = true;
    });

    flush();
    expect(ranNew).toBe(true);
    expect(ranOld).toBe(false);
  });

  it('accepts new work after a frame has been flushed', () => {
    const { scheduleFrame, flush } = createFramePump();
    const scheduler = new RenderScheduler(scheduleFrame);

    const order: number[] = [];
    scheduler.schedule(() => order.push(1));
    flush();
    scheduler.schedule(() => order.push(2));
    flush();

    expect(order).toEqual([1, 2]);
  });
});
