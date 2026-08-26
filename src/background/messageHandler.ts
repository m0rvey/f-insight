import {
  ExtensionMessage,
  LobbyAnalysisPayload,
  MessageResponse,
} from '../types/messages';
import { ExtensionSettings, DEFAULT_SETTINGS } from '../types/settings';
import { cacheManager, TTL, SETTINGS_KEY } from '../services/cacheManager';
import { faceitApi, parseMatchPayload, buildStatsFromInterceptedParts } from '../services/faceitApi';
import { steamApi } from '../services/steamApi';
import { calculateRiskScore } from '../services/riskScorer';
import { detectPremades } from '../services/premadeDetector';
import { classifyInterceptedProfileUrl, InterceptedProfileKind } from '../services/interceptRules';
import { harvestMapNamesFromMatchPayload, recordObservedMaps } from '../services/mapPool';
import {
  calculateTeamFcr,
  calculateAdvancedMatchPrediction,
} from '../services/forecastEngine';
import { FaceitPlayerFullStats } from '../types/faceit';
import { SteamFullData } from '../types/steam';
import { RiskAnalysisResult } from '../types/risk';
import { CACHE_CONFIG, FACEIT_CONFIG, LOBBY_CONFIG } from '../constants/config';
import { mapWithConcurrency } from '../utils/concurrency';

export class BackgroundMessageHandler {
  private settings: ExtensionSettings = { ...DEFAULT_SETTINGS };
  private initialized = false;
  private inFlightStreams = new Map<string, Promise<void>>();
  private streamSubscribers = new Map<string, Set<number>>();
  // Monotonic per-match stream generation; superseded streams stop broadcasting.
  private streamGenerations = new Map<string, number>();

