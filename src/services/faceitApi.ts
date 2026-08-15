import {
  FaceitMatchDetails,
  FaceitPlayerFullStats,
  MapSpecificStats,
  PlayerRecentMatch,
} from '../types/faceit';
import { evaluatePlayerForm } from './forecastEngine';

const LOCATION_NAME_MAP: Record<string, string> = {
  // Russian & CIS Server Locations
  moscow: 'Russia (Moscow)',
  russia: 'Russia (Moscow)',
  mow: 'Russia (Moscow)',
  spb: 'Russia (Saint Petersburg)',
  saint_petersburg: 'Russia (Saint Petersburg)',
  petersburg: 'Russia (Saint Petersburg)',
  led: 'Russia (Saint Petersburg)',
  ekaterinburg: 'Russia (Yekaterinburg)',
  yekaterinburg: 'Russia (Yekaterinburg)',
  svx: 'Russia (Yekaterinburg)',
  novosibirsk: 'Russia (Novosibirsk)',
  ovb: 'Russia (Novosibirsk)',
  khabarovsk: 'Russia (Khabarovsk)',
  khv: 'Russia (Khabarovsk)',
  vladivostok: 'Russia (Vladivostok)',
  vvo: 'Russia (Vladivostok)',
  kazakhstan: 'Kazakhstan (Almaty)',
  almaty: 'Kazakhstan (Almaty)',
  ala: 'Kazakhstan (Almaty)',
  astana: 'Kazakhstan (Astana)',
  tse: 'Kazakhstan (Astana)',
  minsk: 'Belarus (Minsk)',
  belarus: 'Belarus (Minsk)',
  msq: 'Belarus (Minsk)',
  kyiv: 'Ukraine (Kyiv)',
  kiev: 'Ukraine (Kyiv)',
  ukraine: 'Ukraine (Kyiv)',
  iev: 'Ukraine (Kyiv)',
  // European Server Locations
  germany: 'Germany (Frankfurt)',
  frankfurt: 'Germany (Frankfurt)',
  finland: 'Finland (Helsinki)',
  helsinki: 'Finland (Helsinki)',
  sweden: 'Sweden (Stockholm)',
  stockholm: 'Sweden (Stockholm)',
  netherlands: 'Netherlands (Amsterdam)',
  amsterdam: 'Netherlands (Amsterdam)',
  uk: 'United Kingdom (London)',
  london: 'United Kingdom (London)',
  france: 'France (Paris)',
  paris: 'France (Paris)',
  poland: 'Poland (Warsaw)',
  warsaw: 'Poland (Warsaw)',
  turkey: 'Turkey (Istanbul)',
  istanbul: 'Turkey (Istanbul)',
  // Americas & APAC
  dallas: 'US (Dallas)',
  chicago: 'US (Chicago)',
  denver: 'US (Denver)',
  singapore: 'Singapore',
  brazil: 'Brazil (São Paulo)',
  sao_paulo: 'Brazil (São Paulo)',
};

interface RawPlayerPayload {
  nickname?: string;
  avatar?: string;
  country?: string;
  steam_id_64?: string;
  created_at?: string;
  games?: {
    cs2?: { faceit_elo?: number; skill_level?: number; game_player_id?: string };
    csgo?: { faceit_elo?: number; skill_level?: number; game_player_id?: string };
  };
}

interface RawStatsPayload {
  lifetime?: Record<string, string>;
  segments?: any[];
  items?: any[];
}

export class FaceitApiService {
  async getMatchDetails(matchId: string): Promise<FaceitMatchDetails | null> {
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
      return this.parseMatchPayload(payload);
    } catch (err) {
      console.error(`[f-insight:FaceitApi] Error fetching match ${matchId}:`, err);
      return null;
    }
  }

  async getPlayerStats(playerId: string, fallbackNickname?: string): Promise<FaceitPlayerFullStats | null> {
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

      return this.parsePlayerPayload(playerId, fallbackNickname, user, stats, csgoStats, history);
    } catch (err) {
      console.error(`[f-insight:FaceitApi] Error fetching player ${playerId}:`, err);
      return null;
    }
  }

  private parseMatchPayload(p: any): FaceitMatchDetails {
    const f1 = p.teams?.faction1 || p.faction1 || {};
    const f2 = p.teams?.faction2 || p.faction2 || {};

    const mapPicks = p.voting?.map?.pick || [];
    const selectedMap = mapPicks.length > 0
      ? mapPicks[0]
      : p.voting?.map?.entities?.find((e: any) => e.status === 'pick')?.name;

    // Extract raw server location name from voting
    const locationRaw = p.voting?.location?.pick?.[0] ||
      p.voting?.location?.entities?.find((e: any) => e.status === 'pick')?.name ||
      p.location ||
      '';

    const formattedLocation = locationRaw
      ? LOCATION_NAME_MAP[locationRaw.toLowerCase()] || locationRaw
      : undefined;

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
      server_location: formattedLocation,
      server_ip: serverIp,
    };
  }

  private parsePlayerPayload(
    playerId: string,
    fallbackNickname: string | undefined,
    user: RawPlayerPayload | null,
    stats: RawStatsPayload | any[] | null,
    csgoStats: RawStatsPayload | any[] | null,
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
    const totalMatches = parseInt(lifetime.m1 || lifetime.Matches || '0', 10);
    const overallWinRate = parseFloat(lifetime.k6 || lifetime['Win Rate %'] || '0');
    const overallKd = parseFloat(lifetime.k5 || lifetime['Average K/D Ratio'] || '1.0');
    const overallHsPercent = parseFloat(lifetime.k8 || lifetime['Average Headshots %'] || '0');
    const overallAdr = parseFloat(lifetime.c3 || lifetime.adr || '78.5');

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
        const mCount = parseInt(seg.m1 || seg.stats?.Matches || seg.matches || '0', 10);
        const mWinRate = parseFloat(seg.k6 || seg.stats?.['Win Rate %'] || seg.winRate || '0');
        const mKd = parseFloat(seg.k5 || seg.stats?.['Average K/D Ratio'] || seg.kd || '1.0');
        const mHs = parseFloat(seg.k8 || seg.stats?.['Average Headshots %'] || seg.hsPercent || '0');
        const mAvgKills = parseFloat(seg.k1 || seg.stats?.['Average Kills'] || seg.avgKills || '0');
        const mAdr = parseFloat(seg.c3 || seg.stats?.ADR || seg.adr || '78.0');
        const mWins = parseInt(seg.m2 || seg.stats?.Wins || seg.wins || Math.round((mCount * mWinRate) / 100).toString(), 10);

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
}

export const faceitApi = new FaceitApiService();
