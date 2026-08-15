import { describe, it, expect } from 'vitest';
import { parsePlayerPayload } from '../src/services/faceitApi';

const PLAYER_ID = 'player-1';

describe('parsePlayerPayload', () => {
  it('should parse stats in human-readable form', () => {
    const user = { nickname: 'PlayerX', games: { cs2: { faceit_elo: 1500, skill_level: 8 } } };
    const stats = {
      lifetime: {
        'Total Matches': '150',
        'Win Rate %': '58.2',
        'Average K/D Ratio': '1.31',
        'Average Headshots %': '52',
        ADR: '84.5',
      },
      segments: [
        {
          _id: { segmentId: 'cs2_mirage' },
          stats: {
            Matches: '40',
            Wins: '26',
            'Win Rate %': '65',
            'K/D Ratio': '1.4',
            'Average Headshots %': '55',
            'Average Kills': '20',
            ADR: '86',
          },
        },
      ],
    };

    const result = parsePlayerPayload(PLAYER_ID, undefined, user, stats, null, []);

    expect(result.totalMatches).toBe(150);
    expect(result.overallWinRate).toBe(58.2);
    expect(result.overallKd).toBe(1.31);
    expect(result.overallHsPercent).toBe(52);
    expect(result.overallAdr).toBeCloseTo(84.5);
    expect(result.mapStats['mirage']).toBeDefined();
    expect(result.mapStats['mirage'].matches).toBe(40);
    expect(result.mapStats['mirage'].wins).toBe(26);
    expect(result.mapStats['mirage'].kd).toBe(1.4);
  });

  it('should parse stats in indexed form', () => {
    const user = { nickname: 'PlayerX', games: { cs2: { faceit_elo: 1500, skill_level: 8 } } };
    const stats = {
      lifetime: { m1: '150', k6: '58.2', k5: '1.31', k8: '52', c3: '84.5' },
      segments: [{ _id: { segmentId: 'cs2_mirage' }, m1: '40', m2: '26', k6: '65', k5: '1.4', k8: '55', k1: '20', c3: '86' }],
    };

    const result = parsePlayerPayload(PLAYER_ID, undefined, user, stats, null, []);

    expect(result.totalMatches).toBe(150);
    expect(result.overallWinRate).toBe(58.2);
    expect(result.overallKd).toBe(1.31);
    expect(result.overallHsPercent).toBe(52);
    expect(result.overallAdr).toBeCloseTo(84.5);
    expect(result.mapStats['mirage']).toBeDefined();
    expect(result.mapStats['mirage'].matches).toBe(40);
    expect(result.mapStats['mirage'].wins).toBe(26);
    expect(result.mapStats['mirage'].kd).toBe(1.4);
  });

  it('should parse recent match history', () => {
    const history = [{ i10: '1', i1: 'cs2_mirage', i6: '20', i8: '15', c2: '1.33', c3: '90', elo: '1500' }];

    const result = parsePlayerPayload(PLAYER_ID, undefined, null, null, null, history);

    expect(result.recentMatches).toHaveLength(1);
    expect(result.recentMatches[0].result).toBe('W');
    expect(result.recentMatches[0].kills).toBe(20);
    expect(result.recentMatches[0].kd).toBeCloseTo(1.33);
    expect(result.recentMatches[0].map).toBe('mirage');
  });
});
