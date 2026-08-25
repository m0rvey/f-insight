import {
  ExtensionMessage,
  LobbyAnalysisPayload,
  MessageResponse,
} from '../types/messages';
import { ExtensionSettings, DEFAULT_SETTINGS } from '../types/settings';
import { cacheManager, TTL, SETTINGS_KEY } from '../services/cacheManager';
import { faceitApi } from '../services/faceitApi';
import { steamApi } from '../services/steamApi';
import { calculateRiskScore } from '../services/riskScorer';
import { detectPremades } from '../services/premadeDetector';
import {
  calculateProjectedElo,
  calculateTeamFcr,
  calculateAdvancedMatchPrediction,
} from '../services/forecastEngine';
import { FaceitPlayerFullStats } from '../types/faceit';
import { SteamFullData } from '../types/steam';
import { RiskAnalysisResult } from '../types/risk';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs async work over a list with a limited number of concurrent workers.
 * A small delay after each item smooths the request burst so we never trip
 * Cloudflare rate-limits on api.faceit.com (FACEIT's own page requests —
 * player popovers/profiles — fail with "Action Failed" when the domain is
 * throttled).
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  delayMs = 150
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
      if (delayMs > 0) await sleep(delayMs);
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

export class BackgroundMessageHandler {
  private settings: ExtensionSettings = { ...DEFAULT_SETTINGS };
  private initialized = false;
  private inFlightStreams = new Map<string, Promise<void>>();
  private streamSubscribers = new Map<string, Set<number>>();

  async init() {
    if (this.initialized) return;
    await this.loadSettings();
    this.initialized = true;
    // Opportunistic cache cleanup on startup
    cacheManager.cleanup().catch(() => {});
  }

  async loadSettings(): Promise<ExtensionSettings> {
    const cached = await cacheManager.get<ExtensionSettings>(SETTINGS_KEY);
    if (cached) {
      this.settings = { ...DEFAULT_SETTINGS, ...cached };
    }
    return this.settings;
  }

  async handleMessage(
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender
  ): Promise<MessageResponse> {
    try {
      switch (message.type) {
        case 'GET_SETTINGS':
          return this.handleGetSettings();
        case 'SAVE_SETTINGS':
          return this.handleSaveSettings(message.payload);
        case 'FETCH_LOBBY_INSIGHT':
          return this.handleFetchLobbyInsight(message.payload, _sender);
        case 'GET_CACHE_STATS':
          return this.handleGetCacheStats();
        case 'CLEAR_CACHE':
          return this.handleClearCache();
        default:
          return { success: false, error: 'Unknown message type' };
      }
    } catch (err: any) {
      console.error('[f-insight:Background] Message handler error:', err);
      return { success: false, error: err.message || 'Internal error' };
    }
  }

  private async handleGetSettings(): Promise<MessageResponse> {
    const settings = await this.loadSettings();
    return { success: true, data: settings };
  }

