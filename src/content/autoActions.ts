import { ExtensionSettings } from '../types/settings';
import { MapVetoRankItem } from '../services/forecastEngine';

export class AutoActionsEngine {
  private lastClickedButton: Element | null = null;
  private lastClickTime = 0;
  private hasCopiedServerIp = false;

  public resetForNewMatch() {
    this.lastClickedButton = null;
    this.lastClickTime = 0;
    this.hasCopiedServerIp = false;
  }

  public checkAndExecute(
    settings: ExtensionSettings,
    serverIp?: string,
    rankedMaps?: MapVetoRankItem[]
  ) {
    if (settings.autoReadyUp) {
      this.checkAutoReady();
    }

    if (settings.autoAcceptParty) {
      this.checkAutoAcceptParty();
    }

    if (settings.autoDismissAfk) {
      this.checkAutoInactiveDismiss();
    }

    if (settings.autoContinueQueue) {
      this.checkAutoQueueContinue();
    }

    if (settings.autoDismissCaptain) {
      this.checkAutoCaptainDismiss();
    }

    if (settings.autoHideClientBanner) {
      this.checkHideClientDownloadBanner();
    }

    if (settings.autoVetoMaps && rankedMaps && rankedMaps.length > 0) {
      this.checkAutoVeto(rankedMaps);
    }

    if (serverIp) {
      this.handleServerReady(serverIp, settings);
    }
  }

