import { FaceitMatchDetails, FaceitPlayerFullStats } from '../types/faceit';
import { cacheManager } from './cacheManager';
import { FACEIT_CONFIG } from '../constants/config';
import { parsePlayerPayload, parseMatchPayload } from './faceitParser';

// Re-export parsers so existing imports (tests, background) keep working
export { parsePlayerPayload, parseMatchPayload, buildStatsFromInterceptedParts } from './faceitParser';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs: number = FACEIT_CONFIG.REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Global pacing gate for api.faceit.com.
 * Every request queues here and starts at least MIN_INTERVAL apart to avoid
 * throttling FACEIT's own UI ("Action Failed").
 */
let lastFaceitRequestAt = 0;
let faceitQueueTail: Promise<unknown> = Promise.resolve();

function pacedFaceitFetch(url: string, timeoutMs: number): Promise<Response> {
  // timeoutMs already typed as number — FACEIT_CONFIG literal widened
  const run = async (): Promise<Response> => {
    const wait = lastFaceitRequestAt + FACEIT_CONFIG.MIN_REQUEST_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastFaceitRequestAt = Date.now();
    return fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, timeoutMs);
  };
  const result = faceitQueueTail.then(run, run);
  faceitQueueTail = result.catch(() => undefined);
  return result;
}

async function pacedFaceitRequest(url: string, timeoutMs: number = FACEIT_CONFIG.REQUEST_TIMEOUT_MS): Promise<Response> {
  let res = await pacedFaceitFetch(url, timeoutMs);
  if (res.status === 429 || res.status === 503 || res.status === 403) {
    console.warn(`[f-insight:FaceitApi] HTTP ${res.status} from ${new URL(url).pathname} — backing off once`);
    lastFaceitRequestAt = Date.now() + FACEIT_CONFIG.BACKOFF_COOLDOWN_MS;
    await sleep(FACEIT_CONFIG.BACKOFF_RETRY_BASE_MS + Math.floor(Math.random() * FACEIT_CONFIG.BACKOFF_RETRY_JITTER_MS));
    try {
      res = await pacedFaceitFetch(url, timeoutMs);
    } catch {
      /* keep first response; callers treat failures as missing data */
    }
  }
  return res;
}

export class FaceitApiService {
  private inFlightMatch = new Map<string, Promise<FaceitMatchDetails | null>>();
  private inFlightPlayer = new Map<string, Promise<FaceitPlayerFullStats | null>>();

  async getMatchDetails(matchId: string): Promise<FaceitMatchDetails | null> {
    if (!matchId || !FACEIT_CONFIG.ID_PATTERN.test(matchId)) return null;
    const intercepted = await cacheManager.get<FaceitMatchDetails>(`intercepted_match:${matchId}`);
    if (intercepted) return intercepted;
    if (this.inFlightMatch.has(matchId)) return this.inFlightMatch.get(matchId)!;
    const promise = this.fetchMatchDetailsInternal(matchId).finally(() => this.inFlightMatch.delete(matchId));
    this.inFlightMatch.set(matchId, promise);
    return promise;
  }

  private async fetchMatchDetailsInternal(matchId: string): Promise<FaceitMatchDetails | null> {
    try {
      const res = await pacedFaceitRequest(`https://api.faceit.com/match/v2/match/${encodeURIComponent(matchId)}`);
      if (!res.ok) {
        console.warn(`[f-insight:FaceitApi] Match ${matchId} returned HTTP ${res.status}`);
        return null;
      }
      const json = await res.json();
      return parseMatchPayload(json.payload || json);
    } catch (err) {
      console.error(`[f-insight:FaceitApi] Error fetching match ${matchId}:`, err);
      return null;
    }
  }

  async getPlayerStats(playerId: string, fallbackNickname?: string): Promise<FaceitPlayerFullStats | null> {
    if (!playerId || !FACEIT_CONFIG.ID_PATTERN.test(playerId)) return null;
    const cacheKey = `${playerId}_${fallbackNickname || ''}`;
    if (this.inFlightPlayer.has(cacheKey)) return this.inFlightPlayer.get(cacheKey)!;
    const promise = this.fetchPlayerStatsInternal(playerId, fallbackNickname).finally(() => this.inFlightPlayer.delete(cacheKey));
    this.inFlightPlayer.set(cacheKey, promise);
    return promise;
  }

  private async fetchPlayerStatsInternal(playerId: string, fallbackNickname?: string): Promise<FaceitPlayerFullStats | null> {
    try {
      const encodedId = encodeURIComponent(playerId);
      const [userRes, statsRes, historyRes] = await Promise.allSettled([
        pacedFaceitRequest(`https://api.faceit.com/users/v1/users/${encodedId}`),
        pacedFaceitRequest(`https://api.faceit.com/stats/v1/stats/users/${encodedId}/games/cs2`),
        pacedFaceitRequest(`https://api.faceit.com/stats/v1/stats/time/users/${encodedId}/games/cs2?size=30`),
      ]);

      let user: any = null;
      if (userRes.status === 'fulfilled' && userRes.value.ok) {
        const uJson = await userRes.value.json();
        user = uJson.payload || uJson;
      }
      let stats: any = null;
      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const sJson = await statsRes.value.json();
        stats = sJson.payload || sJson;
      }
      let history: any[] = [];
      if (historyRes.status === 'fulfilled' && historyRes.value.ok) {
        const hJson = await historyRes.value.json();
        const rawPayload = hJson.payload || hJson;
        history = Array.isArray(rawPayload) ? rawPayload : (rawPayload?.items || rawPayload?.segments || []);
      }

      let csgoStats: any = null;
      const hasCs2Data =
        !!(stats?.lifetime && Object.keys(stats.lifetime).length > 0) ||
        (Array.isArray(stats?.segments) && stats.segments.length > 0) ||
        history.length > 0;
      if (!hasCs2Data) {
        try {
          const legacyRes = await pacedFaceitRequest(`https://api.faceit.com/stats/v1/stats/users/${encodedId}/games/csgo`);
          if (legacyRes.ok) {
            const cJson = await legacyRes.json();
            csgoStats = cJson.payload || cJson;
          }
        } catch {
          /* legacy endpoint is optional */
        }
      }
      return parsePlayerPayload(playerId, fallbackNickname, user, stats, csgoStats, history);
    } catch (err) {
      console.error(`[f-insight:FaceitApi] Error fetching player ${playerId}:`, err);
      return null;
    }
  }
}

export const faceitApi = new FaceitApiService();
