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
    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.checkUrl();
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.checkUrl();
    };

    window.addEventListener('popstate', () => this.checkUrl());
    window.addEventListener('hashchange', () => this.checkUrl());
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
    // Format: /room/1-xxxx-xxxx-xxxx or /room/xxxx
    const match = url.match(/\/room\/([a-zA-Z0-9\-]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return null;
  }
}
