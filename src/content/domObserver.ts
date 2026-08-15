export interface PlayerElementTarget {
  nickname: string;
  element: HTMLElement;
}

export class DomObserver {
  private observer: MutationObserver | null = null;
  private timeoutId: number | null = null;
  private lastRunTime = 0;
  private readonly THROTTLE_MS = 60; // 60ms throttle for 60fps smoothness

  // Caching: avoid re-scanning the whole page on every observer tick
  private cachedTargets: PlayerElementTarget[] | null = null;
  private cachedMountPoint: HTMLElement | null = null;
  private targetsDirty = false;

  startObserving(onUpdate: () => void) {
    this.stopObserving();

    this.observer = new MutationObserver(() => {
      this.targetsDirty = true;
      const now = performance.now();
      
      if (now - this.lastRunTime >= this.THROTTLE_MS) {
        if (this.timeoutId) {
          window.clearTimeout(this.timeoutId);
          this.timeoutId = null;
        }
        this.lastRunTime = now;
        requestAnimationFrame(onUpdate);
      } else if (!this.timeoutId) {
        this.timeoutId = window.setTimeout(() => {
          this.lastRunTime = performance.now();
          this.timeoutId = null;
          requestAnimationFrame(onUpdate);
        }, this.THROTTLE_MS - (now - this.lastRunTime));
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  stopObserving() {
    if (this.timeoutId) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.cachedTargets = null;
    this.cachedMountPoint = null;
    this.targetsDirty = false;
  }

  /** Returns true when a DOM mutation happened since the last scan (roster may have changed). */
  consumeTargetsDirty(): boolean {
    const dirty = this.targetsDirty;
    this.targetsDirty = false;
    return dirty;
  }

  findMatchHeaderMountPoint(): HTMLElement | null {
    if (this.cachedMountPoint && this.cachedMountPoint.isConnected) {
      return this.cachedMountPoint;
    }

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
        this.cachedMountPoint = el;
        return el;
      }
    }

    this.cachedMountPoint = document.querySelector('main') || document.body;
    return this.cachedMountPoint;
  }

  findPlayerElements(): PlayerElementTarget[] {
    // Reuse the previous scan while all cached targets are still in the DOM.
    // Roster nodes are static once rendered; only a mutation marks the cache dirty.
    if (this.cachedTargets) {
      const alive = this.cachedTargets.filter((t) => t.element.isConnected);
      if (alive.length === this.cachedTargets.length) {
        this.targetsDirty = false;
        return this.cachedTargets;
      }
      this.cachedTargets = null;
    }

    const targets = this.scanPlayerElements();
    this.cachedTargets = targets;
    this.targetsDirty = false;
    return targets;
  }

  private scanPlayerElements(): PlayerElementTarget[] {
    const targets: PlayerElementTarget[] = [];
    const seenNicknames = new Set<string>();

    const cardSelectors = [
      '[data-testid*="roster-player"]',
      '[class*="RosterPlayer"]',
      '[class*="roster-item"]',
      '[class*="MatchTeamMember"]',
      '[class*="TeamMember"]',
      '[class*="PlayerContainer"]',
      '[class*="MatchPlayer"]',
      '[class*="Roster__Player"]',
      '[data-testid*="team-member"]',
    ];

    const selectors = [
      ...cardSelectors,
      'a[href*="/players/"]',
      'a[href*="/players-modal/"]',
    ];

    const playerNodes = document.querySelectorAll(selectors.join(', '));
    const processedNodes = new Set<HTMLElement>();

    Array.from(playerNodes).forEach((el) => {
      if (!(el instanceof HTMLElement)) return;

      const cardEl = el.closest(cardSelectors.join(', ')) || (el.matches(cardSelectors.join(', ')) ? el : null);
      const targetContainer = (cardEl instanceof HTMLElement ? cardEl : el);

      if (processedNodes.has(targetContainer)) return;
      processedNodes.add(targetContainer);

      // Extract nickname from href or inner link
      const href = targetContainer.getAttribute('href') || targetContainer.querySelector('a')?.getAttribute('href') || el.getAttribute('href') || '';
      const match = href.match(/\/(?:[a-z]{2}\/)?players(?:-modal)?\/([a-zA-Z0-9_.\-]+)/i);
      let nick = match ? match[1] : '';

      if (!nick) {
        const testId = targetContainer.getAttribute('data-testid') || el.getAttribute('data-testid') || '';
        const testIdMatch = testId.match(/roster-player-([a-zA-Z0-9_.\-]+)/i);
        if (testIdMatch) {
          nick = testIdMatch[1];
        } else {
          const nameEl = targetContainer.querySelector('[class*="nickname"], [class*="Nickname"], [class*="name"], h5');
          const text = nameEl?.textContent?.trim() || el.textContent?.trim() || '';
          if (text && text.length < 24 && !text.includes('\n')) {
            nick = text;
          }
        }
      }

      if (nick && !seenNicknames.has(nick.toLowerCase())) {
        seenNicknames.add(nick.toLowerCase());
        targets.push({
          nickname: nick,
          element: targetContainer,
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
