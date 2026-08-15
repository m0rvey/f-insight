import {
  FaceitMatchDetails,
  FaceitPlayerFullStats,
  MapSpecificStats,
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
  const totalMatches = parseInt(pick(lifetime, 'Total Matches', 'Matches', 'm1') || '0', 10);
  const overallWinRate = parseFloat(pick(lifetime, 'Win Rate %', 'k6') || '0');
  const overallKd = parseFloat(pick(lifetime, 'Average K/D Ratio', 'K/D Ratio', 'k5') || '1.0');
  const overallHsPercent = parseFloat(pick(lifetime, 'Average Headshots %', 'Headshots %', 'k8') || '0');
  const overallAdr = parseFloat(pick(lifetime, 'ADR', 'adr', 'c3') || '78.5');

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
      const mCount = parseInt(pick(seg.stats, 'Matches') ?? pick(seg, 'm1', 'matches') ?? '0', 10);
      const mWinRate = parseFloat(pick(seg.stats, 'Win Rate %') ?? pick(seg, 'k6', 'winRate') ?? '0');
      const mKd = parseFloat(pick(seg.stats, 'Average K/D Ratio', 'K/D Ratio') ?? pick(seg, 'k5', 'kd') ?? '1.0');
      const mHs = parseFloat(pick(seg.stats, 'Average Headshots %') ?? pick(seg, 'k8', 'hsPercent') ?? '0');
      const mAvgKills = parseFloat(pick(seg.stats, 'Average Kills') ?? pick(seg, 'k1', 'avgKills') ?? '0');
      const mAdr = parseFloat(pick(seg.stats, 'ADR') ?? pick(seg, 'c3', 'adr') ?? '78.0');
      const mWins = parseInt(pick(seg.stats, 'Wins') ?? pick(seg, 'm2', 'wins') ?? Math.round((mCount * mWinRate) / 100).toString(), 10);

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
  const historyMapStats: Record<string, { matches: number; wins: number; kills: number; deaths: number; adrSum: number }> = {};

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
      const kills = parseInt(item.i6 || item.stats?.Kills || item.kills || '0', 10);
      const deaths = parseInt(item.i8 || item.stats?.Deaths || item.deaths || '0', 10);
      const adr = parseFloat(item.c3 || item.stats?.ADR || item.adr || '78.0');

      if (mapName) {
        if (!historyMapStats[mapName]) {
          historyMapStats[mapName] = { matches: 0, wins: 0, kills: 0, deaths: 0, adrSum: 0 };
        }
        historyMapStats[mapName].matches++;
        if (isWin) historyMapStats[mapName].wins++;
        historyMapStats[mapName].kills += kills;
        historyMapStats[mapName].deaths += deaths;
        historyMapStats[mapName].adrSum += adr;
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
        hsPercent: parseFloat(item.c4 || item.stats?.['Headshots %'] || '0'),
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
      const mAdr = mCount > 0 ? Math.round(hStats.adrSum / mCount) : 75;

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

  const { formStatus, recentKd, recentAdr } = evaluatePlayerForm(recentMatches, overallKd, overallAdr);

  return {
    playerId,
    nickname,
    avatar,
    country,
    steamId64,
    elo,
    skillLevel,
    totalMatches,
    overallWinRate,
    overallKd,
    overallHsPercent,
    overallAdr,
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

export class FaceitApiService {
  private inFlightMatch = new Map<string, Promise<FaceitMatchDetails | null>>();
  private inFlightPlayer = new Map<string, Promise<FaceitPlayerFullStats | null>>();

  async getMatchDetails(matchId: string): Promise<FaceitMatchDetails | null> {
    if (!matchId) return null;
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
      const res = await fetch(`https://api.faceit.com/match/v2/match/${matchId}`, {
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
    if (!playerId) return null;
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
      const [userRes, statsRes, historyRes, csgoStatsRes] = await Promise.allSettled([
        fetch(`https://api.faceit.com/users/v1/users/${playerId}`, { headers: { Accept: 'application/json' } }),
        fetch(`https://api.faceit.com/stats/v1/stats/users/${playerId}/games/cs2`, { headers: { Accept: 'application/json' } }),
        fetch(`https://api.faceit.com/stats/v1/stats/time/users/${playerId}/games/cs2?size=50`, { headers: { Accept: 'application/json' } }),
        fetch(`https://api.faceit.com/stats/v1/stats/users/${playerId}/games/csgo`, { headers: { Accept: 'application/json' } }),
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
      status: (p.status?.toUpperCase() || 'VOTING') as any,
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
