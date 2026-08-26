import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { SpaWatcher } from './spaWatcher';
import { DomObserver } from './domObserver';
import { createShadowContainer } from './shadowRoot';
import { autoActionsEngine } from './autoActions';
import { LobbyAnalysisPayload, ExtensionMessage, MessageResponse } from '../types/messages';
import { FaceitMatchDetails } from '../types/faceit';
import { ExtensionSettings, DEFAULT_SETTINGS } from '../types/settings';
import { LobbyWidget } from '../components/LobbyWidget';
import { PlayerBadge } from '../components/PlayerBadge';
import { PlayerDetailFlyout } from '../components/PlayerDetailFlyout';
import { QuickControls } from '../components/QuickControls';
import { calculateMapVetoRanking, MapVetoRankItem } from '../services/forecastEngine';
import { detectCurrentPlayer, DetectedCurrentUser } from '../services/currentUserDetector';
import '../styles/tailwind.css';

class ContentEngine {
  private spaWatcher = new SpaWatcher();
  private domObserver = new DomObserver();
  private currentMatchId: string | null = null;
  private lobbyPayload: LobbyAnalysisPayload | null = null;
  private currentUser: DetectedCurrentUser | null = null;
  private settings: ExtensionSettings = { ...DEFAULT_SETTINGS };
  private isDormant = false;
  private warnedZeroTargets = false;
  private isLoading: boolean = false;
  private isVisible: boolean = true;
  private showVetoMatrix: boolean = true;
  private activePlayerFlyoutId: string | null = null;
  private loadTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private vetoRanking: MapVetoRankItem[] = [];

  // React Roots
  private mainRoot: Root | null = null;
  private playerRoots: Map<string, Root> = new Map();
  private modalRoot: Root | null = null;
  private floatingRoot: Root | null = null;

  // Render Caching State
  private lastRenderPayload: LobbyAnalysisPayload | null = null;
  private lastRenderIsVisible: boolean | null = null;
  private lastRenderShowVetoMatrix: boolean | null = null;
  private lastRenderActiveFlyoutId: string | null = null;
  private lastRenderIsLoading: boolean | null = null;
  private playerRenderedState = new Map<string, unknown>();

