import { describe, it, expect } from 'vitest';
import {
  calculateProjectedElo,
  calculateTeamFcr,
  evaluatePlayerForm,
  calculateAdvancedMatchPrediction,
  calculateMapVetoRanking,
} from '../src/services/forecastEngine';
import { FaceitPlayerFullStats, PlayerRecentMatch } from '../src/types/faceit';

describe('forecastEngine', () => {
  describe('calculateProjectedElo', () => {
    it('should return +25 / -25 when teams have equal average Elo', () => {
      const result = calculateProjectedElo(1500, 1500);
      expect(result.faction1.winGain).toBe(25);
      expect(result.faction1.lossLoss).toBe(25);
      expect(result.faction2.winGain).toBe(25);
      expect(result.faction2.lossLoss).toBe(25);
    });

    it('should calculate asymmetric stakes when Elo difference is significant', () => {
      // Faction 1 has 1800 Elo, Faction 2 has 1400 Elo (Delta 400)
      const result = calculateProjectedElo(1800, 1400);
      // Faction 1 is heavily favored: small gain on win, big loss on defeat
      expect(result.faction1.winGain).toBeLessThan(15);
      expect(result.faction1.lossLoss).toBeGreaterThan(40);
      // Faction 2 is underdog: big gain on win, small loss on defeat
      expect(result.faction2.winGain).toBeGreaterThan(40);
      expect(result.faction2.lossLoss).toBeLessThan(15);
    });
  });

  describe('calculateTeamFcr', () => {
    it('should sum all 5 players contribution to approximately 100%', () => {
      const createDummyPlayer = (id: string, elo: number, kd: number, adr: number): FaceitPlayerFullStats => ({
        playerId: id,
        nickname: `Player_${id}`,
        avatar: '',
        country: 'se',
        elo,
        skillLevel: 8,
        totalMatches: 200,
        overallWinRate: 55,
        overallKd: kd,
        overallHsPercent: 50,
        overallAdr: adr,
        currentStreak: { type: 'NONE', count: 0 },
        recentMatches: [],
        mapStats: {},
        formStatus: 'STABLE',
        recentKd: kd,
        recentAdr: adr,
      });

      const team: FaceitPlayerFullStats[] = [
        createDummyPlayer('p1', 2400, 1.6, 95), // Star carry
        createDummyPlayer('p2', 1900, 1.1, 80),
        createDummyPlayer('p3', 1800, 1.0, 75),
        createDummyPlayer('p4', 1700, 0.95, 72),
        createDummyPlayer('p5', 1500, 0.8, 65), // Support
      ];

      const fcrMap = calculateTeamFcr(team);
      const total = Object.values(fcrMap).reduce((a, b) => a + b, 0);

      expect(Math.round(total)).toBe(100);
      // Star carry should have highest share (> 25%)
      expect(fcrMap['p1']).toBeGreaterThan(25);
      // Lowest player should have lowest share (< 16%)
      expect(fcrMap['p5']).toBeLessThan(16);
    });
  });

  describe('evaluatePlayerForm', () => {
    it('should return HOT when last 5 games KD is > 15% higher than baseline', () => {
      const recentMatches: PlayerRecentMatch[] = [
        { matchId: 'm1', playedAt: 1, map: 'mirage', result: 'W', score: '13:5', kills: 22, deaths: 10, kd: 2.2, hsPercent: 50, adr: 105 },
        { matchId: 'm2', playedAt: 2, map: 'dust2', result: 'W', score: '13:7', kills: 19, deaths: 11, kd: 1.72, hsPercent: 45, adr: 92 },
        { matchId: 'm3', playedAt: 3, map: 'nuke', result: 'W', score: '13:9', kills: 24, deaths: 12, kd: 2.0, hsPercent: 60, adr: 110 },
      ];

      const form = evaluatePlayerForm(recentMatches, 1.1, 75);
      expect(form.formStatus).toBe('HOT');
      expect(form.recentKd).toBeGreaterThan(1.5);
    });

    it('should return COLD when last 5 games KD is significantly below baseline', () => {
      const recentMatches: PlayerRecentMatch[] = [
        { matchId: 'm1', playedAt: 1, map: 'mirage', result: 'L', score: '5:13', kills: 6, deaths: 15, kd: 0.4, hsPercent: 30, adr: 45 },
        { matchId: 'm2', playedAt: 2, map: 'dust2', result: 'L', score: '7:13', kills: 8, deaths: 16, kd: 0.5, hsPercent: 25, adr: 50 },
        { matchId: 'm3', playedAt: 3, map: 'nuke', result: 'L', score: '8:13', kills: 7, deaths: 14, kd: 0.5, hsPercent: 35, adr: 52 },
      ];

      const form = evaluatePlayerForm(recentMatches, 1.2, 80);
      expect(form.formStatus).toBe('COLD');
      expect(form.recentKd).toBeLessThan(0.7);
    });
  });

  describe('calculateAdvancedMatchPrediction', () => {
    const createDummyPlayer = (id: string, elo: number, formStatus: 'HOT' | 'COLD' | 'STABLE', mirageWr = 50): FaceitPlayerFullStats => ({
      playerId: id,
      nickname: `Player_${id}`,
      avatar: '',
      country: 'se',
      elo,
      skillLevel: 8,
      totalMatches: 200,
      overallWinRate: 55,
      overallKd: 1.1,
      overallHsPercent: 50,
      overallAdr: 80,
      currentStreak: { type: 'NONE', count: 0 },
      recentMatches: [],
      mapStats: {
        mirage: { mapName: 'mirage', matches: 40, wins: Math.round((40 * mirageWr) / 100), losses: 20, winRate: mirageWr, kd: 1.1, hsPercent: 50, avgKills: 18, avgAdr: 80 },
      },
      formStatus,
      recentKd: 1.1,
      recentAdr: 80,
    });

    it('should adjust win probability when Team 1 has strong Map Pool advantage', () => {
      const f1Players = [1, 2, 3, 4, 5].map((i) => createDummyPlayer(`f1_${i}`, 1500, 'STABLE', 75)); // 75% Mirage WR
      const f2Players = [1, 2, 3, 4, 5].map((i) => createDummyPlayer(`f2_${i}`, 1500, 'STABLE', 35)); // 35% Mirage WR

      const pred = calculateAdvancedMatchPrediction({
        f1AvgElo: 1500,
        f2AvgElo: 1500,
        f1Players,
        f2Players,
        selectedMap: 'de_mirage',
        premadeGroups: [],
        riskAnalysis: {},
        f1Fcr: {},
        f2Fcr: {},
      });

      expect(pred.winChanceF1).toBeGreaterThan(55);
      expect(pred.factors.mapAdvantage?.leader).toBe('faction1');
      expect(pred.predictedScore.f1Score).toBe(13);
    });
  });

  describe('calculateMapVetoRanking', () => {
    const createPlayerWithMap = (id: string, mapName: string, matches: number, wins: number, kd: number, adr: number): FaceitPlayerFullStats => ({
      playerId: id,
      nickname: `Player_${id}`,
      avatar: '',
      country: 'se',
      elo: 1800,
      skillLevel: 9,
      totalMatches: 300,
      overallWinRate: 58,
      overallKd: kd,
      overallHsPercent: 50,
      overallAdr: adr,
      currentStreak: { type: 'NONE', count: 0 },
      recentMatches: [],
      mapStats: {
        [mapName]: { mapName, matches, wins, losses: matches - wins, winRate: Math.round((wins / matches) * 100), kd, hsPercent: 50, avgKills: 20, avgAdr: adr },
      },
      formStatus: 'STABLE',
      recentKd: kd,
      recentAdr: adr,
    });

    it('should rank team best map as Rank 1 MUST_PICK and worst map as PERMABAN in full CS2 pool with Cache', () => {
      const f1Players = [1, 2, 3, 4, 5].map((i) => createPlayerWithMap(`f1_${i}`, 'mirage', 50, 40, 1.4, 90)); // Dominating on Mirage
      const f2Players = [1, 2, 3, 4, 5].map((i) => createPlayerWithMap(`f2_${i}`, 'nuke', 50, 40, 1.4, 90)); // Dominating on Nuke

      const rankings = calculateMapVetoRanking({ f1Players, f2Players });
      expect(rankings).toHaveLength(10);
      expect(rankings.some((r) => r.mapName === 'cache')).toBe(true);

      const rank1 = rankings[0];
      expect(rank1.mapName).toBe('mirage');
      expect(rank1.rank).toBe(1);
      expect(rank1.recommendation).toBe('MUST_PICK');
      expect(rank1.advantageDelta).toBeGreaterThan(0);

      const worstRank = rankings[rankings.length - 1];
      expect(worstRank.mapName).toBe('nuke');
      expect(worstRank.rank).toBe(10);
      expect(worstRank.recommendation).toBe('PERMABAN');
      expect(worstRank.advantageDelta).toBeLessThan(0);
    });

    it('should support dynamic availableMaps filter including cache', () => {
      const f1Players = [1, 2, 3, 4, 5].map((i) => createPlayerWithMap(`f1_${i}`, 'cache', 50, 40, 1.4, 90));
      const f2Players = [1, 2, 3, 4, 5].map((i) => createPlayerWithMap(`f2_${i}`, 'dust2', 50, 40, 1.4, 90));

      const rankings = calculateMapVetoRanking({
        f1Players,
        f2Players,
        availableMaps: ['de_cache', 'de_dust2', 'de_mirage'],
      });

      expect(rankings).toHaveLength(3);
      expect(rankings[0].mapName).toBe('cache');
      expect(rankings[0].rank).toBe(1);
      expect(rankings[0].recommendation).toBe('MUST_PICK');
    });
  });
});
