import { describe, it, expect } from 'vitest';
import { calculateRiskScore } from '../src/services/riskScorer';
import { FaceitPlayerFullStats } from '../src/types/faceit';
import { SteamFullData } from '../src/types/steam';

describe('calculateRiskScore', () => {
  it('should return LOW risk for normal account with high matches and normal KD', () => {
    const player: FaceitPlayerFullStats = {
      playerId: 'legit-1',
      nickname: 'LegitPlayer',
      avatar: '',
      country: 'se',
      elo: 1500,
      skillLevel: 6,
      totalMatches: 850,
      overallWinRate: 51,
      overallKd: 1.05,
      overallHsPercent: 45,
      currentStreak: { type: 'W', count: 1 },
      recentMatches: [],
      mapStats: {},
    };

    const steam: SteamFullData = {
      isPrivate: false,
      summary: {
        steamId64: '76561198000000001',
        personaName: 'LegitSteam',
        profileUrl: '',
        avatar: '',
        communityVisibilityState: 3,
        accountAgeYears: 7,
      },
      playtime: {
        cs2HoursTotal: 2500,
        cs2HoursLast2Weeks: 30,
      },
      bans: {
        steamId64: '76561198000000001',
        communityBanned: false,
        vacBanned: false,
        numberOfVACBans: 0,
        daysSinceLastBan: 0,
        numberOfGameBans: 0,
        economyBan: 'none',
      },
      fetchedAt: Date.now(),
    };

    const result = calculateRiskScore(player, steam);
    expect(result.level).toBe('LOW');
    expect(result.score).toBeLessThan(25);
    expect(result.isPrivateSteam).toBe(false);
  });

  it('should return HIGH/CRITICAL risk for smurf with Level 10, low matches, high KD and low steam hours', () => {
    const smurf: FaceitPlayerFullStats = {
      playerId: 'smurf-1',
      nickname: 'GodSmurf',
      avatar: '',
      country: 'ru',
      elo: 2350,
      skillLevel: 10,
      totalMatches: 42,
      overallWinRate: 78,
      overallKd: 2.1,
      overallHsPercent: 62,
      currentStreak: { type: 'W', count: 7 },
      recentMatches: [],
      mapStats: {},
    };

    const steam: SteamFullData = {
      isPrivate: false,
      summary: {
        steamId64: '76561198000000002',
        personaName: 'FreshAccount',
        profileUrl: '',
        avatar: '',
        communityVisibilityState: 3,
        accountAgeYears: 0.3,
      },
      playtime: {
        cs2HoursTotal: 85,
        cs2HoursLast2Weeks: 40,
      },
      bans: {
        steamId64: '76561198000000002',
        communityBanned: false,
        vacBanned: false,
        numberOfVACBans: 0,
        daysSinceLastBan: 0,
        numberOfGameBans: 0,
        economyBan: 'none',
      },
      fetchedAt: Date.now(),
    };

    const result = calculateRiskScore(smurf, steam);
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.level).toBe('CRITICAL');
    expect(result.flags.some((f) => f.id === 'lvl10_low_matches')).toBe(true);
    expect(result.flags.some((f) => f.id === 'extreme_kd')).toBe(true);
    expect(result.flags.some((f) => f.id === 'low_steam_hours')).toBe(true);
  });

  it('should flag private steam accounts correctly', () => {
    const player: FaceitPlayerFullStats = {
      playerId: 'p-1',
      nickname: 'PrivateGuy',
      avatar: '',
      country: 'de',
      elo: 1600,
      skillLevel: 7,
      totalMatches: 300,
      overallWinRate: 52,
      overallKd: 1.1,
      overallHsPercent: 48,
      currentStreak: { type: 'NONE', count: 0 },
      recentMatches: [],
      mapStats: {},
    };

    const steam: SteamFullData = {
      isPrivate: true,
      fetchedAt: Date.now(),
    };

    const result = calculateRiskScore(player, steam);
    expect(result.isPrivateSteam).toBe(true);
    expect(result.flags.some((f) => f.id === 'private_steam')).toBe(true);
  });
});
