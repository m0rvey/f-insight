export interface PlayerElementTarget {
  nickname: string;
  element: HTMLElement;
}

export class DomObserver {
  private observer: MutationObserver | null = null;
  private rafId: number | null = null;
  private lastRunTime = 0;
  private readonly THROTTLE_MS = 60; // 60ms throttle for 60fps smoothness

  startObserving(onUpdate: () => void) {
    this.stopObserving();

    this.observer = new MutationObserver(() => {
      const now = performance.now();
      if (now - this.lastRunTime >= this.THROTTLE_MS) {
        this.lastRunTime = now;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = requestAnimationFrame(() => {
          onUpdate();
        });
      } else {
        if (!this.rafId) {
          this.rafId = requestAnimationFrame(() => {
            this.lastRunTime = performance.now();
            this.rafId = null;
            onUpdate();
          });
        }
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  stopObserving() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  findMatchHeaderMountPoint(): HTMLElement | null {
    const selectors = [
      '[class*="MatchPage__Container"]',
      '[class*="MatchOverview"]',
      '[class*="MatchLayout"]',
      '[class*="match-vs"]',
      '[class*="match-header"]',
      '[class*="VotingLayout"]',
      '#main-content > div:first-child',
      'main > div:first-child',
      '#main-content',
      'main',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el instanceof HTMLElement) {
        return el;
      }
    }

    return document.querySelector('main') || document.body;
  }

  findPlayerElements(): PlayerElementTarget[] {
    const targets: PlayerElementTarget[] = [];
    const seenNicknames = new Set<string>();

    const selectors = [
      'a[href*="/players/"]',
      'a[href*="/players-modal/"]',
      '[data-testid*="roster-player"]',
      '[class*="RosterPlayer"]',
      '[class*="roster-item"]',
      '[class*="MatchTeamMember"]',
      '[class*="TeamMember"]',
      '[class*="PlayerContainer"]',
      '[class*="MatchPlayer"]',
      '[class*="Roster__Player"]',
      'tr[class*="StatsTableRow"]',
    ];

    const playerNodes = document.querySelectorAll(selectors.join(', '));

    playerNodes.forEach((el) => {
      if (!(el instanceof HTMLElement)) return;

      // Extract nickname from href or inner link
      const href = el.getAttribute('href') || el.querySelector('a')?.getAttribute('href') || '';
      const match = href.match(/\/(?:[a-z]{2}\/)?players(?:-modal)?\/([a-zA-Z0-9_\-]+)/i);
      let nick = match ? match[1] : '';

      if (!nick) {
        // Look inside data-testid or text
        const testId = el.getAttribute('data-testid') || '';
        const testIdMatch = testId.match(/roster-player-([a-zA-Z0-9_\-]+)/i);
        if (testIdMatch) {
          nick = testIdMatch[1];
        } else {
          const text = el.textContent?.trim() || '';
          if (text && text.length < 24 && !text.includes(' ') && !text.includes('\n')) {
            nick = text;
          }
        }
      }

      if (nick && !seenNicknames.has(nick.toLowerCase())) {
        seenNicknames.add(nick.toLowerCase());

        const nicknameEl = el.querySelector('[class*="nickname"], [class*="Nickname"], [class*="name"], h5, span') || el;
        targets.push({
          nickname: nick,
          element: (nicknameEl instanceof HTMLElement ? nicknameEl : el),
        });
      }
    });

    return targets;
  }

  findServerIpFromDom(): string | null {
    const steamLinks = document.querySelectorAll('a[href^="steam://connect/"]');
    for (const link of steamLinks) {
      const href = link.getAttribute('href') || '';
      const ipMatch = href.match(/steam:\/\/connect\/([a-zA-Z0-9.\-]+:\d+)/);
      if (ipMatch && ipMatch[1]) {
        return ipMatch[1];
      }
    }

    const elements = document.querySelectorAll('code, [class*="server-ip"], [data-testid*="server-ip"], [class*="quick-connect"]');
    for (const el of elements) {
      const text = el.textContent || '';
      const match = text.match(/connect\s+([a-zA-Z0-9.\-]+:\d+)/i);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }
}
