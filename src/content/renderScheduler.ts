/**
 * Coalesces bursts of render requests into a single animation-frame callback.
 *
 * The background streams one PLAYER_STATS_UPDATE message per player as the
 * prefetch loop resolves; without coalescing each message triggered a full
 * renderAll() pass — up to 10 redundant renders per lobby analysis.
 * schedule() keeps only the latest callback: intermediate ones are dropped,
 * because a later state always reflects every earlier update.
 */
export class RenderScheduler {
  private scheduled = false;
  private pendingFn: (() => void) | null = null;

  constructor(
    private readonly scheduleFrame: (cb: () => void) => void = (cb) => requestAnimationFrame(cb)
  ) {}

  /** Replaces any previously scheduled (not yet run) callback with this one. */
  schedule(fn: () => void): void {
    this.pendingFn = fn;
    if (this.scheduled) return;
    this.scheduled = true;
    this.scheduleFrame(() => {
      this.scheduled = false;
      const run = this.pendingFn;
      this.pendingFn = null;
      run?.();
    });
  }
}
