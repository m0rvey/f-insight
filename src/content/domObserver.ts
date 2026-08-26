export interface PlayerElementTarget {
  nickname: string;
  element: HTMLElement;
  /** FACEIT account UUID when the profile link carries an id instead of a nickname. */
  playerId?: string;
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

    this.observer = new MutationObserver((mutations) => {
      // 1. Filter mutations: ignore our own injected containers and known noise
      let isRelevant = false;
      for (let i = 0; i < mutations.length; i++) {
        const target = mutations[i].target as HTMLElement | null;
        if (!target) continue;

        // Skip our own shadow DOM roots / hosts
        if (target.id?.startsWith?.('f-insight-') || (target.closest && target.closest('[id^="f-insight-"]'))) {
          continue;
        }

        // Skip live chat, clock timers, notifications which fire continuously
        const className = typeof target.className === 'string' ? target.className : '';
        if (className.includes('chat') || className.includes('timer') || className.includes('clock') || className.includes('toast')) {
          continue;
        }

        isRelevant = true;
        break;
      }

      if (!isRelevant) return;

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

  findPlayerElements(rosterNicknames: string[] = []): PlayerElementTarget[] {
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

    let targets = this.scanPlayerElements();

    // Resilience net for FACEIT redesigns: when the payload knows the roster
    // but class/href selectors missed rows, locate nickname text directly.
    if (rosterNicknames.length > 0) {
      const found = new Set(targets.map((t) => t.nickname.toLowerCase()));
      const missing = rosterNicknames.filter((n) => n && !found.has(n.toLowerCase()));
      if (missing.length > 0) {
        const recovered = this.scanTargetsByNicknameText(missing, targets);
        if (recovered.length > 0) {
          console.warn(`[f-insight:DomObserver] Primary selectors missed ${missing.length} roster rows — text fallback recovered ${recovered.length}`);
        }
        for (const t of recovered) {
          if (!found.has(t.nickname.toLowerCase())) {
            targets.push(t);
            found.add(t.nickname.toLowerCase());
          }
        }
      }
    }

    this.cachedTargets = targets;
    this.targetsDirty = false;
    return targets;
  }

  /**
   * Last-resort scan: walk every anchor on the page and match its trimmed
   * text against known roster nicknames. Slow-ish (one querySelectorAll) but
   * immune to class-name churn, so a FACEIT redesign degrades instead of
   * killing all player widgets.
   */
  private scanTargetsByNicknameText(nicknames: string[], existingTargets: PlayerElementTarget[] = []): PlayerElementTarget[] {
    const wanted = nicknames.map((raw) => ({ raw, lower: raw.toLowerCase() }));
    const targets: PlayerElementTarget[] = [];
    const seen = new Set<string>();

    for (const anchor of Array.from(document.querySelectorAll('a'))) {
      if (!(anchor instanceof HTMLElement) || !anchor.isConnected) continue;
      // Skip anchors already covered by a primary-scan target container —
      // otherwise the same row is reported twice under different nicknames
      // (e.g. when the profile link segment is an account UUID).
      if (existingTargets.some((t) => t.element.contains(anchor))) continue;
      const text = (anchor.textContent || '').trim();
      if (!text || text.length > 24 || text.includes('\n')) continue;

      const hit = wanted.find((w) => w.lower === text.toLowerCase());
      if (!hit || seen.has(hit.lower)) continue;

      // Climb to a stable row container so the badge has room beneath the row
      const rowCandidate = anchor.closest(
        'li, tr, [class*="member"], [class*="Member"], [class*="player"], [class*="Player"], [class*="row"], [class*="Row"], [data-testid*="roster"]'
      );
      const container = rowCandidate instanceof HTMLElement ? rowCandidate : anchor;

      seen.add(hit.lower);
      targets.push({ nickname: hit.raw, element: container });
    }

    return targets;
  }

  private scanPlayerElements(): PlayerElementTarget[] {
    const targets: PlayerElementTarget[] = [];
    // Dedupe per CONTEXT: the same player legitimately renders twice — once in
    // the match roster and once inside the FACEIT profile popup. Keying only
    // by nickname used to drop the popup copy entirely.
    const seenKeys = new Set<string>();

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

      // Newer FACEIT builds link profiles by account UUID — keep it so the
      // roster can be matched by id when the nickname segment is unavailable.
      const uuidMatch = href.match(/\/(?:[a-z]{2}\/)?players(?:-modal)?\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      const playerId = uuidMatch ? uuidMatch[1] : undefined;

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

      if (nick || playerId) {
        // Same player may appear in the page AND in the profile popup — allow
        // one target per context, dedupe only within the same context.
        const inModalContext = !!targetContainer.closest(
          '[class*="players-modal"], [class*="PlayersModal"], [role="dialog"], [class*="popover"], [class*="Popover"]'
        );
        const key = `${inModalContext ? 'modal' : 'page'}:${(nick || playerId || '').toLowerCase()}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          targets.push({
            nickname: nick,
            element: targetContainer,
            playerId,
          });
        }
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
