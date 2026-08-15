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
import '../styles/tailwind.css';

class ContentEngine {
  private spaWatcher = new SpaWatcher();
  private domObserver = new DomObserver();
  private currentMatchId: string | null = null;
  private lobbyPayload: LobbyAnalysisPayload | null = null;
  private settings: ExtensionSettings = { ...DEFAULT_SETTINGS };
  private isLoading: boolean = false;
  private isVisible: boolean = true;
  private showVetoMatrix: boolean = true;
  private activePlayerFlyoutId: string | null = null;

  // React Roots
  private mainRoot: Root | null = null;
  private playerRoots: Map<string, Root> = new Map();
  private modalRoot: Root | null = null;
  private floatingRoot: Root | null = null;

  async init() {
    console.log('[f-insight:Content] Initialized content script');
    await this.loadSettings();

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
      if (this.lobbyPayload?.match && !this.lobbyPayload.match.server_ip) {
        const liveIp = this.domObserver.findServerIpFromDom();
        if (liveIp) {
          this.lobbyPayload.match.server_ip = liveIp;
        }
      }

      autoActionsEngine.checkAndExecute(this.settings, this.lobbyPayload?.match?.server_ip);

      if (this.currentMatchId && this.lobbyPayload) {
        this.renderAll();
      }
    });

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
    this.isLoading = true;
    this.renderMainWidget();

    try {
      const msg: ExtensionMessage = {
        type: 'FETCH_LOBBY_INSIGHT',
        payload: { matchId, forceRefresh },
      };

      const res: MessageResponse<LobbyAnalysisPayload> = await chrome.runtime.sendMessage(msg);

      if (res && res.success && res.data) {
        this.lobbyPayload = res.data;
        autoActionsEngine.checkAndExecute(this.settings, this.lobbyPayload.match.server_ip);
      } else {
        console.warn('[f-insight:Content] Failed to load lobby data:', res?.error);
      }
    } catch (err) {
      console.error('[f-insight:Content] Error sending message to background:', err);
    } finally {
      this.isLoading = false;
      this.renderAll();
    }
  }

  private renderAll() {
    this.renderMainWidget();
    this.renderPlayerBadges();
    this.renderModal();
    this.renderFloatingControls();
  }

  private renderMainWidget() {
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
    }

    if (this.mainRoot) {
      this.mainRoot.render(
        <React.StrictMode>
          <LobbyWidget
            payload={this.lobbyPayload}
            isLoading={this.isLoading}
            onRefresh={() => this.currentMatchId && this.fetchLobbyData(this.currentMatchId, true)}
            showVetoMatrix={this.showVetoMatrix}
            onToggleVetoMatrix={() => {
              this.showVetoMatrix = !this.showVetoMatrix;
              this.renderAll();
            }}
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

      if (!host) {
        const shadow = createShadowContainer(hostId);
        shadow.host.style.cssText = 'all: initial; display: block; width: 100%; box-sizing: border-box; font-family: Inter, system-ui, sans-serif; z-index: 10; margin-top: 6px;';
        target.element.appendChild(shadow.host);
        root = createRoot(shadow.container);
        this.playerRoots.set(pId, root);
      }

      if (root) {
        const stats = this.lobbyPayload.playersStats[pId];
        const steam = this.lobbyPayload.steamData[pId];
        const risk = this.lobbyPayload.riskAnalysis[pId];
        const premade = this.lobbyPayload.premadeGroups.find((g) => g.playerIds.includes(pId));

        root.render(
          <React.StrictMode>
            <PlayerBadge
              playerId={pId}
              stats={stats}
              steam={steam}
              risk={risk}
              premadeGroup={premade}
              selectedMap={this.lobbyPayload.match.selected_map}
              onOpenDetails={(id) => {
                this.activePlayerFlyoutId = id;
                this.renderModal();
              }}
            />
          </React.StrictMode>
        );
      }
    }
  }

  private renderModal() {
    const hostId = 'f-insight-modal-host';
    let host = document.getElementById(hostId);

    if (!this.activePlayerFlyoutId || !this.lobbyPayload) {
      if (host) host.remove();
      this.modalRoot = null;
      return;
    }

    if (!host) {
      const shadow = createShadowContainer(hostId);
      shadow.host.style.cssText = 'all: initial; position: fixed; inset: 0; z-index: 999999; display: flex; align-items: center; justify-content: center; pointer-events: auto; font-family: Inter, system-ui, sans-serif;';
      document.body.appendChild(shadow.host);
      this.modalRoot = createRoot(shadow.container);
    }

    const pStats = this.lobbyPayload.playersStats[this.activePlayerFlyoutId];
    const sData = this.lobbyPayload.steamData[this.activePlayerFlyoutId];
    const rData = this.lobbyPayload.riskAnalysis[this.activePlayerFlyoutId];

    if (this.modalRoot && pStats) {
      this.modalRoot.render(
        <React.StrictMode>
          <PlayerDetailFlyout
            stats={pStats}
            steam={sData}
            risk={rData}
            onClose={() => {
              this.activePlayerFlyoutId = null;
              this.renderModal();
            }}
          />
        </React.StrictMode>
      );
    }
  }

  private renderFloatingControls() {
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
    }

    const highRiskCount = this.lobbyPayload
      ? Object.values(this.lobbyPayload.riskAnalysis).filter(
          (r) => r.level === 'HIGH' || r.level === 'CRITICAL'
        ).length
      : 0;

    if (this.floatingRoot) {
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
    this.lobbyPayload = null;
    this.activePlayerFlyoutId = null;

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

    document.getElementById('f-insight-main-host')?.remove();
    document.getElementById('f-insight-modal-host')?.remove();
    document.querySelectorAll('[id^="f-insight-player-"]').forEach((el) => el.remove());
  }
}

const engine = new ContentEngine();
engine.init();
