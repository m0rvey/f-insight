export interface PlayerElementTarget {
  nickname: string;
  element: HTMLElement;
  /** FACEIT account UUID when the profile link carries an id instead of a nickname. */
  playerId?: string;
}

import { DOM_CONFIG } from '../constants/config';

/** Escape a class token for safe use inside a CSS selector. */
function escapeCssIdent(token: string): string {
  return token.replace(/([^a-zA-Z0-9_\u00A0-\uFFFF-])/g, '\\$1');
}

// Pre-joined selector strings — avoid re-joining on every scan (D5)
const CARD_SELECTORS = [
  '[data-testid*="roster-player"]',
  '[class*="RosterPlayer"]',
  '[class*="roster-item"]',
  '[class*="MatchTeamMember"]',
  '[class*="TeamMember"]',
  '[class*="PlayerContainer"]',
  '[class*="MatchPlayer"]',
  '[class*="Roster__Player"]',
  '[data-testid*="team-member"]',
  '[role="listitem"]',
  '[class*="ListItem"]',
] as const;
const CARD_SELECTORS_JOINED = CARD_SELECTORS.join(', ');

export class DomObserver {
  private observer: MutationObserver | null = null;
  private timeoutId: number | null = null;
  private lastRunTime = 0;
  private readonly THROTTLE_MS = DOM_CONFIG.THROTTLE_MS;

  // Caching: avoid re-scanning the whole page on every observer tick
  private cachedTargets: PlayerElementTarget[] | null = null;
  private cachedMountPoint: HTMLElement | null = null;
  private targetsDirty = false;

  // Self-healing primary scan. When the text fallback recovers a full roster,
  // stable row-container signatures (tag + classes) are learned from the
  // recovered rows and run as ordinary selectors afterwards, so later scans
  // no longer pay for the document-wide nickname walk.
  private learnedRowSelectors: string[] = [];

  // Log-noise control for the fallback-recovery warning: FACEIT mutates its
  // DOM constantly, so an unchanged recovery used to re-warn on every rescan.
  private lastFallbackLogKey: string | null = null;

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
      characterData: true,
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

  /** Force the next findPlayerElements() call to rescan from scratch. */
  invalidateTargets(): void {
    this.cachedTargets = null;
    this.targetsDirty = true;
  }

