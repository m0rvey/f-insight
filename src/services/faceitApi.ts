import {
  FaceitMatchDetails,
  FaceitPlayerFullStats,
  MapSpecificStats,
  MatchStatus,
  PlayerRecentMatch,
} from '../types/faceit';
import { evaluatePlayerForm } from './forecastEngine';

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
  const overallAdr = overallAdrRaw ? toFloat(overallAdrRaw, undefined) : undefined;

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
      const adrRaw = item.c3 || item.stats?.ADR || item.adr;
      const adr = adrRaw ? toFloat(adrRaw, undefined) : undefined;
      const hsRaw = item.c4 || item.stats?.['Headshots %'];
      const hsPercent = hsRaw ? toFloat(hsRaw, undefined) : undefined;

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

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export class FaceitApiService {
  private inFlightMatch = new Map<string, Promise<FaceitMatchDetails | null>>();
  private inFlightPlayer = new Map<string, Promise<FaceitPlayerFullStats | null>>();

  async getMatchDetails(matchId: string): Promise<FaceitMatchDetails | null> {
    if (!matchId || !/^[a-zA-Z0-9.\-_]+$/.test(matchId)) return null;
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
      const res = await fetchWithTimeout(`https://api.faceit.com/match/v2/match/${encodeURIComponent(matchId)}`, {
        headers: { Accept: 'application/json' },
      });

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
      const [userRes, statsRes, historyRes, csgoStatsRes] = await Promise.allSettled([
        fetchWithTimeout(`https://api.faceit.com/users/v1/users/${encodedId}`, { headers: { Accept: 'application/json' } }),
        fetchWithTimeout(`https://api.faceit.com/stats/v1/stats/users/${encodedId}/games/cs2`, { headers: { Accept: 'application/json' } }),
        fetchWithTimeout(`https://api.faceit.com/stats/v1/stats/time/users/${encodedId}/games/cs2?size=30`, { headers: { Accept: 'application/json' } }),
        fetchWithTimeout(`https://api.faceit.com/stats/v1/stats/users/${encodedId}/games/csgo`, { headers: { Accept: 'application/json' } }),
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

      let csgoStats: any = null;
      if (csgoStatsRes.status === 'fulfilled' && csgoStatsRes.value.ok) {
        const cJson = await csgoStatsRes.value.json();
        csgoStats = cJson.payload || cJson;
      }

      let history: any[] = [];
      if (historyRes.status === 'fulfilled' && historyRes.value.ok) {
        const hJson = await historyRes.value.json();
        const rawPayload = hJson.payload || hJson;
        history = Array.isArray(rawPayload) ? rawPayload : (rawPayload?.items || rawPayload?.segments || []);
      }

      return parsePlayerPayload(playerId, fallbackNickname, user, stats, csgoStats, history);
    } catch (err) {
      console.error(`[f-insight:FaceitApi] Error fetching player ${playerId}:`, err);
      return null;
    }
  }
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