  async init() {
    if (this.initialized) return;
    await this.loadSettings();
    this.initialized = true;
    // Opportunistic cache cleanup on startup
    cacheManager.cleanup().catch(() => {});
    // P1-05: prevent subscriber leak when tabs close without stream completion
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs?.onRemoved) {
        chrome.tabs.onRemoved.addListener((tabId: number) => {
          for (const subs of this.streamSubscribers.values()) subs.delete(tabId);
          // Also prune empty match entries
          for (const [mid, set] of this.streamSubscribers.entries()) if (set.size === 0) this.streamSubscribers.delete(mid);
        });
      }
    } catch {}
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
        case 'INTERCEPTED_MATCH_PAYLOAD':
          return this.handleInterceptedMatchPayload(message.payload);
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

  /**
   * Consumes a payload intercepted from FACEIT's own page traffic.
   * Two kinds share this channel:
   *  - match details (`matchId` present) → cached under `intercepted_match:*`
   *  - player-profile payloads (users / lifetime stats / recent matches for a
   *    single player) → staged per-player and composed into a
   *    `player_stats:*` cache entry via parsePlayerPayload, so lobby analysis
   *    hydrates KD/Elo/maps WITHOUT spending any of our request budget.
   */
  private async handleInterceptedMatchPayload(payload: any): Promise<MessageResponse> {
    try {
      const matchId = typeof payload?.matchId === 'string' ? payload.matchId : '';
      if (!matchId) {
        return await this.handleInterceptedProfilePayload(payload);
      }
      if (!FACEIT_CONFIG.ROOM_ID_PATTERN.test(matchId)) {
        return { success: false, error: 'Invalid intercepted matchId' };
      }
      if (!payload?.body || typeof payload.body !== 'object') {
        return { success: false, error: 'Invalid intercepted match body' };
      }

      const raw = (payload.body as { payload?: unknown }).payload ?? payload.body;
      const details = parseMatchPayload(raw);
      await cacheManager.set(`intercepted_match:${matchId}`, details, TTL.MATCH);

      // Self-observing map pool: learn the active maps from this traffic so
      // future rooms get a smarter pre-veto matrix. Fire-and-forget.
      recordObservedMaps(harvestMapNamesFromMatchPayload(payload.body)).catch(() => {});

      return { success: true, data: { status: details.status } };
    } catch (err: any) {
      console.warn('[f-insight:Background] Intercepted match payload rejected:', err?.message || err);
      return { success: false, error: err?.message || 'Intercepted payload parse failed' };
    }
  }

  /**
   * Stages an intercepted player-profile payload (users / stats / time).
   * Parts accumulate per player across page clicks (short TTL), and every new
   * part recomposes the best-known FaceitPlayerFullStats into the standard
   * `player_stats:*` cache — exactly what streamLobbyData reads, so badges
   * and the flyout hydrate from page traffic with zero own requests.
   */
  private async handleInterceptedProfilePayload(payload: any): Promise<MessageResponse> {
    const url = typeof payload?.url === 'string' ? payload.url : '';
    const classified = classifyInterceptedProfileUrl(url);
    if (!classified) {
      return { success: false, error: 'Unrecognized intercepted URL' };
    }
    if (!payload?.body || typeof payload.body !== 'object') {
      return { success: false, error: 'Invalid intercepted profile body' };
    }
    const { kind, playerId }: { kind: InterceptedProfileKind; playerId: string } = classified;

    // Unwrap FACEIT's { payload: ... } envelope where present.
    const raw = (payload.body as { payload?: unknown }).payload ?? payload.body;

    const stageKey = `intercept_profile:${playerId}`;
    const staged =
      (await cacheManager.get<{ user?: any; stats?: any; time?: any[] }>(stageKey)) || {};

    let accepted = false;
    // When the intercepted payload is a USER object it doubles as an identity
    // signal for team detection (FACEIT's navbar fetches the logged-in user
    // right after page load). Surfaced back to the content script, which
    // intersects guid/nickname against the match roster.
    let selfCandidate: { guid: string; nickname?: string } | undefined;
    if (kind === 'user' && raw && typeof raw === 'object' && !Array.isArray(raw)) {
      staged.user = raw;
      accepted = true;
      const nick = (raw as { nickname?: unknown }).nickname;
      if (typeof nick === 'string' && nick.trim()) {
        selfCandidate = { guid: playerId, nickname: nick.trim() };
      }
    } else if (kind === 'stats' && raw && typeof raw === 'object' && !Array.isArray(raw)) {
      staged.stats = raw;
      accepted = true;
    } else if (kind === 'time') {
      const arr = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as any)?.items)
          ? (raw as any).items
          : null;
      if (arr && arr.length > 0) {
        staged.time = arr;
        accepted = true;
      }
    }
    if (!accepted) {
      return { success: false, error: `Intercepted ${kind} payload had no usable shape` };
    }

    // Short staging window: parts only make sense together with a live room.
    await cacheManager.set(stageKey, staged, TTL.NEGATIVE * CACHE_CONFIG.TTL.INTERCEPT_STAGE_FACTOR);

    const composed = buildStatsFromInterceptedParts(playerId, staged);
    if (!composed) {
      return { success: true, data: { kind: 'profile-staged', playerId, selfCandidate } };
    }
    await cacheManager.set(
      `player_stats:${playerId}`,
      composed,
      composed.statsAvailable === false ? TTL.NEGATIVE : TTL.PLAYER_STATS
    );
    console.warn(
      `[f-insight:Background] Hydrated player ${playerId} from intercepted ${kind} payload (statsAvailable=${composed.statsAvailable !== false})`
    );
    return {
      success: true,
      data: {
        kind: 'profile-hydrated',
        playerId,
        statsAvailable: composed.statsAvailable !== false,
        selfCandidate,
      },
    };
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

    // Register the tab as a live-update subscriber BEFORE the cache check —
    // a tab served from cache must still receive PLAYER_STATS_UPDATE /
    // LOBBY_ANALYSIS_COMPLETE broadcasts for the rest of the room's life.
    if (sender?.tab?.id) {
      if (!this.streamSubscribers.has(matchId)) {
        this.streamSubscribers.set(matchId, new Set());
      }
      this.streamSubscribers.get(matchId)!.add(sender.tab.id);
    }

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

    // Start or attach to background streaming
    if (!this.inFlightStreams.has(matchId) || forceRefresh) {
      // Generation token: a forceRefresh supersedes any still-running older
      // stream. Superseded streams keep fetching through the paced queue
      // (harmless) but must not broadcast stale snapshots over fresher ones.
      const generation = (this.streamGenerations.get(matchId) || 0) + 1;
      this.streamGenerations.set(matchId, generation);
      const streamPromise = this.streamLobbyData(matchId, match, forceRefresh, generation).finally(() => {
        // Only remove our own entry: a forceRefresh may have replaced this
        // stream with a newer one while we were still running.
        if (this.inFlightStreams.get(matchId) === streamPromise) {
          this.inFlightStreams.delete(matchId);
          this.streamSubscribers.delete(matchId);
        }
      });
      this.inFlightStreams.set(matchId, streamPromise);
    }

    return { success: true, data: { match, isPartial: true } };
  }

  private async streamLobbyData(matchId: string, match: any, forceRefresh: boolean, generation: number) {
    try {
      await this.streamLobbyDataInner(matchId, match, forceRefresh, generation);
    } catch (err: any) {
      console.error('[f-insight:Stream] Error:', err);
      this.broadcastFromStream(matchId, generation, {
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

  /**
   * Broadcast guarded by the stream generation: after a forceRefresh spawned
   * a newer stream, superseded ones must stay silent — otherwise a slow old
   * per-player snapshot would overwrite fresher data on the content side.
   */
  private broadcastFromStream(matchId: string, generation: number, message: any) {
    if (this.streamGenerations.get(matchId) !== generation) return;
    this.broadcastToSubscribers(matchId, message);
  }

  private async streamLobbyDataInner(matchId: string, match: any, forceRefresh: boolean, generation: number) {
    const cacheKey = `match_analysis:${matchId}`;
    const f1Roster = match.teams?.faction1?.roster || [];
    const f2Roster = match.teams?.faction2?.roster || [];
    const allPlayers = [...f1Roster, ...f2Roster];

    const playersStats: Record<string, FaceitPlayerFullStats> = {};
    const steamData: Record<string, SteamFullData> = {};
    const riskAnalysis: Record<string, RiskAnalysisResult> = {};

    // Fetch all players with bounded concurrency (LOBBY_CONFIG.CONCURRENCY workers + generous delay
    // between players). Combined with the 400 ms request gate this keeps the
    // full 10-player lobby analysis at ~1 request / 400 ms — gentle enough
    // that FACEIT's own UI requests (player-modal clicks!) keep their budget.
    await mapWithConcurrency(
      allPlayers,
      LOBBY_CONFIG.CONCURRENCY,
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
          const fresh = await faceitApi.getPlayerStats(pId, player.nickname);
          if (fresh && fresh.statsAvailable === false) {
            // Downgrade guard: a throttled/failed own fetch returns a
            // fabricated statsAvailable:false snapshot. It must never
            // overwrite a good cached entry (e.g. one hydrated from
            // intercepted page traffic moments earlier).
            const prev = await cacheManager.get<FaceitPlayerFullStats>(pCacheKey);
            if (prev && prev.statsAvailable !== false) {
              pStats = prev;
            } else {
              // Partial payloads (stats endpoints failed → fabricated defaults)
              // get a short negative TTL so a wrong "fresh account" snapshot is
              // re-fetched quickly instead of poisoning the lobby for an hour.
              await cacheManager.set(pCacheKey, fresh, TTL.NEGATIVE);
              pStats = fresh;
            }
          } else if (fresh) {
            await cacheManager.set(pCacheKey, fresh, TTL.PLAYER_STATS);
            pStats = fresh;
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

          this.broadcastFromStream(matchId, generation, {
            type: 'PLAYER_STATS_UPDATE',
            payload: { matchId, playerId: pId, stats: pStats, steam: steamData[pId], risk: riskAnalysis[pId] },
          });
        }
      },
      LOBBY_CONFIG.CONCURRENCY_DELAY_MS
    );

    // Calculate Team Elo and Probabilities
    const f1Elos = f1Roster.map((p: any) => playersStats[p.player_id]?.elo || p.elo || 1000);
    const f2Elos = f2Roster.map((p: any) => playersStats[p.player_id]?.elo || p.elo || 1000);

    const f1TotalElo = f1Elos.reduce((a: number, b: number) => a + b, 0);
    const f2TotalElo = f2Elos.reduce((a: number, b: number) => a + b, 0);
    const f1AvgElo = f1Elos.length > 0 ? Math.round(f1TotalElo / f1Elos.length) : 1000;
    const f2AvgElo = f2Elos.length > 0 ? Math.round(f2TotalElo / f2Elos.length) : 1000;

    const eloDiff = f1AvgElo - f2AvgElo;

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
        },
        faction2: {
          totalElo: f2TotalElo,
          avgElo: f2AvgElo,
          winChancePercent: prediction.winChanceF2,
          avgKd: f2AvgKd,
          avgHsPercent: f2AvgHs,
          avgAdr: f2AvgAdr,
        },
        eloDifference: Math.abs(eloDiff),
      },
      prediction,
      isPartial: false,
    };

    // Superseded by a newer stream (forceRefresh)? Stay fully silent: no
    // cache overwrite with a stale snapshot, no broadcast.
    if (this.streamGenerations.get(matchId) !== generation) return;

    await cacheManager.set(cacheKey, out, TTL.MATCH);
    this.broadcastFromStream(matchId, generation, {
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

