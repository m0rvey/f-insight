import { describe, it, expect } from 'vitest';
import {
  calculateTeamFcr,
  evaluatePlayerForm,
  calculateAdvancedMatchPrediction,
  calculateMapVetoRanking,
} from '../src/services/forecastEngine';
import { FaceitPlayerFullStats, PlayerRecentMatch } from '../src/types/faceit';
import { RiskAnalysisResult } from '../src/types/risk';

describe('forecastEngine', () => {
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

    it('should NOT shift odds from a tiny map sample (Bayesian significance gate)', () => {
      // One lucky 3-0 map must not swing the prediction — combined sample < 10
      const tinyMapPlayer = (id: string, wr: number): FaceitPlayerFullStats => ({
        ...createDummyPlayer(id, 1500, 'STABLE', wr),
        mapStats: {
          mirage: {
            mapName: 'mirage', matches: 3, wins: Math.round((3 * wr) / 100), losses: 0,
            winRate: wr, kd: 1.1, hsPercent: 50, avgKills: 18, avgAdr: 80,
          },
        },
      });

      const pred = calculateAdvancedMatchPrediction({
        f1AvgElo: 1500,
        f2AvgElo: 1500,
        f1Players: [tinyMapPlayer('f1_a', 100)],
        f2Players: [tinyMapPlayer('f2_a', 0)],
        selectedMap: 'de_mirage',
        premadeGroups: [],
        riskAnalysis: {},
        f1Fcr: {},
        f2Fcr: {},
      });

      expect(pred.winChanceF1).toBe(50);
    });

    it('should mirror predicted scores and flag overtime only for genuinely close matchups', () => {
      const teamA = [1, 2, 3, 4, 5].map((i) => createDummyPlayer(`a_${i}`, 1510, 'STABLE'));
      const teamB = [1, 2, 3, 4, 5].map((i) => createDummyPlayer(`b_${i}`, 1490, 'STABLE'));

      const closePred = calculateAdvancedMatchPrediction({
        f1AvgElo: 1510,
        f2AvgElo: 1490,
        f1Players: teamA,
        f2Players: teamB,
        premadeGroups: [],
        riskAnalysis: {},
        f1Fcr: {},
        f2Fcr: {},
      });
      expect(Math.abs(closePred.winChanceF1 - 50)).toBeLessThanOrEqual(8);
      expect(closePred.predictedScore.isOvertimeLikely).toBe(true);
      expect(closePred.predictedScore.f1Score).toBe(13);
      expect(closePred.predictedScore.f2Score).toBe(11);

      const dominantPred = calculateAdvancedMatchPrediction({
        f1AvgElo: 2200,
        f2AvgElo: 1100,
        f1Players: teamA,
        f2Players: teamB,
        premadeGroups: [],
        riskAnalysis: {},
        f1Fcr: {},
        f2Fcr: {},
      });
      expect(dominantPred.predictedScore.isOvertimeLikely).toBe(false);
      // Mirror invariant
      expect(dominantPred.winChanceF1 + dominantPred.winChanceF2).toBe(100);
      expect(dominantPred.predictedScore.f1Score).toBe(13);
      expect(dominantPred.predictedScore.f2Score).toBeLessThanOrEqual(8);
    });
  });

  describe('smurf risk factor', () => {
    const createDummyPlayer = (id: string, elo: number, formStatus: 'HOT' | 'COLD' | 'STABLE'): FaceitPlayerFullStats => ({
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
      mapStats: {},
      formStatus,
      recentKd: 1.1,
      recentAdr: 80,
    });

    const makeRiskResult = (level: RiskAnalysisResult['level']): RiskAnalysisResult => ({
      score: level === 'HIGH' ? 70 : level === 'CRITICAL' ? 90 : 15,
      level,
      flags: [],
      isPrivateSteam: false,
      summary: '',
      color: '',
      badgeText: '',
    });

    it('should boost win chance when Team 1 carries flagged accounts', () => {
      const f1Players = [1, 2, 3, 4, 5].map((i) => createDummyPlayer(`f1_${i}`, 1500, 'STABLE'));
      const f2Players = [1, 2, 3, 4, 5].map((i) => createDummyPlayer(`f2_${i}`, 1500, 'STABLE'));

      const riskAnalysis: Record<string, RiskAnalysisResult> = {};
      f1Players.slice(0, 3).forEach((p, i) => {
        riskAnalysis[p.playerId] = makeRiskResult(i === 0 ? 'HIGH' : 'CRITICAL');
      });
      f2Players.forEach((p) => {
        riskAnalysis[p.playerId] = makeRiskResult('LOW');
      });

      const pred = calculateAdvancedMatchPrediction({
        f1AvgElo: 1500,
        f2AvgElo: 1500,
        f1Players,
        f2Players,
        premadeGroups: [],
        riskAnalysis,
        f1Fcr: {},
        f2Fcr: {},
      });

      expect(pred.winChanceF1).toBeGreaterThan(52);
      expect(pred.factors.smurfRiskDelta.f1HighRiskCount).toBe(3);
      expect(pred.factors.smurfRiskDelta.f2HighRiskCount).toBe(0);
      expect(pred.factors.smurfRiskDelta.impactPercent).toBe(6);
      expect(pred.keyAdvantageText).toContain('flagged accounts');
    });

    it('should not apply the factor when risk data is empty', () => {
      const f1Players = [1, 2, 3, 4, 5].map((i) => createDummyPlayer(`f1_${i}`, 1500, 'STABLE'));
      const f2Players = [1, 2, 3, 4, 5].map((i) => createDummyPlayer(`f2_${i}`, 1500, 'STABLE'));

      const pred = calculateAdvancedMatchPrediction({
        f1AvgElo: 1500,
        f2AvgElo: 1500,
        f1Players,
        f2Players,
        premadeGroups: [],
        riskAnalysis: {},
        f1Fcr: {},
        f2Fcr: {},
      });

      expect(pred.winChanceF1).toBe(50);
      expect(pred.factors.smurfRiskDelta.impactPercent).toBe(0);
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

    it('flips the perspective for faction2 users: their best map becomes rank 1', () => {
      // Faction 1 dominates mirage, faction 2 dominates nuke.
      const f1Players = [1, 2, 3, 4, 5].map((i) => createPlayerWithMap(`f1_${i}`, 'mirage', 50, 40, 1.4, 90));
      const f2Players = [1, 2, 3, 4, 5].map((i) => createPlayerWithMap(`f2_${i}`, 'nuke', 50, 40, 1.4, 90));

      const fromF1 = calculateMapVetoRanking({ f1Players, f2Players, userFaction: 'faction1' });
      const fromF2 = calculateMapVetoRanking({ f1Players, f2Players, userFaction: 'faction2' });

      // Same underlying numbers, opposite sign per map.
      const f1Delta = (name: string) => fromF1.find((r) => r.mapName === name)!.advantageDelta;
      const f2Delta = (name: string) => fromF2.find((r) => r.mapName === name)!.advantageDelta;
      expect(f2Delta('mirage')).toBe(-f1Delta('mirage'));
      expect(f2Delta('nuke')).toBe(-f1Delta('nuke'));

      // Rank 1 is "best for YOU": mirage for faction1 users, nuke for faction2.
      expect(fromF1[0].mapName).toBe('mirage');
      expect(fromF2[0].mapName).toBe('nuke');
      expect(fromF2[0].recommendation).toBe('MUST_PICK');
      expect(fromF2[0].advantageDelta).toBeGreaterThan(0);
    });
  });
});
