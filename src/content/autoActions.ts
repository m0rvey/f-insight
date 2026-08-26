import { ExtensionSettings } from '../types/settings';
import { MapVetoRankItem } from '../services/forecastEngine';
import { MatchStatus } from '../types/faceit';

export type AutoActionKind = 'ready' | 'party' | 'afk' | 'queue' | 'captain' | 'veto' | 'server';

export function isButtonTextMatch(text: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(text));
}

export function isElementHidden(el: Element): boolean {
  if (el instanceof HTMLButtonElement && el.disabled) return true;
  if (el.getAttribute('aria-disabled') === 'true') return true;
  if (el.classList.contains('disabled')) return true;

  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return true;
  const style = window.getComputedStyle(el);
  if (style.visibility === 'hidden') return true;
  if (style.display === 'none') return true;
  return false;
}

const MATCH_ROOM_CONTEXT_SELECTOR = [
  '[class*="MatchRoom"]',
  '[class*="match-room"]',
  '[class*="MatchCheckIn"]',
  '[class*="match-check-in"]',
  '[class*="MatchReady"]',
  '[class*="match-ready"]',
  '[data-testid*="match-room"]',
  '[data-testid*="match-check"]',
  '[data-testid*="check-in"]',
].join(', ');

const READY_REGEX = /^(CHECK\s*IN|ACCEPT|READY|ПРИНЯТЬ|ГОТОВ)(\s*\(\d+s?\))?$/i;
const READY_SUBSTRING_REGEX = /(CHECK\s*IN|ACCEPT\s*MATCH|READY\s*UP|ПРИНЯТЬ\s*МАТЧ|ПОДТВЕРДИТЬ)/i;
const AFK_REGEX = /^(I'M\s*HERE|STILL\s*HERE|CONTINUE|Я\s*ЗДЕСЬ|ПРОДОЛЖИТЬ)$/i;
const QUEUE_CONT_REGEX = /^(CONTINUE\s*SEARCH|FIND\s*MATCH|CONTINUE|ПРОДОЛЖИТЬ\s*ПОИСК|ИСКАТЬ\s*СНОВА)$/i;

/**
 * Dialogs are only trusted for automation when their TEXT confirms the
 * scenario. Generic buttons like "Continue" exist in settings confirmations,
 * profile dialogs and tutorials — blind-clicking those is a major source of
 * FACEIT "Action Failed" errors.
 */
export const AFK_MODAL_CONTEXT_REGEX = /(still\s*here|are\s*you\s*(still\s*)?(there|with us|active)|inactive|inactivity|вы\s*(ещё|еще)\s*здесь|вы\s*активны|неактивност)/i;
export const QUEUE_MODAL_CONTEXT_REGEX = /(queue|matchmak|search|match[\s-]*(aborted|cancelled|canceled|failed|creation)|ready[\s-]*up|очередь|поиск|подбор|матч[\s-]*(прерван|отмен[её]н|не\s*состоял))/i;

function textOf(el: Element): string {
  return el.textContent?.trim().replace(/\s+/g, ' ') || '';
}

export class AutoActionsEngine {
  private lastClickedButton: Element | null = null;
  private lastClickTime = 0;
  private lastClickByAction: Map<AutoActionKind, number> = new Map();
  private lastEngineClickAt = 0;
  private readonly globalClickGapMs = 1500;
  private hasCopiedServerIp = false;
  private vetoClickCount = 0;
  private lastUserActivity = 0;
  private readonly userActivityLockMs = 3000;

  public resetForNewMatch() {
    this.lastClickedButton = null;
    this.lastClickTime = 0;
    this.lastClickByAction.clear();
    this.lastEngineClickAt = 0;
    this.hasCopiedServerIp = false;
    this.vetoClickCount = 0;
    this.lastUserActivity = 0;
  }

  /** Called on any user interaction (pointer/key) — engine stays quiet shortly after. */
  public noteUserActivity() {
    this.lastUserActivity = Date.now();
  }

  private userInteracting(): boolean {
    return Date.now() - this.lastUserActivity < this.userActivityLockMs;
  }

  private canClick(kind: AutoActionKind, el: Element, cooldownMs: number): boolean {
    if (this.lastClickedButton === el && Date.now() - this.lastClickTime < 5000) return false;
    const last = this.lastClickByAction.get(kind) || 0;
    if (Date.now() - last < cooldownMs) return false;
    return true;
  }

  private markClicked(kind: AutoActionKind, el: Element) {
    const now = Date.now();
    this.lastClickedButton = el;
    this.lastClickTime = now;
    this.lastEngineClickAt = now;
    this.lastClickByAction.set(kind, now);
  }

  private clickElementSafely(el: Element, kind: AutoActionKind, actionLabel: string, cooldownMs = 2000): boolean {
    // Global inter-click gap: never fire two different automations within a
    // short window — rapid back-to-back synthetic clicks read as bot behavior
    // and make FACEIT reject them with "Action Failed".
    if (Date.now() - this.lastEngineClickAt < this.globalClickGapMs) return false;
    if (!this.canClick(kind, el, cooldownMs)) return false;
    if (isElementHidden(el)) return false;

    console.log(`[f-insight:AutoAction] ${actionLabel} triggered`);
    this.markClicked(kind, el);

    try {
      // Native .click() dispatches a full trusted MouseEvent — no need for a
      // synthetic dispatchEvent, which previously caused double-firing.
      if (typeof (el as HTMLElement).click === 'function') {
        (el as HTMLElement).click();
      }
      return true;
    } catch (err) {
      console.warn(`[f-insight:AutoAction] Error clicking for ${actionLabel}:`, err);
      return false;
    }
  }

  private inMatchRoom(el: Element): boolean {
    return !!el.closest(MATCH_ROOM_CONTEXT_SELECTOR);
  }

  public checkAndExecute(
    settings: ExtensionSettings,
    serverIp?: string,
    rankedMaps?: MapVetoRankItem[],
    matchStatus?: MatchStatus,
    userTeamName?: string
  ) {
    const hasEnabledActions =
      settings.autoReadyUp ||
      settings.autoAcceptParty ||
      settings.autoDismissAfk ||
      settings.autoContinueQueue ||
      settings.autoDismissCaptain ||
      settings.autoHideClientBanner ||
      settings.autoVetoMaps ||
      !!serverIp;

    if (!hasEnabledActions) return;

    // Never act while the user is interacting with the page — engine clicks at
    // the same moment as a user click are the #1 source of FACEIT "Action Failed".
    if (this.userInteracting()) {
      console.debug('[f-insight:AutoAction] skipped (user activity lock)');
      return;
    }

    if (settings.autoReadyUp && matchStatus === 'VOTING') {
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

    if (settings.autoVetoMaps && rankedMaps && rankedMaps.length > 0 && matchStatus === 'VOTING') {
      this.checkAutoVeto(rankedMaps, userTeamName);
    }

    if (serverIp) {
      this.handleServerReady(serverIp, settings);
    }
  }

  private checkAutoReady() {
    const candidates = document.querySelectorAll(
      'button, [role="button"], a[role="button"], [data-testid*="check-in"], [data-testid*="ready"], [data-testid*="accept"], [class*="MatchReady"] button, [class*="check-in"] button'
    );

    for (const el of candidates) {
      const rawText = textOf(el);
      if (!rawText) continue;

      const strongMatch = isButtonTextMatch(rawText, [READY_REGEX]);
      const weakMatch = isButtonTextMatch(rawText, [READY_SUBSTRING_REGEX]);
      if (!strongMatch && !weakMatch) continue;

      // Party invites and unrelated dialogs can contain "ACCEPT"/"READY" text —
      // only act inside a match room to avoid "Action Failed" errors.
      if (!this.inMatchRoom(el)) continue;

      // Never click inside popovers/modals — they open while the user is looking
      // at a player profile and a stale ready-click there triggers "Action Failed".
      if (el.closest('[role="dialog"], [class*="popover"], [class*="Popover"], [class*="modal"], [class*="Modal"]')) continue;

      if (this.clickElementSafely(el, 'ready', `Auto-Ready ("${rawText}")`, 5000)) {
        break;
      }
    }
  }

  private checkAutoAcceptParty() {
    const inviteButtons = document.querySelectorAll(
      'button[class*="party-invite"], [data-testid*="party-invite"] button, [class*="PartyInvite"] button'
    );
    for (const btn of inviteButtons) {
      const text = textOf(btn).toUpperCase();
      if (text === 'ACCEPT' || text === 'JOIN' || text.includes('ПРИНЯТЬ')) {
        if (this.clickElementSafely(btn, 'party', 'Auto-Accept Party Invite')) {
          break;
        }
      }
    }
  }

  private checkAutoInactiveDismiss() {
    // Dismiss "Are you still here?" AFK inactivity modal
    const modalParent = document.querySelector('[role="dialog"], [class*="Modal"], [class*="modal"], [class*="popup"]');
    if (!modalParent) return;

    // Only act when the dialog text confirms it is genuinely the inactivity
    // check — a bare "Continue" button also lives in settings confirmations,
    // profile dialogs and tutorials, and clicking those causes "Action Failed".
    const contextText = (modalParent.textContent || '').slice(0, 600);
    if (!AFK_MODAL_CONTEXT_REGEX.test(contextText)) {
      console.debug('[f-insight:AutoAction] AFK dismiss skipped (dialog is not an inactivity check)');
      return;
    }

    const buttons = modalParent.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      const text = textOf(btn);
      if (isButtonTextMatch(text, [AFK_REGEX])) {
        if (this.clickElementSafely(btn, 'afk', 'AFK Inactivity Check Dismiss')) {
          break;
        }
      }
    }
  }

  private checkAutoQueueContinue() {
    // Continue search when match aborted because someone failed to ready up
    const queueContainer = document.querySelector('[role="dialog"], [class*="queue"], [class*="Queue"], [class*="modal"], [class*="Modal"], [data-testid*="continue"]');
    if (!queueContainer) return;

    // Verify the dialog actually talks about queue/matchmaking before we let
    // the generic "Continue" regex anywhere near it.
    const contextText = (queueContainer.textContent || '').slice(0, 600);
    if (!QUEUE_MODAL_CONTEXT_REGEX.test(contextText)) {
      console.debug('[f-insight:AutoAction] queue continue skipped (no matchmaking context in dialog)');
      return;
    }

    const buttons = queueContainer.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      const text = textOf(btn);
      if (isButtonTextMatch(text, [QUEUE_CONT_REGEX])) {
        if (this.clickElementSafely(btn, 'queue', 'Queue Auto-Continue Search')) {
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
        this.clickElementSafely(btn, 'captain', 'Captain Notice Auto-Dismiss');
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

  private detectActiveTurnTeam(): string | null {
    // Prioritize explicit "active/current team" markers, then generic turn classes.
    const selectorGroups = [
      '[class*="active-team"], [class*="ActiveTeam"], [class*="current-team"], [class*="CurrentTeam"], [data-testid*="active-team"], [data-testid*="current-turn"]',
      '[class*="turn"], [class*="Turn"], [data-testid*="turn"]',
      '[class*="picking"], [class*="banning"], [class*="Picking"], [class*="Banning"], [class*="voting-team"]',
    ];

    for (const group of selectorGroups) {
      const elements = document.querySelectorAll(group);
      for (const el of elements) {
        const text = textOf(el);
        // Skip generic action labels ("Ban", "Picking...", map names) that don't name a team
        if (!text || text.length < 2 || /^(pick|ban|voting|map|de_|your|our|their)/i.test(text)) continue;
        if (el instanceof HTMLElement && (el.getBoundingClientRect().width === 0 || el.getBoundingClientRect().height === 0)) continue;
        return text;
      }
    }

    return null;
  }

  private checkAutoVeto(rankedMaps: MapVetoRankItem[], userTeamName?: string) {
    if (this.vetoClickCount >= 1) return;

    // Only act when we can confirm it's OUR team's turn to vote. FACEIT rejects
    // clicks outside the active turn with "Action Failed".
    const activeTurn = this.detectActiveTurnTeam();
    if (!activeTurn) {
      console.debug('[f-insight:AutoAction] veto skipped (no active turn indicator)');
      return;
    }

    if (userTeamName) {
      const activeLower = activeTurn.toLowerCase();
      const ourLower = userTeamName.toLowerCase();
      if (!activeLower.includes(ourLower)) {
        console.debug(`[f-insight:AutoAction] veto skipped (not our turn: "${activeTurn}")`);
        return;
      }
    } else {
      // Without the user's team name we cannot verify the turn — stay quiet.
      console.debug('[f-insight:AutoAction] veto skipped (unknown user team)');
      return;
    }

    // Find active map ban buttons if it's currently user team's turn to vote
    const voteButtons = document.querySelectorAll('button[class*="vote"], [data-testid*="vote-button"], [class*="voting-button"]');
    if (voteButtons.length === 0) return;

    // Lowest ranked map that is recommended for PERMABAN or RISK_BAN
    const worstMap = [...rankedMaps].reverse().find((m) => m.recommendation === 'PERMABAN' || m.recommendation === 'RISK_BAN');
    if (!worstMap) return;

    for (const btn of voteButtons) {
      // Skip already voted / pending actions — clicking them causes "Action Failed"
      if (isElementHidden(btn)) continue;

      const mapContainer = btn.closest('[class*="map"], [data-testid*="map-entity"]');
      if (!mapContainer) continue;
      const votedMarker = mapContainer.matches(
        '[class*="voted"], [class*="banned"], [class*="check"], [class*="picked"]'
      ) || mapContainer.querySelector('[class*="voted"], [class*="banned"], [class*="check"], [class*="picked"]');
      if (votedMarker) continue;

      const text = (mapContainer.textContent || btn.textContent || '').toLowerCase();
      if (text.includes(worstMap.mapName)) {
        if (this.clickElementSafely(btn, 'veto', `Auto-Veto Ban for ${worstMap.mapName}`, 8000)) {
          this.vetoClickCount++;
        }
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