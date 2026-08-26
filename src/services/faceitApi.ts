import {
  FaceitMatchDetails,
  FaceitPlayerFullStats,
  MapSpecificStats,
  MatchStatus,
  PlayerRecentMatch,
} from '../types/faceit';
import { evaluatePlayerForm } from './forecastEngine';
import { cacheManager } from './cacheManager';

const pick = (obj: Record<string, any>, ...keys: string[]): string | undefined => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
};

/** FACEIT formats some numbers with thousands separators ("1,234"). */
const toInt = (raw: string | undefined, fallback: number): number => {
  if (raw === undefined) return fallback;
  const n = parseInt(raw.replace(/[,\s]/g, ''), 10);
  return Number.isFinite(n) ? n : fallback;
};

const toFloat = (raw: string | undefined, fallback?: number): number | undefined => {
  if (raw === undefined) return fallback;
  const n = parseFloat(raw.replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

export function parsePlayerPayload(
  playerId: string,
  fallbackNickname: string | undefined,
  user: any,
  stats: any,
  csgoStats: any,
  history: any[]
): FaceitPlayerFullStats {
  const cs2Game = user?.games?.cs2 || user?.games?.csgo || {};
  const elo = cs2Game.faceit_elo || 1000;
  const skillLevel = cs2Game.skill_level || 1;
  const steamId64 = cs2Game.game_player_id || user?.steam_id_64;
  const nickname = user?.nickname || fallbackNickname || 'Player';
  const avatar = user?.avatar || '';
  const country = user?.country || '';

  // Lifetime Stats
  const statsObj = Array.isArray(stats) ? null : stats;
  const csgoStatsObj = Array.isArray(csgoStats) ? null : csgoStats;
  const lifetime = statsObj?.lifetime || csgoStatsObj?.lifetime || {};
  // Distinguishes "stats endpoints failed / rate-limited" from a legitimately
  // fresh account: without this, totalMatches=0 defaults would flag veterans
  // as CRITICAL smurfs (see riskScorer statsAvailable guard).
  const statsAvailable = Object.keys(lifetime).length > 0;
  const totalMatches = toInt(pick(lifetime, 'Total Matches', 'Matches', 'm1'), 0);
  const overallWinRate = toFloat(pick(lifetime, 'Win Rate %', 'k6'), 0) ?? 0;
  const overallKd = toFloat(pick(lifetime, 'Average K/D Ratio', 'K/D Ratio', 'k5'), 1.0) ?? 1.0;
  const overallHsPercent = toFloat(pick(lifetime, 'Average Headshots %', 'Headshots %', 'k8'), 0) ?? 0;
  const overallAdrRaw = pick(lifetime, 'ADR', 'adr', 'c3');
  let overallAdr = overallAdrRaw ? toFloat(overallAdrRaw, undefined) : undefined;

  // Segments breakdown (Maps) - Support both direct array and { segments: [...] }
  const mapStats: Record<string, MapSpecificStats> = {};
  const rawSegments = [
    ...(Array.isArray(stats) ? stats : (stats?.segments || stats?.items || [])),
    ...(Array.isArray(csgoStats) ? csgoStats : (csgoStats?.segments || csgoStats?.items || [])),
  ];

  for (const seg of rawSegments) {
    const rawId = seg._id?.segmentId || seg._id?.label || seg.label || seg.segmentId || seg.name || '';
    const mapLabel = rawId.replace(/^cs2_/, '').replace(/^csgo_/, '').replace(/^de_/, '').trim().toLowerCase();
    if (mapLabel) {
      const mCount = toInt(pick(seg.stats, 'Matches') ?? pick(seg, 'm1', 'matches'), 0);
      const mWinRate = toFloat(pick(seg.stats, 'Win Rate %') ?? pick(seg, 'k6', 'winRate'), 0) ?? 0;
      const mKd = toFloat(pick(seg.stats, 'Average K/D Ratio', 'K/D Ratio') ?? pick(seg, 'k5', 'kd'), 1.0) ?? 1.0;
      const mHs = toFloat(pick(seg.stats, 'Average Headshots %') ?? pick(seg, 'k8', 'hsPercent'), 0) ?? 0;
      const mAvgKills = toFloat(pick(seg.stats, 'Average Kills') ?? pick(seg, 'k1', 'avgKills'), 0) ?? 0;
      const mAdrRaw = pick(seg.stats, 'ADR') ?? pick(seg, 'c3', 'adr');
      const mAdr = mAdrRaw ? toFloat(mAdrRaw, undefined) : undefined;
      const mWins = toInt(pick(seg.stats, 'Wins') ?? pick(seg, 'm2', 'wins'), Math.round((mCount * mWinRate) / 100));

      if (!mapStats[mapLabel] || mCount > mapStats[mapLabel].matches) {
        mapStats[mapLabel] = {
          mapName: mapLabel,
          matches: mCount,
          winRate: mWinRate,
          kd: mKd,
          hsPercent: mHs,
          avgKills: mAvgKills,
          avgAdr: mAdr,
          wins: mWins,
          losses: Math.max(0, mCount - mWins),
        };
      }
    }
  }

  // Recent Match History (last 30 matches)
  const recentMatches: PlayerRecentMatch[] = [];
  let currentStreakCount = 0;
  let currentStreakType: 'W' | 'L' | 'NONE' = 'NONE';
  let streakActive = true;

  // Map accumulator from match history
  const historyMapStats: Record<string, { matches: number; wins: number; kills: number; deaths: number; adrSum: number; adrCount: number }> = {};

  if (Array.isArray(history)) {
    for (let i = 0; i < history.length; i++) {
      const item = history[i];
      const isWin = item.i10 === '1' || item.result === '1' || item.stats?.Result === '1' || item.stats?.Win === '1';
      const res: 'W' | 'L' = isWin ? 'W' : 'L';

      // Consecutive streak calculation (stops when streak breaks)
      if (i === 0) {
        currentStreakType = res;
        currentStreakCount = 1;
      } else if (streakActive) {
        if (res === currentStreakType) {
          currentStreakCount++;
        } else {
          streakActive = false;
        }
      }

      const mapName = (item.i1 || item.stats?.Map || item.map || '').replace(/^cs2_/, '').replace(/^de_/, '').toLowerCase();
      const kills = toInt(item.i6 ?? item.stats?.Kills ?? item.kills, 0);
      const deaths = toInt(item.i8 ?? item.stats?.Deaths ?? item.deaths, 0);

      // --- ADR / HS% extraction across payload generations -----------------
      // Per-match stat sources drift between FACEIT generations: CS2
      // responses may carry a named `stats` object ('ADR', 'Headshots %'),
      // legacy indexed columns (c3/c4), both, or neither — and column
      // semantics drifted between eras (some payloads put Headshots % in
      // c3). Strategy:
      //   1. Named stats win outright (plausibility-checked).
      //   2. Otherwise use the c-columns; when the headshot-count anchor
      //      (i9 + kills) lets us compute HS% independently, any candidate
      //      matching it is identified as Headshots % and excluded from ADR.
      //   3. Nothing plausible => undefined (never fabricate).
      const namedStats: Record<string, unknown> | null =
        item.stats && typeof item.stats === 'object' ? item.stats : null;
      const isPlausibleAdr = (v: number | undefined): v is number =>
        v !== undefined && v >= 5 && v <= 200;

      const headshotCount = toInt(item.i9, 0);
      const derivedHsPct = kills > 0 && headshotCount > 0 ? (headshotCount / kills) * 100 : undefined;
      const looksLikeDerivedHs = (v: number) =>
        derivedHsPct !== undefined && Math.abs(v - derivedHsPct) <= 5;

      let adr: number | undefined;
      const namedAdr = namedStats ? toFloat(pick(namedStats, 'ADR', 'adr'), undefined) : undefined;
      if (isPlausibleAdr(namedAdr)) {
        adr = namedAdr;
      } else {
        const c3Val = item.c3 !== undefined && item.c3 !== '' ? toFloat(item.c3, undefined) : undefined;
        const c4Val = item.c4 !== undefined && item.c4 !== '' ? toFloat(item.c4, undefined) : undefined;
        const c3AsAdr = isPlausibleAdr(c3Val) && !looksLikeDerivedHs(c3Val) ? c3Val : undefined;
        const c4AsAdr = isPlausibleAdr(c4Val) && !looksLikeDerivedHs(c4Val) ? c4Val : undefined;
        // Documented convention places ADR in c3; c4 only rescues the
        // swapped-column case, and only when the anchor proves which is which.
        adr = c3AsAdr ?? (derivedHsPct !== undefined ? c4AsAdr : undefined);
        if (adr === undefined && item.adr !== undefined) {
          const plain = toFloat(item.adr, undefined);
          if (isPlausibleAdr(plain)) adr = plain;
        }
      }

      let hsPercent: number | undefined;
      const namedHs = namedStats
        ? toFloat(namedStats['Headshots %'] as string | undefined, undefined)
        : undefined;
      if (namedHs !== undefined && namedHs > 0 && namedHs <= 100) {
        hsPercent = namedHs;
      } else {
        const c4Val = item.c4 !== undefined && item.c4 !== '' ? toFloat(item.c4, undefined) : undefined;
        const c4UsableHs =
          c4Val !== undefined && c4Val > 0 && c4Val <= 100 &&
          (derivedHsPct === undefined || looksLikeDerivedHs(c4Val));
        if (c4UsableHs) hsPercent = c4Val;
        else if (derivedHsPct !== undefined) hsPercent = Math.round(derivedHsPct * 10) / 10;
      }

      if (mapName) {
        if (!historyMapStats[mapName]) {
          historyMapStats[mapName] = { matches: 0, wins: 0, kills: 0, deaths: 0, adrSum: 0, adrCount: 0 };
        }
        historyMapStats[mapName].matches++;
        if (isWin) historyMapStats[mapName].wins++;
        historyMapStats[mapName].kills += kills;
        historyMapStats[mapName].deaths += deaths;
        if (adr !== undefined) {
          historyMapStats[mapName].adrSum += adr;
          historyMapStats[mapName].adrCount++;
        }
      }

      const rawMatchElo = item.elo ? parseInt(item.elo.toString().replace(/,/g, ''), 10) : (item.i15 ? parseInt(item.i15, 10) : undefined);
      let eloDiff: number | undefined = undefined;
      if (i < history.length - 1 && rawMatchElo) {
        const prevItem = history[i + 1];
        const prevElo = prevItem?.elo ? parseInt(prevItem.elo.toString().replace(/,/g, ''), 10) : (prevItem?.i15 ? parseInt(prevItem.i15, 10) : undefined);
        if (typeof prevElo === 'number' && !isNaN(prevElo)) {
          const diff = rawMatchElo - prevElo;
          if (Math.abs(diff) <= 60) {
            eloDiff = diff;
          }
        }
      }
      if (eloDiff === undefined) {
        eloDiff = isWin ? 25 : -25;
      }

      recentMatches.push({
        matchId: item.matchId || item.i0 || `match-${i}`,
        playedAt: item.date || item.created_at || 0,
        map: mapName,
        result: res,
        score: item.i18 || item.stats?.Score || '13:0',
        kills,
        deaths,
        kd: parseFloat(item.c2 || item.stats?.['K/D Ratio'] || (deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2))),
        hsPercent,
        adr,
        elo: rawMatchElo,
        eloDiff,
      });
    }
  }

  // Merge history map stats if segment stats are missing or 0
  for (const [mName, hStats] of Object.entries(historyMapStats)) {
    if (!mapStats[mName] || mapStats[mName].matches === 0) {
      const mCount = hStats.matches;
      const mWins = hStats.wins;
      const mWr = mCount > 0 ? Math.round((mWins / mCount) * 100) : 50;
      const mKd = hStats.deaths > 0 ? parseFloat((hStats.kills / hStats.deaths).toFixed(2)) : 1.0;
      const mAdr = hStats.adrCount > 0 ? Math.round(hStats.adrSum / hStats.adrCount) : undefined;

      mapStats[mName] = {
        mapName: mName,
        matches: mCount,
        winRate: mWr,
        kd: mKd,
        hsPercent: overallHsPercent,
        avgKills: mCount > 0 ? parseFloat((hStats.kills / mCount).toFixed(1)) : 15,
        avgAdr: mAdr,
        wins: mWins,
        losses: mCount - mWins,
      };
    }
  }

  // Many CS2 accounts have no lifetime 'ADR' aggregate at all (the field is
  // only present for some profiles/eras). Approximate it from the per-map
  // segments, matches-weighted, so real data surfaces instead of an empty
  // badge cell. Stays undefined when nothing real exists anywhere.
  if (overallAdr === undefined) {
    let adrWeightedSum = 0;
    let adrMatches = 0;
    for (const ms of Object.values(mapStats)) {
      if (ms.avgAdr !== undefined && ms.matches > 0) {
        adrWeightedSum += ms.avgAdr * ms.matches;
        adrMatches += ms.matches;
      }
    }
    if (adrMatches > 0) {
      overallAdr = Math.round((adrWeightedSum / adrMatches) * 10) / 10;
    }
  }

  // Last 30 matches aggregates (real data only, no fabricated fallbacks)
  const last30 = recentMatches.slice(0, 30);
  const last30Matches = last30.length;
  let last30Kd: number | undefined;
  let last30Adr: number | undefined;
  let last30AdrMatches = 0;
  let last30HsPercent: number | undefined;
  let last30WinRate: number | undefined;

  if (last30Matches > 0) {
    const killsSum = last30.reduce((s, m) => s + (m.kills || 0), 0);
    const deathsSum = last30.reduce((s, m) => s + (m.deaths || 0), 0);
    last30Kd = deathsSum > 0 ? parseFloat((killsSum / deathsSum).toFixed(2)) : undefined;

    const adrValues = last30.map((m) => m.adr).filter((a): a is number => a !== undefined && a > 0);
    last30AdrMatches = adrValues.length;
    last30Adr = adrValues.length > 0 ? Math.round(adrValues.reduce((s, a) => s + a, 0) / adrValues.length) : undefined;

    const hsValues = last30.map((m) => m.hsPercent).filter((v): v is number => v !== undefined);
    last30HsPercent = hsValues.length > 0 ? Math.round(hsValues.reduce((s, v) => s + v, 0) / hsValues.length) : undefined;

    const wins30 = last30.filter((m) => m.result === 'W').length;
    last30WinRate = Math.round((wins30 / last30Matches) * 100);
  }

  const { formStatus, recentKd, recentAdr } = evaluatePlayerForm(recentMatches, overallKd, overallAdr);

  return {
    playerId,
    nickname,
    avatar,
    country,
    steamId64,
    elo: Number.isFinite(elo) ? elo : 1000,
    skillLevel: Number.isFinite(skillLevel) ? skillLevel : 1,
    totalMatches,
    overallWinRate,
    overallKd,
    overallHsPercent,
    overallAdr,
    statsAvailable,
    last30Kd,
    last30Adr,
    last30AdrMatches,
    last30HsPercent,
    last30WinRate,
    last30Matches,
    currentStreak: {
      type: currentStreakType,
      count: currentStreakCount,
    },
    recentMatches,
    mapStats,
    registrationDate: user?.created_at,
    formStatus,
    recentKd,
    recentAdr,
  };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
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
 *
 * FACEIT's own page requests share the same Cloudflare rate bucket as ours
 * (same browser IP). A lobby analysis used to fire 4 parallel requests × 10
 * players; the resulting burst throttled the domain and FACEIT's UI surfaced
 * it as "Action Failed" errors on almost every user action. Every request we
 * make therefore queues here and starts at least MIN_INTERVAL apart.
 */
const FACEIT_MIN_REQUEST_INTERVAL_MS = 400;
let lastFaceitRequestAt = 0;
let faceitQueueTail: Promise<unknown> = Promise.resolve();

function pacedFaceitFetch(url: string, timeoutMs: number): Promise<Response> {
  const run = async (): Promise<Response> => {
    const wait = lastFaceitRequestAt + FACEIT_MIN_REQUEST_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastFaceitRequestAt = Date.now();
    return fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, timeoutMs);
  };
  const result = faceitQueueTail.then(run, run); // keep draining even if a predecessor failed
  faceitQueueTail = result.catch(() => undefined);
  return result;
}

/**
 * Paced GET against api.faceit.com with a single backoff retry on throttle
 * responses (429/503/403). Hammering a throttled endpoint only extends the
 * ban, so we retreat once, inject a cooldown into the shared gate and then
 * give up gracefully — callers treat failures as missing data.
 */
async function pacedFaceitRequest(url: string, timeoutMs = 8000): Promise<Response> {
  let res = await pacedFaceitFetch(url, timeoutMs);
  if (res.status === 429 || res.status === 503 || res.status === 403) {
    console.warn(`[f-insight:FaceitApi] HTTP ${res.status} from ${new URL(url).pathname} — backing off once`);
    // Cooldown: push the shared gate into the future so every queued request
    // (ours AND the lobby stream's next players) waits out the throttle window
    // instead of re-impaling immediately. This protects FACEIT's own UI
    // budget too — its "Action Failed" toast is what a domain-wide ban
    // looks like from the inside.
    lastFaceitRequestAt = Date.now() + 2000;
    await sleep(2500 + Math.floor(Math.random() * 2000));
    try {
      res = await pacedFaceitFetch(url, timeoutMs);
    } catch {
      /* keep the first response; callers treat failures as missing data */
    }
  }
  return res;
}

export class FaceitApiService {
  private inFlightMatch = new Map<string, Promise<FaceitMatchDetails | null>>();
  private inFlightPlayer = new Map<string, Promise<FaceitPlayerFullStats | null>>();

  async getMatchDetails(matchId: string): Promise<FaceitMatchDetails | null> {
    if (!matchId || !/^[a-zA-Z0-9.\-_]+$/.test(matchId)) return null;

    // Hybrid data path: when FACEIT's own SPA already loaded this match
    // (intercepted by the MAIN-world hook and cached by the background),
    // serve that instead of spending any of our request budget.
    const intercepted = await cacheManager.get<FaceitMatchDetails>(
      `intercepted_match:${matchId}`
    );
    if (intercepted) return intercepted;

    if (this.inFlightMatch.has(matchId)) {
      return this.inFlightMatch.get(matchId)!;
    }

    const promise = this.fetchMatchDetailsInternal(matchId).finally(() => {
      this.inFlightMatch.delete(matchId);
    });

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
      const payload = json.payload || json;
      return parseMatchPayload(payload);
    } catch (err) {
      console.error(`[f-insight:FaceitApi] Error fetching match ${matchId}:`, err);
      return null;
    }
  }

  async getPlayerStats(playerId: string, fallbackNickname?: string): Promise<FaceitPlayerFullStats | null> {
    if (!playerId || !/^[a-zA-Z0-9.\-_]+$/.test(playerId)) return null;
    const cacheKey = `${playerId}_${fallbackNickname || ''}`;
    if (this.inFlightPlayer.has(cacheKey)) {
      return this.inFlightPlayer.get(cacheKey)!;
    }

    const promise = this.fetchPlayerStatsInternal(playerId, fallbackNickname).finally(() => {
      this.inFlightPlayer.delete(cacheKey);
    });

    this.inFlightPlayer.set(cacheKey, promise);
    return promise;
  }

  private async fetchPlayerStatsInternal(playerId: string, fallbackNickname?: string): Promise<FaceitPlayerFullStats | null> {
    try {
      const encodedId = encodeURIComponent(playerId);
      // Three paced requests per player; the legacy CS:GO call below only
      // happens for old accounts whose CS2 payload is empty. This halves the
      // request count of a typical 10-player lobby analysis.
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

      // Legacy CS:GO fallback — only when the CS2 endpoints returned nothing.
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

/**
 * Compose FaceitPlayerFullStats from payloads the page itself loaded
 * (intercepted by the MAIN-world hook). Accepts ANY subset — whatever the
 * SPA happened to fetch. Missing pieces degrade exactly like the own-API
 * path: `parsePlayerPayload` already implements the Data Availability
 * Contract, so a users-only snapshot yields statsAvailable:false with real
 * Elo/level/nickname, while user+stats+time yields a fully hydrated card.
 */
export function buildStatsFromInterceptedParts(
  playerId: string,
  parts: { user?: any; stats?: any; time?: any[] }
): FaceitPlayerFullStats | null {
  const hasAnything =
    parts.user !== undefined ||
    parts.stats !== undefined ||
    (Array.isArray(parts.time) && parts.time.length > 0);
  if (!hasAnything) return null;
  return parsePlayerPayload(
    playerId,
    undefined,
    parts.user ?? null,
    parts.stats ?? null,
    null,
    Array.isArray(parts.time) ? parts.time : []
  );
}

const MATCH_STATUSES: MatchStatus[] = ['VOTING', 'CONFIGURING', 'READY', 'ON_GOING', 'CANCELLED', 'FINISHED'];

function toMatchStatus(raw: unknown): MatchStatus {
  const s = typeof raw === 'string' ? raw.toUpperCase() : '';
  return (MATCH_STATUSES as string[]).includes(s) ? (s as MatchStatus) : 'VOTING';
}

export function parseMatchPayload(p: any): FaceitMatchDetails {
    const f1 = p.teams?.faction1 || p.faction1 || {};
    const f2 = p.teams?.faction2 || p.faction2 || {};

    const mapPicks = p.voting?.map?.pick || [];
    // FACEIT accumulates picks in veto order — the map actually played is the LAST pick
    const selectedMap = mapPicks.length > 0
      ? mapPicks[mapPicks.length - 1]
      : [...(p.voting?.map?.entities || [])].reverse().find((e: any) => e.status === 'pick')?.name;

    // Only treat as server_ip if it is a real IP:port or hostname:port
    const rawIp = p.configured_server_ip || p.server_ip;
    const serverIp = rawIp && /^[a-zA-Z0-9.\-]+:\d+$/.test(rawIp) ? rawIp : undefined;

    const mapRoster = (roster: any[]) =>
      (roster || []).map((r: any) => ({
        player_id: r.id || r.player_id,
        nickname: r.nickname || 'Player',
        avatar: r.avatar || '',
        game_player_id: r.game_player_id || r.gameId || r.steam_id_64,
        game_player_name: r.game_player_name || r.gameName,
        game_skill_level: r.skill_level || r.game_skill_level || 1,
        elo: r.elo || 1000,
        membership: r.membership,
        party_id: r.party_id || r.partyId,
      }));

    return {
      match_id: p.id || p.match_id,
      game: p.game || 'cs2',
      region: p.region || 'EU',
      status: toMatchStatus(p.status),
      configured_at: p.configured_at,
      started_at: p.started_at,
      finished_at: p.finished_at,
      teams: {
        faction1: {
          faction_id: f1.id || f1.faction_id || 'faction1',
          name: f1.name || 'Team 1',
          avatar: f1.avatar,
          leader: f1.leader,
          roster: mapRoster(f1.roster),
        },
        faction2: {
          faction_id: f2.id || f2.faction_id || 'faction2',
          name: f2.name || 'Team 2',
          avatar: f2.avatar,
          leader: f2.leader,
          roster: mapRoster(f2.roster),
        },
      },
      voting: p.voting,
      selected_map: selectedMap,
      server_ip: serverIp,
    };
}

export const faceitApi = new FaceitApiService();
