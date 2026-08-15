import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { SpaWatcher } from './spaWatcher';
import { DomObserver } from './domObserver';
import { createShadowContainer } from './shadowRoot';
import { autoActionsEngine } from './autoActions';
import { LobbyAnalysisPayload, ExtensionMessage, MessageResponse } from '../types/messages';
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
  private isLoading: boolean = false;
  private isVisible: boolean = true;
  private showVetoMatrix: boolean = true;
  private activePlayerFlyoutId: string | null = null;
  private loadTimer: ReturnType<typeof setTimeout> | null = null;
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
  private playerRenderedState = new Map<string, boolean>();

  async init() {
    console.log('[f-insight:Content] Initialized content script');
    await this.loadSettings();

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.settings?.newValue) {
        const raw = changes.settings.newValue;
        // Settings are persisted through cacheManager as a { value, cachedAt, ttlMs } wrapper
        const stored = raw && typeof raw === 'object' && !Array.isArray(raw) && 'value' in raw ? raw.value : raw;
        this.settings = { ...DEFAULT_SETTINGS, ...stored };
        this.playerRenderedState.clear();
        this.renderAll(true);
      }
    });

    this.spaWatcher.onUrlChange((_url, matchId) => {
      if (matchId !== this.currentMatchId) {
        this.currentMatchId = matchId;
        this.activePlayerFlyoutId = null;
        autoActionsEngine.resetForNewMatch();

        if (matchId) {
          this.fetchLobbyData(matchId);
        } else {
          this.cleanup();
        }
      }
    });

    this.domObserver.startObserving(() => {
      if (this.lobbyPayload?.match) {
        if (!this.lobbyPayload.match.server_ip) {
          const liveIp = this.domObserver.findServerIpFromDom();
          if (liveIp) {
            this.lobbyPayload.match.server_ip = liveIp;
          }
        }
      }

      autoActionsEngine.checkAndExecute(
        this.settings,
        this.lobbyPayload?.match?.server_ip,
        this.settings.autoVetoMaps ? this.vetoRanking : undefined
      );

      if (this.currentMatchId && this.lobbyPayload) {
        this.renderAll();
      }
    });

    // Periodic safety check for instant Auto Ready-Up and QoL automations.
    // Gated on tab visibility and match room presence to avoid burning CPU elsewhere.
    window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (!this.currentMatchId) return;
      autoActionsEngine.checkAndExecute(
        this.settings,
        this.lobbyPayload?.match?.server_ip,
        this.settings.autoVetoMaps ? this.vetoRanking : undefined
      );
    }, 800);

    this.renderFloatingControls();

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
        this.clearLoadTimer();
        this.renderAll();
        autoActionsEngine.checkAndExecute(this.settings, this.lobbyPayload?.match?.server_ip);
      }
      if (msg.type === 'LOBBY_ANALYSIS_ERROR') {
        if (msg.payload?.matchId !== this.currentMatchId) return;
        this.isLoading = false;
        this.clearLoadTimer();
        this.renderAll();
      }
    });
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
    }, 60000);

    try {
      const msg: ExtensionMessage = {
        type: 'FETCH_LOBBY_INSIGHT',
        payload: { matchId, forceRefresh },
      };

      const res: MessageResponse<LobbyAnalysisPayload> = await chrome.runtime.sendMessage(msg);

      if (matchId !== this.currentMatchId) return;

      if (res && res.success && res.data) {
        this.lobbyPayload = res.data;
        if (!this.lobbyPayload.isPartial) {
          this.isLoading = false;
          autoActionsEngine.checkAndExecute(this.settings, this.lobbyPayload.match.server_ip);
        }
      } else {
        console.warn('[f-insight:Content] Failed to load lobby data:', res?.error);
        this.isLoading = false;
      }
    } catch (err) {
      if (matchId !== this.currentMatchId) return;
      console.error('[f-insight:Content] Error sending message to background:', err);
      this.isLoading = false;
    } finally {
      if (matchId === this.currentMatchId) {
        this.clearLoadTimer();
        this.renderAll();
      }
    }
  }

  private renderAll(forceRender: boolean = false) {
    const stateChanged = forceRender ||
      this.lastRenderPayload !== this.lobbyPayload ||
      this.lastRenderIsVisible !== this.isVisible ||
      this.lastRenderShowVetoMatrix !== this.showVetoMatrix ||
      this.lastRenderActiveFlyoutId !== this.activePlayerFlyoutId ||
      this.lastRenderIsLoading !== this.isLoading;

    if (!this.currentUser && this.lobbyPayload?.match) {
      this.currentUser = detectCurrentPlayer(
        this.lobbyPayload.match.teams?.faction1?.roster || [],
        this.lobbyPayload.match.teams?.faction2?.roster || []
      );
    }

    if (stateChanged) {
      // Compute the map veto ranking once per payload state and share it with all consumers
      this.vetoRanking = this.buildVetoRanking() || [];
      this.playerRenderedState.clear();
      this.lastRenderPayload = this.lobbyPayload;
      this.lastRenderIsVisible = this.isVisible;
      this.lastRenderShowVetoMatrix = this.showVetoMatrix;
      this.lastRenderActiveFlyoutId = this.activePlayerFlyoutId;
      this.lastRenderIsLoading = this.isLoading;
    }

    this.renderMainWidget(stateChanged);
    this.renderPlayerBadges();
    this.renderModal(stateChanged);
    this.renderFloatingControls(stateChanged);
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
    if (!this.lobbyPayload) return;

    const playerTargets = this.domObserver.findPlayerElements();
    const allRoster = [
      ...(this.lobbyPayload.match.teams?.faction1?.roster || []),
      ...(this.lobbyPayload.match.teams?.faction2?.roster || []),
    ];

    for (const target of playerTargets) {
      const rosterItem = allRoster.find(
        (r) => r.nickname.toLowerCase() === target.nickname.toLowerCase()
      );
      if (!rosterItem) continue;

      const pId = rosterItem.player_id;
      const hostId = `f-insight-player-${pId}`;

      let host = target.element.querySelector(`#${hostId}`) as HTMLElement;
      let root = this.playerRoots.get(pId);
      let isNewlyCreated = false;

      if (!host) {
        if (root) {
          try {
            root.unmount();
          } catch (e) {}
          this.playerRoots.delete(pId);
        }
        const shadow = createShadowContainer(hostId);
        shadow.host.style.cssText = `all: initial; display: ${this.isVisible ? 'block' : 'none'}; width: 100%; box-sizing: border-box; font-family: Inter, system-ui, sans-serif; z-index: 10; margin-top: 6px;`;
        target.element.appendChild(shadow.host);
        root = createRoot(shadow.container);
        this.playerRoots.set(pId, root);
        host = shadow.host;
        isNewlyCreated = true;
      } else {
        host.style.display = this.isVisible ? 'block' : 'none';
      }

      if (root && this.isVisible) {
        // Only render if newly created or global state was reset for this player
        if (isNewlyCreated || !this.playerRenderedState.get(pId)) {
          const stats = this.lobbyPayload.playersStats?.[pId];
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
                selectedMap={this.lobbyPayload.match.selected_map}
                isCurrentUser={isUser}
                showFcr={this.settings.showFcrRating}
                showForm={this.settings.showFormIndicators}
                compact={this.settings.compactMode}
                onOpenDetails={(id) => {
                  this.activePlayerFlyoutId = id;
                  this.renderModal(true);
                }}
              />
            </React.StrictMode>
          );
          
          this.playerRenderedState.set(pId, true);
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
      const host = document.getElementById(hostId);
      if (host) host.remove();
      if (this.modalRoot) {
        this.modalRoot.unmount();
        this.modalRoot = null;
      }
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
    this.clearLoadTimer();

    if (this.mainRoot) {
      this.mainRoot.unmount();
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
      this.modalRoot.unmount();
      this.modalRoot = null;
    }

    if (this.floatingRoot) {
      this.floatingRoot.unmount();
      this.floatingRoot = null;
    }

    document.getElementById('f-insight-main-host')?.remove();
    document.getElementById('f-insight-modal-host')?.remove();
    document.getElementById('f-insight-floating-host')?.remove();
    document.querySelectorAll('[id^="f-insight-player-"]').forEach((el) => el.remove());
  }
}

const engine = new ContentEngine();
engine.init();
