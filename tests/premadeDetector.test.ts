import { describe, it, expect } from 'vitest';
import { detectPremades } from '../src/services/premadeDetector';
import { FaceitMatchDetails, FaceitPlayerFullStats } from '../src/types/faceit';

describe('detectPremades', () => {
  it('should detect premades via party_id in roster', () => {
    const match: FaceitMatchDetails = {
      match_id: 'test-match-1',
      game: 'cs2',
      region: 'EU',
      status: 'ON_GOING',
      teams: {
        faction1: {
          faction_id: 'f1',
          name: 'Team Alpha',
          roster: [
            { player_id: 'p1', nickname: 'Player1', party_id: 'party-xyz' },
            { player_id: 'p2', nickname: 'Player2', party_id: 'party-xyz' },
            { player_id: 'p3', nickname: 'Player3', party_id: 'party-xyz' },
            { player_id: 'p4', nickname: 'Player4' },
            { player_id: 'p5', nickname: 'Player5' },
          ],
        },
        faction2: {
          faction_id: 'f2',
          name: 'Team Beta',
          roster: [
            { player_id: 'p6', nickname: 'Player6', party_id: 'party-abc' },
            { player_id: 'p7', nickname: 'Player7', party_id: 'party-abc' },
            { player_id: 'p8', nickname: 'Player8' },
            { player_id: 'p9', nickname: 'Player9' },
            { player_id: 'p10', nickname: 'Player10' },
          ],
        },
      },
    };

    const playersStats: Record<string, FaceitPlayerFullStats> = {};

    const groups = detectPremades(match, playersStats);
    expect(groups.length).toBe(2);
    expect(groups[0].playerIds).toEqual(['p1', 'p2', 'p3']);
    expect(groups[1].playerIds).toEqual(['p6', 'p7']);
  });

  it('should detect premades via shared match history overlap when party_id is missing', () => {
    const match: FaceitMatchDetails = {
      match_id: 'test-match-2',
      game: 'cs2',
      region: 'EU',
      status: 'ON_GOING',
      teams: {
        faction1: {
          faction_id: 'f1',
          name: 'Team Alpha',
          roster: [
            { player_id: 'p1', nickname: 'Player1' },
            { player_id: 'p2', nickname: 'Player2' },
            { player_id: 'p3', nickname: 'Player3' },
          ],
        },
        faction2: {
          faction_id: 'f2',
          name: 'Team Beta',
          roster: [],
        },
      },
    };

    const createDummyStats = (id: string, matchIds: string[]): FaceitPlayerFullStats => ({
      playerId: id,
      nickname: `Player_${id}`,
      avatar: '',
      country: 'se',
      elo: 1500,
      skillLevel: 5,
      totalMatches: 100,
      overallWinRate: 50,
      overallKd: 1.0,
      overallHsPercent: 40,
      currentStreak: { type: 'NONE', count: 0 },
      recentMatches: matchIds.map((mId) => ({
        matchId: mId,
        playedAt: 12345,
        map: 'mirage',
        result: 'W',
        score: '13:5',
        kills: 15,
        deaths: 10,
        kd: 1.5,
        hsPercent: 50,
      })),
      mapStats: {},
    });

    const playersStats: Record<string, FaceitPlayerFullStats> = {
      p1: createDummyStats('p1', ['match-101', 'match-102', 'match-103', 'match-104']),
      p2: createDummyStats('p2', ['match-101', 'match-102', 'match-103', 'match-999']),
      p3: createDummyStats('p3', ['match-555', 'match-666', 'match-777']),
    };

    const groups = detectPremades(match, playersStats);
    expect(groups.length).toBe(1);
    expect(groups[0].playerIds).toEqual(['p1', 'p2']);
  });

  it('documents BFS transitive closure — p1-p2 and p2-p3 linked yields single cluster (known backlog)', () => {
    const match: FaceitMatchDetails = {
      match_id: 'test-transitive',
      game: 'cs2',
      region: 'EU',
      status: 'ON_GOING',
      teams: {
        faction1: {
          faction_id: 'f1',
          name: 'Team',
          roster: [
            { player_id: 'p1', nickname: 'P1' },
            { player_id: 'p2', nickname: 'P2' },
            { player_id: 'p3', nickname: 'P3' },
          ],
        },
        faction2: { faction_id: 'f2', name: 'Opp', roster: [] },
      },
    };
    const mk = (id: string, mids: string[]): FaceitPlayerFullStats => ({
      playerId: id,
      nickname: id,
      avatar: '',
      country: 'se',
      elo: 1500,
      skillLevel: 5,
      totalMatches: 100,
      overallWinRate: 50,
      overallKd: 1.0,
      overallHsPercent: 40,
      currentStreak: { type: 'NONE', count: 0 },
      recentMatches: mids.map((mId) => ({
        matchId: mId,
        playedAt: 1,
        map: 'mirage',
        result: 'W' as const,
        score: '13:5',
        kills: 10,
        deaths: 10,
        kd: 1.0,
        hsPercent: 40,
      })),
      mapStats: {},
    });
    // p1 shares 2 with p2 (a,b), p2 shares 2 with p3 (c,d), p1/p3 share 0
    const stats: Record<string, FaceitPlayerFullStats> = {
      p1: mk('p1', ['a', 'b', 'x1', 'x2']),
      p2: mk('p2', ['a', 'b', 'c', 'd']),
      p3: mk('p3', ['c', 'd', 'y1', 'y2']),
    };
    const groups = detectPremades(match, stats);
    // Current BFS merges all 3; future clique-check should split into strict cliques.
    expect(groups.length).toBe(1);
    expect(groups[0].playerIds.sort()).toEqual(['p1', 'p2', 'p3'].sort());
  });
});