  private clickElementSafely(el: Element, actionLabel: string): boolean {
    const now = Date.now();
    if (el === this.lastClickedButton && now - this.lastClickTime < 5000) {
      return false;
    }

    const isHtmlBtn = el instanceof HTMLButtonElement;
    if (isHtmlBtn && el.disabled) return false;
    if (el.getAttribute('aria-disabled') === 'true') return false;
    if (el.classList.contains('disabled')) return false;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    if (window.getComputedStyle(el).visibility === 'hidden') return false;
    if (window.getComputedStyle(el).display === 'none') return false;

    console.log(`[f-insight:AutoAction] ${actionLabel} triggered`);
    this.lastClickedButton = el;
    this.lastClickTime = now;

    try {
      if (typeof (el as HTMLElement).click === 'function') {
        (el as HTMLElement).click();
      }
      el.dispatchEvent(
        new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: true,
        })
      );
      return true;
    } catch (err) {
      console.warn(`[f-insight:AutoAction] Error clicking for ${actionLabel}:`, err);
      return false;
    }
  }

  private checkAutoReady() {
    const now = Date.now();
    if (now - this.lastClickTime < 2000) return;

    const candidates = document.querySelectorAll(
      'button, [role="button"], a[role="button"], [data-testid*="check-in"], [data-testid*="ready"], [data-testid*="accept"], [class*="MatchReady"] button, [class*="check-in"] button'
    );

    const READY_REGEX = /^(CHECK\s*IN|ACCEPT|READY|ПРИНЯТЬ|ГОТОВ)(\s*\(\d+s?\))?$/i;
    const READY_SUBSTRING_REGEX = /(CHECK\s*IN|ACCEPT\s*MATCH|READY\s*UP|ПРИНЯТЬ\s*МАТЧ|ПОДТВЕРДИТЬ)/i;

    for (const el of candidates) {
      const rawText = el.textContent?.trim().replace(/\s+/g, ' ') || '';
      if (!rawText) continue;

      if (READY_REGEX.test(rawText) || READY_SUBSTRING_REGEX.test(rawText)) {
        if (this.clickElementSafely(el, `Auto-Ready ("${rawText}")`)) {
          break;
        }
      }
    }
  }

  private checkAutoAcceptParty() {
    const inviteButtons = document.querySelectorAll(
      'button[class*="party-invite"], [data-testid*="party-invite"] button, [class*="PartyInvite"] button'
    );
    for (const btn of inviteButtons) {
      const text = btn.textContent?.trim().toUpperCase() || '';
      if (text === 'ACCEPT' || text === 'JOIN' || text.includes('ПРИНЯТЬ')) {
        if (this.clickElementSafely(btn, 'Auto-Accept Party Invite')) {
          break;
        }
      }
    }
  }

  private checkAutoInactiveDismiss() {
    // Dismiss "Are you still here?" AFK inactivity modal
    const buttons = document.querySelectorAll('button, [role="button"]');
    const AFK_REGEX = /^(I'M\s*HERE|STILL\s*HERE|CONTINUE|Я\s*ЗДЕСЬ|ПРОДОЛЖИТЬ)$/i;

    for (const btn of buttons) {
      const text = btn.textContent?.trim().replace(/\s+/g, ' ') || '';
      if (AFK_REGEX.test(text)) {
        // Confirm it's inside a modal or dialog
        const modalParent = btn.closest('[role="dialog"], [class*="Modal"], [class*="modal"], [class*="popup"]');
        if (modalParent) {
          if (this.clickElementSafely(btn, 'AFK Inactivity Check Dismiss')) {
            break;
          }
        }
      }
    }
  }

  private checkAutoQueueContinue() {
    // Continue search when match aborted because someone failed to ready up
    const buttons = document.querySelectorAll('[data-testid*="continue"], [class*="queue"] button, [role="dialog"] button');
    const QUEUE_CONT_REGEX = /^(CONTINUE\s*SEARCH|FIND\s*MATCH|CONTINUE|ПРОДОЛЖИТЬ\s*ПОИСК|ИСКАТЬ\s*СНОВА)$/i;

    for (const btn of buttons) {
      const text = btn.textContent?.trim().replace(/\s+/g, ' ') || '';
      if (QUEUE_CONT_REGEX.test(text)) {
        if (this.clickElementSafely(btn, 'Queue Auto-Continue Search')) {
          break;
        }
      }
    }
  }

  private checkAutoCaptainDismiss() {
    // Auto-dismiss "You are the captain" confirmation modals
    const modal = document.querySelector('[class*="CaptainModal"], [class*="captain-modal"], [data-testid*="captain-modal"]');
    if (modal) {
      const btn = modal.querySelector('button');
      if (btn) {
        this.clickElementSafely(btn, 'Captain Notice Auto-Dismiss');
      }
    }
  }

  private checkHideClientDownloadBanner() {
    // Hide Faceit Client desktop download banners
    const banners = document.querySelectorAll(
      '[class*="DownloadBanner"], [class*="download-banner"], [class*="client-banner"], [class*="ClientDownload"]'
    );
    for (const banner of banners) {
      if (banner instanceof HTMLElement && banner.style.display !== 'none') {
        banner.style.display = 'none';
        console.log('[f-insight:AutoAction] Hidden Faceit Client Download Banner');
      }
    }
  }

  private checkAutoVeto(rankedMaps: MapVetoRankItem[]) {
    // Find active map ban buttons if it's currently user team's turn to vote
    const voteButtons = document.querySelectorAll('button[class*="vote"], [data-testid*="vote-button"], [class*="voting-button"]');
    if (voteButtons.length === 0) return;

    // Lowest ranked map that is recommended for PERMABAN or RISK_BAN
    const worstMap = [...rankedMaps].reverse().find((m) => m.recommendation === 'PERMABAN' || m.recommendation === 'RISK_BAN');
    if (!worstMap) return;

    for (const btn of voteButtons) {
      const mapContainer = btn.closest('[class*="map"], [data-testid*="map-entity"]');
      const text = (mapContainer?.textContent || btn.textContent || '').toLowerCase();
      if (text.includes(worstMap.mapName)) {
        this.clickElementSafely(btn, `Auto-Veto Ban for ${worstMap.mapName}`);
        break;
      }
    }
  }

  private handleServerReady(serverIp: string, settings: ExtensionSettings) {
    if (!serverIp || serverIp.length < 5) return;

    // Auto-copy connect string to clipboard
    if (settings.autoCopyConnectIp && !this.hasCopiedServerIp) {
      this.hasCopiedServerIp = true;
      const connectCmd = `connect ${serverIp}`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(connectCmd)
          .then(() => {
            console.log(`[f-insight:AutoAction] Copied "${connectCmd}" to clipboard`);
          })
          .catch((err) => {
            console.warn('[f-insight:AutoAction] Clipboard write failed:', err);
          });
      }
    }
  }
}

export const autoActionsEngine = new AutoActionsEngine();
