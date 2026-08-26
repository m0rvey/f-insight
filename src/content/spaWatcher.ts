import { extractRoomIdFromPageUrl } from '../services/interceptRules';

export type UrlChangeCallback = (url: string, matchId: string | null) => void;

export class SpaWatcher {
  private currentUrl: string = '';
  private callbacks: UrlChangeCallback[] = [];

  constructor() {
    this.currentUrl = window.location.href;
    this.hookHistoryEvents();
    this.startPolling();
  }

  onUrlChange(cb: UrlChangeCallback) {
    this.callbacks.push(cb);
    // Trigger immediately for initial page load
    cb(this.currentUrl, this.extractMatchId(this.currentUrl));
  }

  private hookHistoryEvents() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    // Wrapping history methods can break the host router if anything in our
    // bookkeeping throws — never let our code leak an exception into FACEIT's
    // navigation flow.
    history.pushState = (...args) => {
      try {
        originalPushState.apply(history, args);
      } catch (err) {
        console.warn('[f-insight:SpaWatcher] pushState failed:', err);
      }
      this.checkUrlSafe();
    };

    history.replaceState = (...args) => {
      try {
        originalReplaceState.apply(history, args);
      } catch (err) {
        console.warn('[f-insight:SpaWatcher] replaceState failed:', err);
      }
      this.checkUrlSafe();
    };

    window.addEventListener('popstate', () => this.checkUrlSafe());
    window.addEventListener('hashchange', () => this.checkUrlSafe());
  }

  private checkUrlSafe() {
    try {
      this.checkUrl();
    } catch (err) {
      console.warn('[f-insight:SpaWatcher] checkUrl failed:', err);
    }
  }

  private intervalId: number | null = null;

  private startPolling() {
    // Light poll as fallback for complex framework routers
    this.intervalId = window.setInterval(() => {
      if (window.location.href !== this.currentUrl) {
        this.checkUrl();
      }
    }, 500);
  }

  public stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private checkUrl() {
    if (window.location.href !== this.currentUrl) {
      this.currentUrl = window.location.href;
      const matchId = this.extractMatchId(this.currentUrl);
      for (const cb of this.callbacks) {
        cb(this.currentUrl, matchId);
      }
    }
  }

  public extractMatchId(url: string): string | null {
    // Format: /room/1-xxxx-xxxx-xxxx or /room/xxxx (shared with the
    // content-engine URL guard so the two can never drift apart).
    return extractRoomIdFromPageUrl(url);
  }
}
