import { describe, it, expect } from 'vitest';
import { parsePlayerPayload, parseMatchPayload } from '../src/services/faceitApi';

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
    expect(result.recentMatches[0].adr).toBe(90);
    expect(result.last30Matches).toBe(1);
    expect(result.last30Kd).toBeCloseTo(1.33);
    expect(result.last30Adr).toBe(90);
    expect(result.last30AdrMatches).toBe(1);
    expect(result.last30WinRate).toBe(100);
  });

  it('should NOT fabricate ADR when missing in lifetime and history', () => {
    const user = { nickname: 'NoAdr', games: { cs2: { faceit_elo: 1200, skill_level: 5 } } };
    const stats = {
      lifetime: { m1: '50', k6: '50', k5: '1.1', k8: '40' },
      segments: [],
    };
    const history = [{ i10: '1', i1: 'cs2_mirage', i6: '18', i8: '12', c2: '1.5' }];

    const result = parsePlayerPayload(PLAYER_ID, undefined, user, stats, null, history);

    expect(result.overallAdr).toBeUndefined();
    expect(result.recentMatches[0].adr).toBeUndefined();
    expect(result.last30Adr).toBeUndefined();
    expect(result.last30AdrMatches).toBe(0);
    expect(result.mapStats['mirage'].avgAdr).toBeUndefined();
  });

  it('should compute last-30 aggregates over real ADR/KD data only', () => {
    const history = Array.from({ length: 40 }, (_, i) => {
      const isWin = i % 2 === 0 ? '1' : '0';
      const withAdr = i < 25; // first 25 (most recent) have ADR, last 15 do not
      return {
        i10: isWin,
        i1: 'cs2_inferno',
        i6: String(20 + i),
        i8: String(10 + i),
        c3: withAdr ? String(80 + (i % 20)) : undefined,
        elo: String(1500 + i),
      };
    });

    const result = parsePlayerPayload(PLAYER_ID, undefined, null, null, null, history);

    expect(result.recentMatches).toHaveLength(40);
    expect(result.last30Matches).toBe(30);
    // Sum kills over first 30 (i=0..29): sum(20+i) = 20*30 + 435 = 1035
    // Sum deaths over first 30 (i=0..29): sum(10+i) = 10*30 + 435 = 735
    expect(result.last30Kd).toBeCloseTo(1035 / 735, 2);
    // ADR real only: i=0..24 have ADR (80 + i%20)
    const adrValues = Array.from({ length: 25 }, (_, i) => 80 + (i % 20));
    const expectedAdr = Math.round(adrValues.reduce((s, a) => s + a, 0) / adrValues.length);
    expect(result.last30Adr).toBe(expectedAdr);
    expect(result.last30AdrMatches).toBe(25);
    // 15 wins out of 30
    expect(result.last30WinRate).toBe(50);
  });

  it('should compute last-30 aggregates when history has fewer than 30 matches', () => {
    const history = Array.from({ length: 7 }, (_, i) => ({
      i10: '1',
      i1: 'cs2_mirage',
      i6: '20',
      i8: '15',
      c3: '85',
    }));

    const result = parsePlayerPayload(PLAYER_ID, undefined, null, null, null, history);

    expect(result.last30Matches).toBe(7);
    expect(result.last30Kd).toBeCloseTo(20 / 15, 2);
    expect(result.last30Adr).toBe(85);
    expect(result.last30WinRate).toBe(100);
  });

  it('should read per-match ADR/HS from the named stats object (CS2 shape)', () => {
    const history = [
      {
        i10: '1',
        i1: 'cs2_mirage',
        i6: '20',
        i8: '15',
        // Named per-match stats as returned by newer CS2 payloads
        stats: { Kills: '20', Deaths: '15', ADR: '87.5', 'Headshots %': '41' },
        // Legacy columns deliberately wrong here — named stats must win
        c3: '999',
        c4: '13',
      },
    ];

    const result = parsePlayerPayload(PLAYER_ID, undefined, null, null, null, history);

    expect(result.recentMatches[0].adr).toBeCloseTo(87.5);
    expect(result.recentMatches[0].hsPercent).toBeCloseTo(41);
    expect(result.last30Adr).toBe(88); // Math.round(avg of single value)
  });

  it('should rescue ADR from a swapped column via the headshot-count anchor', () => {
    // kills=20, headshots(i9)=8 -> real HS% is 40. The payload carries HS%
    // in c3 (era-drifted column semantics) and ADR in c4.
    const history = [{ i10: '1', i1: 'cs2_dust2', i6: '20', i8: '15', i9: '8', c3: '40', c4: '82' }];

    const result = parsePlayerPayload(PLAYER_ID, undefined, null, null, null, history);

    expect(result.recentMatches[0].adr).toBe(82);
    expect(result.recentMatches[0].hsPercent).toBe(40);
    expect(result.last30Adr).toBe(82);
  });

  it('should approximate overall ADR from map segments when lifetime lacks it', () => {
    const user = { nickname: 'SegAdr', games: { cs2: { faceit_elo: 2000, skill_level: 9 } } };
    const stats = {
      lifetime: { 'Total Matches': '30', 'Win Rate %': '55', 'Average K/D Ratio': '1.2', 'Average Headshots %': '45' },
      segments: [
        {
          _id: { segmentId: 'cs2_mirage' },
          stats: { Matches: '20', Wins: '12', 'Win Rate %': '60', 'K/D Ratio': '1.3', ADR: '90' },
        },
        {
          _id: { segmentId: 'cs2_nuke' },
          stats: { Matches: '10', Wins: '4', 'Win Rate %': '40', 'K/D Ratio': '1.1', ADR: '70' },
        },
      ],
    };

    const result = parsePlayerPayload(PLAYER_ID, undefined, user, stats, null, []);

    // (90*20 + 70*10) / 30 = 83.33... rounded to one decimal
    expect(result.overallAdr).toBeCloseTo(83.3);
  });

  it('should strip thousands separators from lifetime and segment numbers', () => {
    const user = { nickname: 'CommaGuy', games: { cs2: { faceit_elo: 2100, skill_level: 10 } } };
    const stats = {
      lifetime: {
        'Total Matches': '1,234',
        'Win Rate %': '55',
        'Average K/D Ratio': '1.10',
        'Average Headshots %': '48',
      },
      segments: [
        {
          _id: { segmentId: 'cs2_mirage' },
          stats: {
            Matches: '1,100',
            Wins: '620',
            'Win Rate %': '56',
            'K/D Ratio': '1.1',
          },
        },
      ],
    };

    const result = parsePlayerPayload(PLAYER_ID, undefined, user, stats, null, []);

    expect(result.totalMatches).toBe(1234);
    expect(result.mapStats['mirage'].matches).toBe(1100);
    expect(result.mapStats['mirage'].wins).toBe(620);
  });

  it('should mark statsAvailable=false and never NaN when lifetime data is missing', () => {
    // Simulates a partial API failure: /users/v1 answered, stats endpoints failed
    const user = { nickname: 'NoStats', games: { cs2: { faceit_elo: 2400, skill_level: 10 } } };

    const result = parsePlayerPayload(PLAYER_ID, undefined, user, null, null, []);

    expect(result.statsAvailable).toBe(false);
    expect(result.totalMatches).toBe(0);
    expect(Number.isFinite(result.overallKd)).toBe(true);
    expect(Number.isFinite(result.elo)).toBe(true);
  });

  it('should mark statsAvailable=true when lifetime aggregates are present', () => {
    const user = { nickname: 'HasStats', games: { cs2: { faceit_elo: 1500, skill_level: 6 } } };
    const stats = { lifetime: { m1: '120', k6: '52', k5: '1.05', k8: '45' }, segments: [] };

    const result = parsePlayerPayload(PLAYER_ID, undefined, user, stats, null, []);

    expect(result.statsAvailable).toBe(true);
    expect(result.totalMatches).toBe(120);
  });
});

describe('parseMatchPayload', () => {
  it('should pick the LAST map pick as the selected map (veto order accumulates)', () => {
    const payload = {
      id: 'match-1',
      status: 'VOTING',
      teams: { faction1: { name: 'A', roster: [] }, faction2: { name: 'B', roster: [] } },
      voting: {
        map: {
          pick: ['de_mirage', 'de_inferno'],
          entities: [{ name: 'de_mirage', status: 'drop' }, { name: 'de_inferno', status: 'pick' }],
        },
      },
    };

    const result = parseMatchPayload(payload);
    expect(result.selected_map).toBe('de_inferno');
  });

  it('should fall back to the last entity with status pick', () => {
    const payload = {
      id: 'match-2',
      status: 'VOTING',
      teams: { faction1: { name: 'A', roster: [] }, faction2: { name: 'B', roster: [] } },
      voting: {
        map: {
          entities: [
            { name: 'de_nuke', status: 'pick' },
            { name: 'de_ancient', status: 'pick' },
          ],
        },
      },
    };

    const result = parseMatchPayload(payload);
    expect(result.selected_map).toBe('de_ancient');
  });
});