  findMatchHeaderMountPoint(): HTMLElement | null {
    if (this.cachedMountPoint && this.cachedMountPoint.isConnected) {
      return this.cachedMountPoint;
    }

    const selectors = [
      '[class*="MatchPage__Container"]',
      '[class*="MatchOverview"]',
      '[class*="MatchLayout"]',
      '[class*="Room"]',
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

  findPlayerElements(
    rosterNicknames: string[] = [],
    opts: { allowTextFallback?: boolean } = {}
  ): PlayerElementTarget[] {
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
    // Callers may disable it (allowTextFallback:false) — the document-wide
    // walk is the most expensive scan and repeated failures mean the markup
    // carries no matchable text at all.
    const allowFallback = opts.allowTextFallback !== false;
    if (allowFallback && rosterNicknames.length > 0) {
      const found = new Set(targets.map((t) => t.nickname.toLowerCase()));
      const missing = rosterNicknames.filter((n) => n && !found.has(n.toLowerCase()));
      if (missing.length > 0) {
        const recovered = this.scanTargetsByNicknameText(missing, targets);
        if (recovered.length > 0) {
          // Successful full recovery is not an error — downgrade to debug to avoid noise on new FACEIT markup
          // Only warn when fallback *failed* to recover all missing rows
          const fullyRecovered = recovered.length === missing.length;
          const logKey = `${missing.length}:${recovered.length}`;
          const message = `[f-insight:DomObserver] Primary selectors missed ${missing.length} roster rows — text fallback recovered ${recovered.length}`;
          if (fullyRecovered) {
            console.debug(message + ' (full recovery — primary selectors need update)');
          } else if (this.lastFallbackLogKey !== logKey) {
            this.lastFallbackLogKey = logKey;
            console.warn(message);
          } else {
            console.debug(message);
          }
          if (recovered.length >= Math.min(5, missing.length)) {
            this.learnRowSelectors(recovered, rosterNicknames);
          }
        } else if (missing.length > 0) {
          // Nothing recovered — this is the real error case
          const logKey = `${missing.length}:0`;
          if (this.lastFallbackLogKey !== logKey) {
            this.lastFallbackLogKey = logKey;
            console.warn(`[f-insight:DomObserver] Primary selectors missed ${missing.length} roster rows — text fallback recovered 0 (markup changed?)`);
          }
        }
        for (const t of recovered) {
          if (!found.has(t.nickname.toLowerCase())) {
            targets.push(t);
            found.add(t.nickname.toLowerCase());
          }
        }
      }
    }

    // Never cache an empty scan. An early pass (network payload lands before
    // FACEIT finishes rendering roster rows) must not be pinned forever:
    // quiet pages produce no further relevant mutations, so a cached empty
    // result used to survive the whole session ("0/10 player rows located").
    if (targets.length > 0) {
      this.cachedTargets = targets;
      this.targetsDirty = false;
    } else {
      this.cachedTargets = null;
      this.targetsDirty = true;
    }
    return targets;
  }

  /**
   * Last-resort scan: match known roster nicknames against leaf text and
   * containers' own direct text nodes. FACEIT pages exist where player rows
   * carry NO anchors at all (scoreboard tables render clickable spans) — an
   * anchors-only walk reported "0/10 player rows located" there. Leaf/own-text
   * matching keeps the scan cheap and immune to nested-label noise; early
   * exit once every nickname is found.
   */
  private scanTargetsByNicknameText(nicknames: string[], existingTargets: PlayerElementTarget[] = []): PlayerElementTarget[] {
    const wantedMap = new Map<string, string>(nicknames.map((raw) => [raw.toLowerCase(), raw]));
    const targets: PlayerElementTarget[] = [];
    const seen = new Set<string>();

    // Two-phase scope: first try MatchRoom (fast), if not enough then document-wide (robust for new layouts)
    const scopeRoots: Element[] = [];
    const primaryScope = document.querySelector('[class*="MatchRoom"], [class*="match-room"], [class*="MatchPage"]') as HTMLElement | null;
    if (primaryScope) scopeRoots.push(primaryScope);
    const mainScope = document.querySelector('main, #main-content') as HTMLElement | null;
    if (mainScope && mainScope !== primaryScope) scopeRoots.push(mainScope);
    scopeRoots.push(document.documentElement);
    // Use a Set to avoid revisiting same element via multiple scopes
    const visitedEls = new Set<Element>();
    const allCandidates: Element[] = [];
    for (const root of scopeRoots) {
      const cand = root.querySelectorAll(
        'a, span, div, p, td, th, h5, h6, li, button, [class*="nickname"], [class*="Nickname"], [data-testid*="player"], [data-testid*="roster"]'
      );
      for (const el of cand) if (!visitedEls.has(el)) { visitedEls.add(el); allCandidates.push(el); }
      if (allCandidates.length > 4000) break; // safety cap
    }

    for (const el of allCandidates) {
      if (seen.size >= wantedMap.size) break;
      if (!(el instanceof HTMLElement) || !el.isConnected) continue;
      if (el.closest('[class*="chat"], [class*="Chat"], [class*="ChatMessage"]')) continue;
      let texts: string[] = [];
      if (el.children.length === 0) {
        texts.push((el.textContent || '').trim());
      } else {
        const own = Array.from(el.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent || '')
          .join('')
          .trim();
        if (own) texts.push(own);
      }
      // Never match our own injected UI.
      const elId = el.id || '';
      if (elId.startsWith('f-insight-') || (el.closest && el.closest('[id^="f-insight-"]'))) continue;
      // Skip nodes already covered by a primary-scan target container.
      if (existingTargets.some((t) => t.element.contains(el))) continue;

      texts = texts.filter((t) => t.length > 0 && t.length <= 24 && !t.includes('\n'));

      let hit: { raw: string; lower: string } | undefined;
      for (const text of texts) {
        const lower = text.toLowerCase();
        const raw = wantedMap.get(lower);
        if (raw) {
          hit = { raw, lower };
          break;
        }
      }
      if (!hit || seen.has(hit.lower)) continue;

      // Climb to a stable row container so the badge has room beneath the row
      const rowCandidate = el.closest(
        'li, tr, [class*="member"], [class*="Member"], [class*="player"], [class*="Player"], [class*="row"], [class*="Row"], [data-testid*="roster"]'
      );
      const container = rowCandidate instanceof HTMLElement ? rowCandidate : el.parentElement instanceof HTMLElement ? el.parentElement : el;

      seen.add(hit.lower);
      targets.push({ nickname: hit.raw, element: container });
    }

    return targets;
  }

  private scanPlayerElements(): PlayerElementTarget[] {
    const targets: PlayerElementTarget[] = [];

    const selectors = [
      ...this.learnedRowSelectors,
      ...CARD_SELECTORS,
      'a[href*="/players/"]',
      'a[href*="/players-modal/"]',
    ];

    const playerNodes = document.querySelectorAll(selectors.join(', '));
    const processedNodes = new Set<HTMLElement>();

    for (const el of playerNodes) {
      if (!(el instanceof HTMLElement)) continue;

      const cardEl = (el.closest(CARD_SELECTORS_JOINED) as HTMLElement | null) || (el.matches(CARD_SELECTORS_JOINED) ? el : null);
      const targetContainer = (cardEl instanceof HTMLElement ? cardEl : el);

      if (processedNodes.has(targetContainer)) continue;
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
        // Element-identity dedupe ONLY (processedNodes above). Never dedupe by
        // nickname: the same player legitimately renders in the roster, the
        // scoreboard tab AND the profile popup — FACEIT's popup uses hashed
        // class names, so a context heuristic used to drop its copy and the
        // mini stats table never appeared on profile click.
        targets.push({
          nickname: nick,
          element: targetContainer,
          playerId,
        });
      }
    }

    return targets;
  }

  /**
   * Learn stable row-container signatures from rows the text fallback had to
   * recover. A signature is adopted only if it explains most recovered rows
   * AND its page matches overwhelmingly resolve to roster nicknames — generic
   * containers must never flood unrelated badge mounts.
   */
  private learnRowSelectors(recovered: PlayerElementTarget[], rosterNicknames: string[]): void {
    const rosterSet = new Set(rosterNicknames.map((n) => n.toLowerCase()).filter(Boolean));
    if (rosterSet.size === 0) return;

    const signatureCounts = new Map<string, number>();
    for (const t of recovered) {
      const sig = this.buildSelectorSignature(t.element);
      if (sig) signatureCounts.set(sig, (signatureCounts.get(sig) || 0) + 1);
    }

    for (const [sig, count] of signatureCounts) {
      if (this.learnedRowSelectors.includes(sig)) continue;
      // Signature must explain at least half of the recovered batch…
      if (count < Math.max(2, Math.ceil(recovered.length / 2))) continue;
      // …and its live page matches must mostly be roster rows.
      let total = 0;
      let hits = 0;
      try {
        for (const el of document.querySelectorAll(sig)) {
          if (!(el instanceof HTMLElement) || !el.isConnected) continue;
          total += 1;
          if (this.elementResolvesToRoster(el, rosterSet)) hits += 1;
        }
      } catch {
        continue; // malformed signature — never adopt
      }
      if (total >= 4 && hits / total >= 0.6 && !this.learnedRowSelectors.includes(sig)) {
        this.learnedRowSelectors.push(sig);
        if (this.learnedRowSelectors.length > 4) this.learnedRowSelectors.shift();
        console.debug(
          `[f-insight:DomObserver] Learned row selector "${sig}" (${hits}/${total} roster hits)`
        );
      }
    }
  }

  /** tag.classA.classB fingerprint (≤3 classes, CSS-escaped) of a row container. */
  private buildSelectorSignature(el: HTMLElement): string | null {
    const tag = el.tagName.toLowerCase();
    if (!tag || tag === 'body' || tag === 'html') return null;
    const classes = (typeof el.className === 'string' ? el.className : '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3);
    if (classes.length === 0) return null;
    const escaped = classes.map(escapeCssIdent).join('.');
    if (!escaped) return null;
    return `${tag}.${escaped}`;
  }

  /**
   * True when the element carries a roster nickname as a /players/ href
   * segment or as exact leaf/direct text — the same signals the text
   * fallback trusts, reused to validate learned selectors.
   */
  private elementResolvesToRoster(el: HTMLElement, rosterSet: Set<string>): boolean {
    const href =
      el.getAttribute('href') || el.querySelector('a')?.getAttribute('href') || '';
    const m = href.match(/\/(?:[a-z]{2}\/)?players(?:-modal)?\/([a-zA-Z0-9_.\-]+)/i);
    if (m?.[1] && rosterSet.has(m[1].toLowerCase())) return true;

    const leaves =
      el.children.length === 0
        ? [el]
        : Array.from(el.querySelectorAll('a, span, div, p, td, th, h5, h6'));
    for (const leaf of leaves) {
      if (!(leaf instanceof HTMLElement) || leaf.children.length > 0) continue;
      const text = (leaf.textContent || '').trim();
      if (text && text.length <= 24 && !text.includes('\n') && rosterSet.has(text.toLowerCase())) {
        return true;
      }
    }
    return false;
  }

  findServerIpFromDom(): string | null {
    const steamLinks = document.querySelectorAll('a[href^="steam://connect/"]');
    for (const link of steamLinks) {
      // Scope to match room — chat links must never be treated as server IP
      if (link.closest('[class*="chat"], [class*="Chat"]')) continue;
      const href = link.getAttribute('href') || '';
      // Strict IPv4:port only — domains from chat must not be accepted
      const ipMatch = href.match(/steam:\/\/connect\/(\d{1,3}(?:\.\d{1,3}){3}:\d{1,5})/);
      if (ipMatch && ipMatch[1]) {
        return ipMatch[1];
      }
    }

    // Only look inside match-room containers; generic <code> in chat can contain "connect evil.com:27015"
    const roomRoots = document.querySelectorAll(
      '[class*="MatchRoom"], [class*="match-room"], [class*="MatchReady"], [data-testid*="match-room"]'
    );
    const scope = roomRoots.length > 0 ? roomRoots : [document.body];
    for (const root of Array.from(scope)) {
      const elements = root.querySelectorAll('code, [class*="server-ip"], [data-testid*="server-ip"], [class*="quick-connect"]');
      for (const el of elements) {
        if (el.closest('[class*="chat"], [class*="Chat"]')) continue;
        const text = el.textContent || '';
        const match = text.match(/connect\s+(\d{1,3}(?:\.\d{1,3}){3}:\d{1,5})/i);
        if (match && match[1]) {
          return match[1];
        }
      }
    }

    return null;
  }
}
