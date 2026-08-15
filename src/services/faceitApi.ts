import {
  FaceitMatchDetails,
  FaceitPlayerFullStats,
  MapSpecificStats,
  PlayerRecentMatch,
} from '../types/faceit';
import { evaluatePlayerForm } from './forecastEngine';

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
      const [userRes, statsRes, historyRes] = await Promise.allSettled([
        fetch(`https://api.faceit.com/users/v1/users/${playerId}`, { headers: { Accept: 'application/json' } }),
        fetch(`https://api.faceit.com/stats/v1/stats/users/${playerId}/games/cs2`, { headers: { Accept: 'application/json' } }),
        fetch(`https://api.faceit.com/stats/v1/stats/time/users/${playerId}/games/cs2?size=20`, { headers: { Accept: 'application/json' } }),
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
        history = (hJson.payload || hJson) || [];
      }

      return this.parsePlayerPayload(playerId, fallbackNickname, user, stats, history);
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

    const locationNameMap: Record<string, string> = {
      germany: 'Germany (Frankfurt)',
      finland: 'Finland (Helsinki)',
      sweden: 'Sweden (Stockholm)',
      netherlands: 'Netherlands (Amsterdam)',
      uk: 'United Kingdom (London)',
      france: 'France (Paris)',
      poland: 'Poland (Warsaw)',
      kazakhstan: 'Kazakhstan (Almaty)',
      almaty: 'Kazakhstan (Almaty)',
      moscow: 'Russia (Moscow)',
      dallas: 'US (Dallas)',
      chicago: 'US (Chicago)',
      denver: 'US (Denver)',
      singapore: 'Singapore',
      brazil: 'Brazil (São Paulo)',
      sao_paulo: 'Brazil (São Paulo)',
    };

    const formattedLocation = locationRaw
      ? locationNameMap[locationRaw.toLowerCase()] || locationRaw
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
    user: any,
    stats: any,
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
    const lifetime = stats?.lifetime || {};
    const totalMatches = parseInt(lifetime.m1 || lifetime.Matches || '0', 10);
    const overallWinRate = parseFloat(lifetime.k6 || lifetime['Win Rate %'] || '0');
    const overallKd = parseFloat(lifetime.k5 || lifetime['Average K/D Ratio'] || '1.0');
    const overallHsPercent = parseFloat(lifetime.k8 || lifetime['Average Headshots %'] || '0');
    const overallAdr = parseFloat(lifetime.c3 || lifetime.adr || '78.5');

    // Segments breakdown (Maps)
    const mapStats: Record<string, MapSpecificStats> = {};
    const segments = stats?.segments || [];
    for (const seg of segments) {
      const mapLabel = (seg._id?.label || seg.label || '').replace('de_', '').toLowerCase();
      if (mapLabel) {
        const mCount = parseInt(seg.m1 || seg.stats?.Matches || '0', 10);
        const mWinRate = parseFloat(seg.k6 || seg.stats?.['Win Rate %'] || '0');
        const mKd = parseFloat(seg.k5 || seg.stats?.['Average K/D Ratio'] || '1.0');
        const mHs = parseFloat(seg.k8 || seg.stats?.['Average Headshots %'] || '0');
        const mAvgKills = parseFloat(seg.k1 || seg.stats?.['Average Kills'] || '0');
        const mAdr = parseFloat(seg.c3 || seg.stats?.ADR || '78.0');
        const mWins = parseInt(seg.m2 || seg.stats?.Wins || '0', 10);

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

    // Recent Match History (last 20 matches)
    const recentMatches: PlayerRecentMatch[] = [];
    let currentStreakCount = 0;
    let currentStreakType: 'W' | 'L' | 'NONE' = 'NONE';

    if (Array.isArray(history)) {
      for (let i = 0; i < history.length; i++) {
        const item = history[i];
        const isWin = item.i10 === '1' || item.result === '1' || item.stats?.Result === '1';
        const res: 'W' | 'L' = isWin ? 'W' : 'L';

        if (i === 0) {
          currentStreakType = res;
          currentStreakCount = 1;
        } else if (currentStreakType !== 'NONE' && res === currentStreakType) {
          currentStreakCount++;
        }

        recentMatches.push({
          matchId: item.matchId || item.i0 || `match-${i}`,
          playedAt: item.date || item.created_at || 0,
          map: (item.i1 || item.stats?.Map || '').replace('de_', '').toLowerCase(),
          result: res,
          score: item.i18 || item.stats?.Score || '13:0',
          kills: parseInt(item.i6 || item.stats?.Kills || '0', 10),
          deaths: parseInt(item.i8 || item.stats?.Deaths || '0', 10),
          kd: parseFloat(item.c2 || item.stats?.['K/D Ratio'] || '1.0'),
          hsPercent: parseFloat(item.c4 || item.stats?.['Headshots %'] || '0'),
          adr: parseFloat(item.c3 || item.adr || '78.0'),
        });
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