  private async handleSaveSettings(payload: any): Promise<MessageResponse> {
    // Whitelist merge: the message originates from the content script, so the
    // payload must not inject arbitrary keys/types into stored settings.
    const sanitized: Partial<ExtensionSettings> = {};
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof ExtensionSettings)[]) {
      if (payload && typeof payload === 'object' && key in payload) {
        const defaultValue = DEFAULT_SETTINGS[key];
        const incoming = payload[key];
        // Accept only values matching the default's primitive type
        if (typeof incoming === typeof defaultValue) {
          (sanitized as Record<string, unknown>)[key] = incoming;
        }
      }
    }
    this.settings = { ...this.settings, ...sanitized };
    await cacheManager.set(SETTINGS_KEY, this.settings, TTL.SETTINGS);
    return { success: true, data: this.settings };
  }

  private async handleFetchLobbyInsight(payload: any, sender?: chrome.runtime.MessageSender): Promise<MessageResponse> {
    const { matchId, forceRefresh } = payload;
    const cacheKey = `match_analysis:${matchId}`;

    if (!forceRefresh) {
      const cachedPayload = await cacheManager.get<LobbyAnalysisPayload>(cacheKey);
      if (cachedPayload && !cachedPayload.isPartial) {
        return { success: true, data: cachedPayload };
      }
    }

    const match = await faceitApi.getMatchDetails(matchId);
    if (!match) {
      return { success: false, error: `Could not fetch match details for ${matchId}` };
    }

    // Register tab subscriber for live updates
    if (sender?.tab?.id) {
      if (!this.streamSubscribers.has(matchId)) {
        this.streamSubscribers.set(matchId, new Set());
      }
      this.streamSubscribers.get(matchId)!.add(sender.tab.id);
    }

    // Start or attach to background streaming
    if (!this.inFlightStreams.has(matchId) || forceRefresh) {
      const streamPromise = this.streamLobbyData(matchId, match, forceRefresh).finally(() => {
        // Only remove our own entry: a forceRefresh may have replaced this
        // stream with a newer one while we were still running.
        if (this.inFlightStreams.get(matchId) === streamPromise) {
          this.inFlightStreams.delete(matchId);
        }
        this.streamSubscribers.delete(matchId);
      });
      this.inFlightStreams.set(matchId, streamPromise);
    }

    return { success: true, data: { match, isPartial: true } };
  }

  private async streamLobbyData(matchId: string, match: any, forceRefresh: boolean) {
    try {
      await this.streamLobbyDataInner(matchId, match, forceRefresh);
    } catch (err: any) {
      console.error('[f-insight:Stream] Error:', err);
      this.broadcastToSubscribers(matchId, {
        type: 'LOBBY_ANALYSIS_ERROR',
        payload: { matchId, error: err?.message || 'Match analysis stream failed' },
      });
    }
  }

  private broadcastToSubscribers(matchId: string, message: any) {
    const tabs = this.streamSubscribers.get(matchId);
    if (!tabs || tabs.size === 0) return;
    for (const tabId of tabs) {
      this.safeSendToTab(tabId, message);
    }
  }

  private async streamLobbyDataInner(matchId: string, match: any, forceRefresh: boolean) {
    const cacheKey = `match_analysis:${matchId}`;
    const f1Roster = match.teams?.faction1?.roster || [];
    const f2Roster = match.teams?.faction2?.roster || [];
    const allPlayers = [...f1Roster, ...f2Roster];

    const playersStats: Record<string, FaceitPlayerFullStats> = {};
    const steamData: Record<string, SteamFullData> = {};
    const riskAnalysis: Record<string, RiskAnalysisResult> = {};

    // Fetch all players with bounded concurrency (3 workers + small delay between
    // requests) to avoid rate-limiting api.faceit.com with a 20-request burst.
    await mapWithConcurrency(
      allPlayers,
      3,
      async (player) => {
        const pId = player.player_id;
        if (!pId) return;

        // 1. Player Stats
        const pCacheKey = `player_stats:${pId}`;
        let pStats: FaceitPlayerFullStats | null = null;

        if (!forceRefresh) {
          pStats = await cacheManager.get<FaceitPlayerFullStats>(pCacheKey);
        }

        if (!pStats) {
          pStats = await faceitApi.getPlayerStats(pId, player.nickname);
          if (pStats) {
            // Partial payloads (stats endpoints failed → fabricated defaults)
            // get a short negative TTL so a wrong "fresh account" snapshot is
            // re-fetched quickly instead of poisoning the lobby for an hour.
            const ttl = pStats.statsAvailable === false ? TTL.NEGATIVE : TTL.PLAYER_STATS;
            await cacheManager.set(pCacheKey, pStats, ttl);
          }
        }

        if (pStats) {
          playersStats[pId] = pStats;

          // 2. Steam Data
          const steamId = pStats.steamId64 || player.game_player_id;
          if (steamId) {
            const sCacheKey = `steam_data:${steamId}`;
            let sData: SteamFullData | null = null;

            if (!forceRefresh) {
              sData = await cacheManager.get<SteamFullData>(sCacheKey);
            }

            if (!sData) {
              sData = await steamApi.getPlayerFullData(steamId);
              // Never cache error results (rate-limit / network): retry on the next fetch
              if (sData && !sData.fetchError) {
                await cacheManager.set(sCacheKey, sData, TTL.STEAM_PROFILE);
              }
            }

            if (sData) {
              steamData[pId] = sData;
            }
          }

          // 3. Red Flags Risk Score
          riskAnalysis[pId] = calculateRiskScore(pStats, steamData[pId]);

          this.broadcastToSubscribers(matchId, {
            type: 'PLAYER_STATS_UPDATE',
            payload: { matchId, playerId: pId, stats: pStats, steam: steamData[pId], risk: riskAnalysis[pId] },
          });
        }
      },
      200
    );

    // Calculate Team Elo and Probabilities
    const f1Elos = f1Roster.map((p: any) => playersStats[p.player_id]?.elo || p.elo || 1000);
    const f2Elos = f2Roster.map((p: any) => playersStats[p.player_id]?.elo || p.elo || 1000);

    const f1TotalElo = f1Elos.reduce((a: number, b: number) => a + b, 0);
    const f2TotalElo = f2Elos.reduce((a: number, b: number) => a + b, 0);
    const f1AvgElo = f1Elos.length > 0 ? Math.round(f1TotalElo / f1Elos.length) : 1000;
    const f2AvgElo = f2Elos.length > 0 ? Math.round(f2TotalElo / f2Elos.length) : 1000;

    const eloDiff = f1AvgElo - f2AvgElo;

    // Projected Elo (+/-)
    const projectedEloStakes = calculateProjectedElo(f1AvgElo, f2AvgElo);

    const f1Kds = f1Roster.map((p: any) => playersStats[p.player_id]?.last30Kd ?? playersStats[p.player_id]?.overallKd ?? 1.0);
    const f2Kds = f2Roster.map((p: any) => playersStats[p.player_id]?.last30Kd ?? playersStats[p.player_id]?.overallKd ?? 1.0);
    const f1AvgKd = f1Kds.length > 0 ? parseFloat((f1Kds.reduce((a: number, b: number) => a + b, 0) / f1Kds.length).toFixed(2)) : 1.0;
    const f2AvgKd = f2Kds.length > 0 ? parseFloat((f2Kds.reduce((a: number, b: number) => a + b, 0) / f2Kds.length).toFixed(2)) : 1.0;

    const f1Hs = f1Roster.map((p: any) => playersStats[p.player_id]?.overallHsPercent || 0);
    const f2Hs = f2Roster.map((p: any) => playersStats[p.player_id]?.overallHsPercent || 0);
    const f1AvgHs = f1Hs.length > 0 ? Math.round(f1Hs.reduce((a: number, b: number) => a + b, 0) / f1Hs.length) : 0;
    const f2AvgHs = f2Hs.length > 0 ? Math.round(f2Hs.reduce((a: number, b: number) => a + b, 0) / f2Hs.length) : 0;

    const f1Adrs = f1Roster.map((p: any) => playersStats[p.player_id]?.last30Adr ?? playersStats[p.player_id]?.overallAdr ?? 75);
    const f2Adrs = f2Roster.map((p: any) => playersStats[p.player_id]?.last30Adr ?? playersStats[p.player_id]?.overallAdr ?? 75);
    const f1AvgAdr = f1Adrs.length > 0 ? Math.round(f1Adrs.reduce((a: number, b: number) => a + b, 0) / f1Adrs.length) : 75;
    const f2AvgAdr = f2Adrs.length > 0 ? Math.round(f2Adrs.reduce((a: number, b: number) => a + b, 0) / f2Adrs.length) : 75;

    // Calculate FCR team contribution share
    const f1FullPlayers = f1Roster.map((r: any) => playersStats[r.player_id]).filter(Boolean);
    const f2FullPlayers = f2Roster.map((r: any) => playersStats[r.player_id]).filter(Boolean);

    const f1FcrMap = calculateTeamFcr(f1FullPlayers);
    const f2FcrMap = calculateTeamFcr(f2FullPlayers);

    for (const [id, fcr] of Object.entries(f1FcrMap)) {
      if (playersStats[id]) playersStats[id].fcrContributionPercent = fcr;
    }
    for (const [id, fcr] of Object.entries(f2FcrMap)) {
      if (playersStats[id]) playersStats[id].fcrContributionPercent = fcr;
    }

    // Premade Detection
    const premadeGroups = detectPremades(match, playersStats);

    // Advanced Multi-Factor Match Prediction (Elo + Map + Form + Premades + Smurfs)
    const prediction = calculateAdvancedMatchPrediction({
      f1AvgElo,
      f2AvgElo,
      f1Players: f1FullPlayers,
      f2Players: f2FullPlayers,
      selectedMap: match.selected_map,
      premadeGroups,
      riskAnalysis,
      f1Fcr: f1FcrMap,
      f2Fcr: f2FcrMap,
    });

    const out: LobbyAnalysisPayload = {
      match,
      playersStats,
      steamData,
      riskAnalysis,
      premadeGroups,
      teamSummary: {
        faction1: {
          totalElo: f1TotalElo,
          avgElo: f1AvgElo,
          winChancePercent: prediction.winChanceF1,
          avgKd: f1AvgKd,
          avgHsPercent: f1AvgHs,
          avgAdr: f1AvgAdr,
          projectedElo: projectedEloStakes.faction1,
        },
        faction2: {
          totalElo: f2TotalElo,
          avgElo: f2AvgElo,
          winChancePercent: prediction.winChanceF2,
          avgKd: f2AvgKd,
          avgHsPercent: f2AvgHs,
          avgAdr: f2AvgAdr,
          projectedElo: projectedEloStakes.faction2,
        },
        eloDifference: Math.abs(eloDiff),
      },
      prediction,
      isPartial: false,
    };

    await cacheManager.set(cacheKey, out, TTL.MATCH);
    this.broadcastToSubscribers(matchId, {
      type: 'LOBBY_ANALYSIS_COMPLETE',
      payload: out,
    });
  }

  private safeSendToTab(tabId: number, message: any) {
    chrome.tabs.sendMessage(tabId, message).catch((err) => {
      console.debug('[f-insight:Background] Tab unavailable, skipping message:', err?.message || err);
    });
  }

  private async handleGetCacheStats(): Promise<MessageResponse> {
    const stats = await cacheManager.getStats();
    return { success: true, data: stats };
  }

  private async handleClearCache(): Promise<MessageResponse> {
    await cacheManager.clear();
    return { success: true, data: { cleared: true } };
  }
}

