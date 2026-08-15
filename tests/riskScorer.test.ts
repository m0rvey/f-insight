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
      overallAdr: 75,
      currentStreak: { type: 'W', count: 1 },
      recentMatches: [],
      mapStats: {},
      formStatus: 'STABLE',
      recentKd: 1.05,
      recentAdr: 75,
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
      overallAdr: 120,
      currentStreak: { type: 'W', count: 7 },
      recentMatches: [],
      mapStats: {},
      formStatus: 'HOT',
      recentKd: 2.5,
      recentAdr: 130,
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
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.level).toBe('CRITICAL');
    expect(result.flags.some((f) => f.id.includes('lvl10'))).toBe(true);
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
      overallAdr: 80,
      currentStreak: { type: 'NONE', count: 0 },
      recentMatches: [],
      mapStats: {},
      formStatus: 'STABLE',
      recentKd: 1.1,
      recentAdr: 80,
    };

    const steam: SteamFullData = {
      isPrivate: true,
      fetchedAt: Date.now(),
    };

    const result = calculateRiskScore(player, steam);
    expect(result.isPrivateSteam).toBe(true);
    expect(result.flags.some((f) => f.id === 'private_steam')).toBe(true);
  });

  it('should not flag accounts as private when Steam data failed to fetch', () => {
    const player: FaceitPlayerFullStats = {
      playerId: 'p-2',
      nickname: 'NetworkIssues',
      avatar: '',
      country: 'fr',
      elo: 1500,
      skillLevel: 6,
      totalMatches: 300,
      overallWinRate: 52,
      overallKd: 1.1,
      overallHsPercent: 48,
      overallAdr: 80,
      currentStreak: { type: 'NONE', count: 0 },
      recentMatches: [],
      mapStats: {},
      formStatus: 'STABLE',
      recentKd: 1.1,
      recentAdr: 80,
    };

    const steam: SteamFullData = {
      isPrivate: true,
      fetchError: true,
      fetchedAt: Date.now(),
    };

    const result = calculateRiskScore(player, steam);
    expect(result.isPrivateSteam).toBe(false);
    expect(result.flags.some((f) => f.category === 'PRIVATE_PROFILE')).toBe(false);
  });

  it('should treat missing Steam data as unknown, not as a private profile', () => {
    const player: FaceitPlayerFullStats = {
      playerId: 'p-3',
      nickname: 'NoSteamId',
      avatar: '',
      country: 'uk',
      elo: 1500,
      skillLevel: 6,
      totalMatches: 300,
      overallWinRate: 52,
      overallKd: 1.1,
      overallHsPercent: 48,
      overallAdr: 80,
      currentStreak: { type: 'NONE', count: 0 },
      recentMatches: [],
      mapStats: {},
      formStatus: 'STABLE',
      recentKd: 1.1,
      recentAdr: 80,
    };

    const result = calculateRiskScore(player, undefined);
    expect(result.isPrivateSteam).toBe(false);
    expect(result.flags.some((f) => f.category === 'PRIVATE_PROFILE')).toBe(false);
  });

  it('should flag extreme ADR, ADR spike and headshot anomalies', () => {
    const player: FaceitPlayerFullStats = {
      playerId: 'adr-1',
      nickname: 'AdrGod',
      avatar: '',
      country: 'pl',
      elo: 1800,
      skillLevel: 8,
      totalMatches: 250,
      overallWinRate: 55,
      overallKd: 1.3,
      overallHsPercent: 63,
      overallAdr: 96,
      last30Adr: 102,
      last30AdrMatches: 28,
      last30HsPercent: 61,
      currentStreak: { type: 'W', count: 2 },
      recentMatches: [],
      mapStats: {},
      formStatus: 'STABLE',
      recentKd: 1.4,
      recentAdr: 118,
    };

    const result = calculateRiskScore(player, undefined);
    expect(result.flags.some((f) => f.id === 'extreme_adr')).toBe(true);
    expect(result.flags.some((f) => f.id === 'recent_extreme_adr')).toBe(true);
    expect(result.flags.some((f) => f.id === 'recent_adr_spike')).toBe(true);
    expect(result.flags.some((f) => f.id === 'extreme_hs_recent')).toBe(true);
  });

  it('should flag 30-match dominance and mid-term K/D spike', () => {
    const player: FaceitPlayerFullStats = {
      playerId: 'dom-1',
      nickname: 'Dominator',
      avatar: '',
      country: 'se',
      elo: 1700,
      skillLevel: 7,
      totalMatches: 180,
      overallWinRate: 58,
      overallKd: 1.1,
      overallHsPercent: 48,
      overallAdr: 82,
      last30Kd: 1.65,
      last30WinRate: 87,
      last30Matches: 30,
      currentStreak: { type: 'W', count: 5 },
      recentMatches: [],
      mapStats: {},
      formStatus: 'HOT',
      recentKd: 1.8,
      recentAdr: 95,
    };

    const result = calculateRiskScore(player, undefined);
    expect(result.flags.some((f) => f.id === 'recent_dominance')).toBe(true);
    expect(result.flags.some((f) => f.id === 'midterm_kd_spike')).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(25);
  });

  it('should scale hidden-profile suspicion with Elo and flag fresh FACEIT accounts', () => {
    const player: FaceitPlayerFullStats = {
      playerId: 'hid-1',
      nickname: 'HiddenHighElo',
      avatar: '',
      country: 'ru',
      elo: 2100,
      skillLevel: 10,
      totalMatches: 90,
      overallWinRate: 54,
      overallKd: 1.2,
      overallHsPercent: 47,
      overallAdr: 85,
      registrationDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      currentStreak: { type: 'NONE', count: 0 },
      recentMatches: [],
      mapStats: {},
      formStatus: 'STABLE',
      recentKd: 1.3,
      recentAdr: 85,
    };

    const steam: SteamFullData = {
      isPrivate: true,
      fetchedAt: Date.now(),
    };

    const result = calculateRiskScore(player, steam);
    expect(result.isPrivateSteam).toBe(true);
    expect(result.flags.some((f) => f.id === 'hidden_high_elo')).toBe(true);
    expect(result.flags.some((f) => f.id === 'private_steam_fresh_account')).toBe(true);
    expect(result.flags.some((f) => f.id === 'fresh_faceit_high_elo')).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(45);
  });
});
