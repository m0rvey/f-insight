import { describe, it, expect } from 'vitest';
import { buildStatsFromInterceptedParts } from '../src/services/faceitApi';

const GUID = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';

/** Shape mirrors what FACEIT's own SPA fetches for a player modal. */
const userPayload = {
  nickname: 's1mple',
  avatar: 'https://cdn.faceit.com/avatar.png',
  country: 'UA',
  games: {
    cs2: {
      faceit_elo: 3500,
      skill_level: 10,
      game_player_id: '76561198000000000',
    },
  },
};

const statsPayload = {
  lifetime: {
    'Total Matches': '3000',
    'Win Rate %': '55',
    'Average K/D Ratio': '1.25',
    'Average Headshots %': '45',
    ADR: '80.5',
  },
  segments: [],
};

const historyItem = (overrides: Record<string, string>) => ({
  i0: `match-${Math.random().toString(36).slice(2, 8)}`,
  i10: '1', // win
  i1: 'de_mirage',
  i6: '20', // kills
  i8: '15', // deaths
  elo: '3500',
  date: Date.now(),
  ...overrides,
});

describe('buildStatsFromInterceptedParts', () => {
  it('returns null when nothing usable was intercepted', () => {
    expect(buildStatsFromInterceptedParts(GUID, {})).toBeNull();
    expect(buildStatsFromInterceptedParts(GUID, { time: [] })).toBeNull();
  });

  it('hydrates roster basics from a users-only snapshot and stays statsAvailable:false', () => {
    const stats = buildStatsFromInterceptedParts(GUID, { user: userPayload });
    expect(stats).not.toBeNull();
    expect(stats!.nickname).toBe('s1mple');
    expect(stats!.elo).toBe(3500);
    expect(stats!.skillLevel).toBe(10);
    expect(stats!.steamId64).toBe('76561198000000000');
    // Data Availability Contract: without lifetime aggregates the card must
    // never masquerade as a real account.
    expect(stats!.statsAvailable).toBe(false);
  });

  it('produces a fully hydrated card when the page fetched all three parts', () => {
    const time = [
      historyItem({ i6: '25', i8: '10' }),
      historyItem({ i10: '0', i6: '12', i8: '20', i1: 'cs2_inferno' }),
    ];
    const stats = buildStatsFromInterceptedParts(GUID, {
      user: userPayload,
      stats: statsPayload,
      time,
    });
    expect(stats).not.toBeNull();
    expect(stats!.statsAvailable).toBe(true);
    expect(stats!.overallKd).toBeCloseTo(1.25);
    expect(stats!.totalMatches).toBe(3000);
    // Real per-match numbers must flow into recentMatches for the flyout.
    expect(stats!.recentMatches).toHaveLength(2);
    expect(stats!.recentMatches[0].kills).toBe(25);
    expect(stats!.recentMatches[0].kd).toBeCloseTo(2.5);
    // Map aggregates are derived even when lifetime segments are empty.
    expect(Object.keys(stats!.mapStats)).toEqual(expect.arrayContaining(['mirage']));
  });

  it('keeps partial hydration honest: time-only yields real KD but no lifetime claims', () => {
    const stats = buildStatsFromInterceptedParts(GUID, {
      time: [historyItem({ i6: '30', i8: '10' })],
    });
    expect(stats).not.toBeNull();
    expect(stats!.statsAvailable).toBe(false);
    expect(stats!.recentMatches[0].kills).toBe(30);
  });
});