  async init() {
    console.log('[f-insight:Content] Initialized content script');
    try {
      await this.loadSettings();
    } catch (err) {
      console.warn('[f-insight:Content] Failed to load settings, using defaults:', err);
    }

    // Every subsystem is wrapped so a single failure can never kill the engine.
    try {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.settings?.newValue) {
          const raw = changes.settings.newValue;
          // Settings are persisted through cacheManager as a { value, cachedAt, ttlMs } wrapper
          const stored = raw && typeof raw === 'object' && !Array.isArray(raw) && 'value' in raw ? raw.value : raw;
          this.settings = { ...DEFAULT_SETTINGS, ...stored };
          this.playerRenderedState.clear();
          this.applyDormancy();
          this.renderAll(true);
        }
      });
    } catch (err) {
      console.warn('[f-insight:Content] storage.onChanged registration failed:', err);
    }

    try {
      this.spaWatcher.onUrlChange((_url, matchId) => {
        if (matchId !== this.currentMatchId) {
          this.currentMatchId = matchId;
          this.activePlayerFlyoutId = null;
          autoActionsEngine.resetForNewMatch();

          if (matchId) {
            this.fetchLobbyData(matchId).catch((e) => console.warn('[f-insight:Content] fetch error:', e));
          } else {
            this.cleanup();
          }
        }
        // Dormancy is evaluated on every navigation — entering a match room
        // wakes the engine, leaving it puts it back to sleep when enabled.
        this.applyDormancy(matchId);
      });
    } catch (err) {
      console.warn('[f-insight:Content] spaWatcher registration failed:', err);
    }

    try {
      this.domObserver.startObserving(() => this.handleDomUpdate());

    // Engine must stay quiet while the user interacts — otherwise our clicks
    // collide with the user's own clicks and FACEIT shows "Action Failed".
    window.addEventListener('pointerdown', () => autoActionsEngine.noteUserActivity(), true);
    window.addEventListener('keydown', () => autoActionsEngine.noteUserActivity(), true);

    // Periodic safety check for instant Auto Ready-Up and QoL automations.
    // Gated on tab visibility and match room presence to avoid burning CPU elsewhere.
    window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (this.isDormant) return;
      if (!this.currentMatchId || this.isDomFallback) return;
      autoActionsEngine.checkAndExecute(
        this.settings,
        this.lobbyPayload?.match?.server_ip,
        this.settings.autoVetoMaps ? this.vetoRanking : undefined,
        this.lobbyPayload?.match?.status,
        this.userTeamName
      );
    }, 800);

    window.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К')) {
        if (this.currentMatchId) {
          e.preventDefault();
          this.fetchLobbyData(this.currentMatchId, true);
        }
      }
      if (e.altKey && (e.key === 'h' || e.key === 'H' || e.key === 'р' || e.key === 'Р')) {
        e.preventDefault();
        this.isVisible = !this.isVisible;
        this.renderAll();
      }
      if (e.altKey && (e.key === 'v' || e.key === 'V' || e.key === 'м' || e.key === 'М')) {
        e.preventDefault();
        this.showVetoMatrix = !this.showVetoMatrix;
        this.renderAll();
      }
    });
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'PLAYER_STATS_UPDATE') {
        if (msg.payload?.matchId !== this.currentMatchId) return;
        if (!this.lobbyPayload || !this.lobbyPayload.isPartial) return;

        if (!this.lobbyPayload.playersStats) this.lobbyPayload.playersStats = {};
        if (!this.lobbyPayload.steamData) this.lobbyPayload.steamData = {};
        if (!this.lobbyPayload.riskAnalysis) this.lobbyPayload.riskAnalysis = {};

        this.lobbyPayload.playersStats[msg.payload.playerId] = msg.payload.stats;
        if (msg.payload.steam) this.lobbyPayload.steamData[msg.payload.playerId] = msg.payload.steam;
        if (msg.payload.risk) this.lobbyPayload.riskAnalysis[msg.payload.playerId] = msg.payload.risk;

        // Force a re-render
        this.lobbyPayload = { ...this.lobbyPayload };
        this.renderAll();
      }
      if (msg.type === 'LOBBY_ANALYSIS_COMPLETE') {
        if (msg.payload?.match?.match_id !== this.currentMatchId) return;
        this.lobbyPayload = msg.payload;
        this.isLoading = false;
        this.retryCount = 0;
        this.clearLoadTimer();
        this.renderAll();
        if (!this.isDomFallback) {
          autoActionsEngine.checkAndExecute(
            this.settings,
            this.lobbyPayload?.match?.server_ip,
            undefined,
            this.lobbyPayload?.match?.status,
            this.userTeamName
          );
        }
      }
      if (msg.type === 'LOBBY_ANALYSIS_ERROR') {
        if (msg.payload?.matchId !== this.currentMatchId) return;
        this.isLoading = false;
        this.clearLoadTimer();
        this.handleFetchFailure(msg.payload.matchId);
        this.renderAll();
      }
    });
    } catch (err) {
      console.warn('[f-insight:Content] init registration failed:', err);
    }

    try {
      this.renderFloatingControls();
    } catch (err) {
      console.warn('[f-insight:Content] floating controls render failed:', err);
    }
  }

  private clearLoadTimer() {
    if (this.loadTimer) {
      clearTimeout(this.loadTimer);
      this.loadTimer = null;
    }
  }

  private buildVetoRanking() {
    const payload = this.lobbyPayload;
    if (!payload?.match) return undefined;

    const rosterToStats = (roster: any[]) =>
      roster
        .map((r) => payload.playersStats?.[r.player_id])
        .filter((p): p is NonNullable<typeof p> => Boolean(p));

    const f1Players = rosterToStats(payload.match.teams?.faction1?.roster || []);
    const f2Players = rosterToStats(payload.match.teams?.faction2?.roster || []);
    if (f1Players.length + f2Players.length < 2) return undefined;

    return calculateMapVetoRanking({
      f1Players,
      f2Players,
      availableMaps: (payload.match.voting?.map?.entities || []).map((e: any) => e.name || e.guid || ''),
      userFaction: this.currentUser?.faction,
    });
  }

  private get userTeamName(): string | undefined {
    const m = this.lobbyPayload?.match;
    if (!m || !this.currentUser?.faction) return undefined;
    return this.currentUser.faction === 'faction1'
      ? m.teams?.faction1?.name
      : m.teams?.faction2?.name;
  }

  /** True while the match data is DOM-derived (API unreachable) — no autoActions. */
  private get isDomFallback(): boolean {
    return !!(this.lobbyPayload?.match as any)?.__domFallback;
  }

  /**
   * Minimal DOM-derived payload used when the FACEIT API is unreachable, so the
   * widget ALWAYS mounts in a match room instead of staying stuck on loading.
   */
  private buildDomFallbackPayload(): LobbyAnalysisPayload | null {
    const targets = this.domObserver.findPlayerElements();
    if (targets.length === 0) return null;

    const half = Math.ceil(targets.length / 2);
    const toRoster = (list: typeof targets) =>
      list.map((t) => ({
        player_id: `dom:${t.nickname.toLowerCase()}`,
        nickname: t.nickname,
      }));

    const fallbackMatch = {
      match_id: this.currentMatchId || '',
      game: 'cs2',
      region: 'EU',
      status: 'VOTING',
      // Marker: this match object was derived from the DOM, not the API.
      // AutoActions must stay disabled until real match data arrives.
      __domFallback: true,
      teams: {
        faction1: {
          faction_id: 'faction1',
          name: 'Team 1',
          roster: toRoster(targets.slice(0, half)),
        },
        faction2: {
          faction_id: 'faction2',
          name: 'Team 2',
          roster: toRoster(targets.slice(half)),
        },
      },
    } as FaceitMatchDetails & { __domFallback: boolean };

    return {
      match: fallbackMatch,
      playersStats: {},
      steamData: {},
      riskAnalysis: {},
      premadeGroups: [],
      isPartial: true,
    };
  }

  private async loadSettings() {
    try {
      const res: MessageResponse<ExtensionSettings> = await chrome.runtime.sendMessage({
        type: 'GET_SETTINGS',
      });
      if (res?.success && res.data) {
        this.settings = res.data;
      }
    } catch (err) {
      // Ignore initial worker load
    }
  }

  private async fetchLobbyData(matchId: string, forceRefresh = false) {
    if (matchId !== this.currentMatchId) return;

    // Drop any payload from a previous match so stale data never renders in a new room
    if (this.lobbyPayload?.match?.match_id !== matchId) {
      this.lobbyPayload = null;
    }

    this.isLoading = true;
    this.renderMainWidget();

    // Safety net: if the background stream dies silently, never stay stuck in loading
    this.clearLoadTimer();
    this.loadTimer = setTimeout(() => {
      this.isLoading = false;
      this.renderAll();
    }, 20000);

    try {
      const msg: ExtensionMessage = {
        type: 'FETCH_LOBBY_INSIGHT',
        payload: { matchId, forceRefresh },
      };

      const res: MessageResponse<LobbyAnalysisPayload> = await chrome.runtime.sendMessage(msg);

      if (matchId !== this.currentMatchId) return;

      if (res && res.success && res.data) {
        this.lobbyPayload = res.data;
        this.retryCount = 0;
        if (!this.lobbyPayload.isPartial) {
          this.isLoading = false;
          if (!this.isDomFallback) {
            autoActionsEngine.checkAndExecute(
              this.settings,
              this.lobbyPayload.match.server_ip,
              undefined,
              this.lobbyPayload.match.status,
              this.userTeamName
            );
          }
        }
      } else {
        console.warn('[f-insight:Content] Failed to load lobby data:', res?.error);
        this.handleFetchFailure(matchId);
      }
    } catch (err) {
      if (matchId !== this.currentMatchId) return;
      console.error('[f-insight:Content] Error sending message to background:', err);
      this.handleFetchFailure(matchId);
    } finally {
      if (matchId === this.currentMatchId) {
        this.clearLoadTimer();
        this.renderAll();
      }
    }
  }

  private handleFetchFailure(matchId: string) {
    if (matchId !== this.currentMatchId) return;

    // Always render something: DOM-derived skeleton so the widget mounts even
    // when api.faceit.com is unreachable (Cloudflare/rate-limits).
    if (!this.lobbyPayload?.match || this.lobbyPayload.isPartial) {
      const fallback = this.buildDomFallbackPayload();
      if (fallback) {
        this.lobbyPayload = fallback;
      }
    }
    this.isLoading = false;

    // Automatic retries with backoff in case the API hiccup is transient.
    if (this.retryCount < 2) {
      this.retryCount++;
      this.retryTimer = setTimeout(() => {
        if (matchId === this.currentMatchId) {
          this.fetchLobbyData(matchId, true);
        }
      }, this.retryCount === 1 ? 5000 : 15000);
    }
  }

  /** DOM-observer callback; also re-armed after dormancy wake-ups. */
  private handleDomUpdate() {
    if (this.isDormant) return;

    if (this.lobbyPayload?.match) {
      if (!this.lobbyPayload.match.server_ip) {
        const liveIp = this.domObserver.findServerIpFromDom();
        if (liveIp) {
          this.lobbyPayload.match.server_ip = liveIp;
        }
      }
    }

    // autoActions runs on the 800ms interval below — never inside the observer tick
    if (this.currentMatchId && this.lobbyPayload) {
      this.renderAll();
    }
  }

  /**
   * Full dormancy outside match rooms when `disableOnHomeScreen` is enabled:
   * no DOM scanning, no widgets, no automations on the homepage / profile /
   * matchmaking pages. Entering a match room wakes everything back up.
   */
  private applyDormancy(matchId: string | null = this.currentMatchId) {
    const shouldBeDormant = this.settings.disableOnHomeScreen && !matchId;
    if (shouldBeDormant === this.isDormant) return;

    if (shouldBeDormant) {
      this.isDormant = true;
      try {
        this.domObserver.stopObserving();
      } catch (err) {
        console.warn('[f-insight:Content] Failed to stop DOM observer for dormancy:', err);
      }
      this.cleanup();
      console.log('[f-insight:Content] Dormant — disabled outside match rooms');
    } else {
      this.isDormant = false;
      try {
        this.domObserver.startObserving(() => this.handleDomUpdate());
      } catch (err) {
        console.warn('[f-insight:Content] Failed to resume DOM observer:', err);
      }
      console.log('[f-insight:Content] Awake — match room detected');
    }
  }

  private renderAll(forceRender: boolean = false) {
    const payloadChanged = forceRender ||
      this.lastRenderPayload !== this.lobbyPayload ||
      this.lastRenderIsVisible !== this.isVisible ||
      this.lastRenderShowVetoMatrix !== this.showVetoMatrix ||
      this.lastRenderActiveFlyoutId !== this.activePlayerFlyoutId ||
      this.lastRenderIsLoading !== this.isLoading;

    const targetsDirty = this.domObserver.consumeTargetsDirty();

    if (payloadChanged) {
      if (!this.currentUser && this.lobbyPayload?.match) {
        this.currentUser = detectCurrentPlayer(
          this.lobbyPayload.match.teams?.faction1?.roster || [],
          this.lobbyPayload.match.teams?.faction2?.roster || []
        );
      }

      // Compute the map veto ranking once per payload state and share it with all consumers
      this.vetoRanking = this.buildVetoRanking() || [];
      this.lastRenderPayload = this.lobbyPayload;
      this.lastRenderIsVisible = this.isVisible;
      this.lastRenderShowVetoMatrix = this.showVetoMatrix;
      this.lastRenderActiveFlyoutId = this.activePlayerFlyoutId;
      this.lastRenderIsLoading = this.isLoading;
    }

    // Self-heal: if FACEIT re-renders and replaces the mount container, the widget
    // host is lost even though the payload is unchanged — re-create it then.
    const mainHostAlive = !!document.getElementById('f-insight-main-host')?.isConnected;
    this.renderMainWidget(payloadChanged || !mainHostAlive);
    if (payloadChanged || targetsDirty) {
      this.renderPlayerBadges();
    }
    this.renderModal(payloadChanged);
    this.renderFloatingControls(payloadChanged);
  }

  private renderMainWidget(forceRender: boolean = true) {
    if (!this.currentMatchId || !this.lobbyPayload) return;

    const mountPoint = this.domObserver.findMatchHeaderMountPoint();
    if (!mountPoint) return;

    const hostId = 'f-insight-main-host';
    let host = document.getElementById(hostId);
    if (!host) {
      const shadow = createShadowContainer(hostId);
      shadow.host.style.cssText = 'all: initial; display: block; width: 100%; max-width: 1200px; margin: 12px auto; box-sizing: border-box; font-family: Inter, system-ui, sans-serif;';
      mountPoint.prepend(shadow.host);
      this.mainRoot = createRoot(shadow.container);
      forceRender = true;
    }

    if (this.mainRoot && forceRender) {
      this.mainRoot.render(
        <React.StrictMode>
          <LobbyWidget
            payload={this.lobbyPayload}
            isLoading={this.isLoading}
            currentUser={this.currentUser || undefined}
            onRefresh={() => this.currentMatchId && this.fetchLobbyData(this.currentMatchId, true)}
            isVisible={this.isVisible}
            onToggleVisibility={() => {
              this.isVisible = !this.isVisible;
              this.renderAll();
            }}
            showVetoMatrix={this.showVetoMatrix}
            onToggleVetoMatrix={() => {
              this.showVetoMatrix = !this.showVetoMatrix;
              this.renderAll();
            }}
            settings={this.settings}
            rankedMaps={this.vetoRanking}
          />
        </React.StrictMode>
      );
    }
  }

  private renderPlayerBadges() {
    if (!this.lobbyPayload || this.isDormant) return;

    const playerTargets = this.domObserver.findPlayerElements(
      this.lobbyPayload.match?.teams
        ? [
            ...(this.lobbyPayload.match.teams.faction1?.roster || []),
            ...(this.lobbyPayload.match.teams.faction2?.roster || []),
          ].map((r) => r.nickname)
        : []
    );
    const allRoster = [
      ...(this.lobbyPayload.match.teams?.faction1?.roster || []),
      ...(this.lobbyPayload.match.teams?.faction2?.roster || []),
    ];

    if (playerTargets.length === 0 && allRoster.length > 0 && !this.warnedZeroTargets) {
      // Markup-drift diagnostics: payload knows the roster but the DOM scan
      // found nothing — log once so the console explains missing badges.
      this.warnedZeroTargets = true;
      console.warn(
        `[f-insight:Content] 0/${allRoster.length} player rows located in DOM — FACEIT markup may have changed; text-based fallback also failed`
      );
    }

    for (const target of playerTargets) {
      // Match by nickname OR by the account UUID carried in profile links —
      // newer FACEIT builds may link by id instead of the nickname segment.
      const rosterItem = allRoster.find(
        (r) =>
          (target.nickname && r.nickname.toLowerCase() === target.nickname.toLowerCase()) ||
          (!!target.playerId && r.player_id === target.playerId)
      );
      if (!rosterItem) continue;

      const pId = rosterItem.player_id;
      // A player row exists both in the roster and (while open) inside FACEIT's
      // profile popup. Each location gets its OWN shadow host and React root —
      // the previous single-root-per-player logic moved the roster badge into
      // the popup and the roster badge vanished until the popup closed.
      const inProfileModal = !!target.element.closest(
        '[class*="players-modal"], [class*="PlayersModal"], [role="dialog"], [class*="popover"], [class*="Popover"]'
      );
      // pId may contain characters that break CSS selectors (e.g. "dom:nick") —
      // sanitize for the host id while keeping the location key unique.
      const sanitizedId = pId.replace(/[^a-zA-Z0-9_-]/g, '');
      const locationSuffix = inProfileModal ? '-profile-modal' : '';
      const hostId = `f-insight-player-${sanitizedId}${locationSuffix}`;
      const rootKey = `${pId}${locationSuffix}`;

      let host = target.element.querySelector(`:scope > #${hostId}`) as HTMLElement;
      let root = this.playerRoots.get(rootKey);
      let isNewlyCreated = false;

      if (!host) {
        if (root) {
          try {
            root.unmount();
          } catch (e) {}
          this.playerRoots.delete(rootKey);
        }
        const shadow = createShadowContainer(hostId);
        shadow.host.style.cssText = `all: initial; display: ${this.isVisible ? 'block' : 'none'}; width: 100%; box-sizing: border-box; font-family: Inter, system-ui, sans-serif; z-index: 10; margin-top: 6px;`;
        target.element.appendChild(shadow.host);
        root = createRoot(shadow.container);
        this.playerRoots.set(rootKey, root);
        host = shadow.host;
        isNewlyCreated = true;
      } else {
        host.style.display = this.isVisible ? 'block' : 'none';
      }

      const stats = this.lobbyPayload.playersStats?.[pId];

      if (root && this.isVisible) {
        // Re-render only when newly created or this player's data actually changed
        if (isNewlyCreated || this.playerRenderedState.get(rootKey) !== stats) {
          const steam = this.lobbyPayload.steamData?.[pId];
          const risk = this.settings.enableRedFlags ? this.lobbyPayload.riskAnalysis?.[pId] : undefined;
          const premade = this.settings.enablePremadeDetection
            ? (this.lobbyPayload.premadeGroups || []).find((g) => g.playerIds.includes(pId))
            : undefined;
          const isUser = this.currentUser?.playerId === pId ||
            (Boolean(this.currentUser?.nickname) && this.currentUser?.nickname?.toLowerCase() === rosterItem.nickname.toLowerCase());

          root.render(
            <React.StrictMode>
              <PlayerBadge
                playerId={pId}
                stats={stats}
                steam={steam}
                risk={risk}
                premadeGroup={premade}
                isCurrentUser={isUser}
                showFcr={this.settings.showFcrRating}
                showForm={this.settings.showFormIndicators}
                compact={this.settings.compactMode || inProfileModal}
                onOpenDetails={(id) => {
                  this.activePlayerFlyoutId = id;
                  this.renderModal(true);
                }}
              />
            </React.StrictMode>
          );

          this.playerRenderedState.set(rootKey, stats);
        }
      }
    }
  }

  private renderModal(forceRender: boolean = true) {
    const hostId = 'f-insight-modal-host';
    const pStats = this.activePlayerFlyoutId
      ? this.lobbyPayload?.playersStats?.[this.activePlayerFlyoutId]
      : undefined;

    if (!this.activePlayerFlyoutId || !pStats) {
      if (this.modalRoot) {
        this.modalRoot.unmount();
        this.modalRoot = null;
      }
      const host = document.getElementById(hostId);
      if (host) host.remove();
      return;
    }

    let host = document.getElementById(hostId);
    if (!host) {
      const shadow = createShadowContainer(hostId);
      shadow.host.style.cssText = 'all: initial; position: fixed; inset: 0; z-index: 999999; display: flex; align-items: center; justify-content: center; pointer-events: auto; font-family: Inter, system-ui, sans-serif;';
      document.body.appendChild(shadow.host);
      this.modalRoot = createRoot(shadow.container);
      forceRender = true;
    }

    const sData = this.lobbyPayload?.steamData?.[this.activePlayerFlyoutId];
    const rData = this.lobbyPayload?.riskAnalysis?.[this.activePlayerFlyoutId];

    if (this.modalRoot && pStats && forceRender) {
      this.modalRoot.render(
        <React.StrictMode>
          <PlayerDetailFlyout
            stats={pStats}
            steam={sData}
            risk={rData}
            onClose={() => {
              this.activePlayerFlyoutId = null;
              this.renderModal(true);
            }}
          />
        </React.StrictMode>
      );
    }
  }

  private renderFloatingControls(forceRender: boolean = true) {
    const hostId = 'f-insight-floating-host';
    let host = document.getElementById(hostId);

    if (!this.currentMatchId || !this.settings.enableFloatingControls) {
      if (this.floatingRoot) {
        this.floatingRoot.unmount();
        this.floatingRoot = null;
      }
      if (host) host.remove();
      return;
    }

    if (!host) {
      const shadow = createShadowContainer(hostId);
      // The host itself is the fixed anchor: `contain: content` on the shadow
      // container makes it a containing block for position:fixed descendants,
      // so the FAB must live on the host (same pattern as the modal host).
      shadow.host.style.cssText =
        'all: initial; position: fixed; bottom: 24px; right: 24px; z-index: 99999; display: flex; flex-direction: column; align-items: flex-end; gap: 0; pointer-events: auto; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;';
      document.body.appendChild(shadow.host);
      this.floatingRoot = createRoot(shadow.container);
      forceRender = true;
    }

    const highRiskCount = this.settings.enableRedFlags
      ? this.lobbyPayload
        ? Object.values(this.lobbyPayload.riskAnalysis || {}).filter(
            (r) => r.level === 'HIGH' || r.level === 'CRITICAL'
          ).length
        : 0
      : 0;

    if (this.floatingRoot && forceRender) {
      this.floatingRoot.render(
        <React.StrictMode>
          <QuickControls
            onRefresh={() => this.currentMatchId && this.fetchLobbyData(this.currentMatchId, true)}
            isLoading={this.isLoading}
            isVisible={this.isVisible}
            onToggleVisibility={() => {
              this.isVisible = !this.isVisible;
              this.renderAll();
            }}
            highRiskCount={highRiskCount}
          />
        </React.StrictMode>
      );
    }
  }

  private cleanup() {
    // NOTE: do NOT stop the domObserver or spaWatcher here — they are required
    // to re-detect and re-render when the user navigates back into a match room.
    this.lobbyPayload = null;
    this.activePlayerFlyoutId = null;
    this.currentUser = null;
    this.vetoRanking = [];
    this.retryCount = 0;
    this.warnedZeroTargets = false;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.clearLoadTimer();

    if (this.mainRoot) {
      try {
        this.mainRoot.unmount();
      } catch (e) {}
      this.mainRoot = null;
    }

    this.playerRoots.forEach((root) => {
      try {
        root.unmount();
      } catch (e) {
        // Ignore already unmounted
      }
    });
    this.playerRoots.clear();

    if (this.modalRoot) {
      try {
        this.modalRoot.unmount();
      } catch (e) {}
      this.modalRoot = null;
    }

    if (this.floatingRoot) {
      try {
        this.floatingRoot.unmount();
      } catch (e) {}
      this.floatingRoot = null;
    }

    ['f-insight-main-host', 'f-insight-modal-host', 'f-insight-floating-host'].forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.isConnected) {
        try {
          el.remove();
        } catch (e) {}
      }
    });
    document.querySelectorAll('[id^="f-insight-player-"]').forEach((el) => {
      if (el.isConnected) {
        try {
          el.remove();
        } catch (e) {}
      }
    });
  }
}

const engine = new ContentEngine();
engine.init();
