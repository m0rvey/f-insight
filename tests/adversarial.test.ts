import { describe, it, expect } from 'vitest';
import {
  calculateTeamFcr,
  evaluatePlayerForm,
  calculateAdvancedMatchPrediction,
} from '../src/services/forecastEngine';
import { cacheManager } from '../src/services/cacheManager';
import { FaceitPlayerFullStats, PlayerRecentMatch } from '../src/types/faceit';
import { PremadeGroup } from '../src/types/settings';

describe('F-Insight Robustness & Vulnerability Fix Verification', () => {
  it('Verification 1: Robust calculateTeamFcr handles NaN/missing metrics properly without collapsing', () => {
    const players: FaceitPlayerFullStats[] = [
      {
        playerId: 'p_carry',
        nickname: 'CarryPlayer',
        elo: 3000,
        last30Kd: 2.5,
        last30Adr: 120,
      } as FaceitPlayerFullStats,
      {
        playerId: 'p_corrupted',
        nickname: 'CorruptedPlayer',
        elo: 1000,
        last30Kd: NaN,
      } as unknown as FaceitPlayerFullStats,
    ];

    const fcr = calculateTeamFcr(players);
    console.log('[FIXED] calculateTeamFcr safely calculated carry firepower rating:', fcr);
    
    // Carry gets proper high rating, not distorted fake 50%
    expect(fcr['p_carry']).toBeGreaterThan(60);
    expect(Number.isFinite(fcr['p_carry'])).toBe(true);
    expect(Number.isFinite(fcr['p_corrupted'])).toBe(true);
  });

  it('Verification 3: Corrupted/missing stats in match history fall back safely to baseline', () => {
    const missingStatsMatches: PlayerRecentMatch[] = [
      { matchId: 'm1', kills: undefined as any, deaths: 10, adr: 80, result: 'W' },
      { matchId: 'm2', kills: undefined as any, deaths: 10, adr: 80, result: 'W' },
    ];
    const form = evaluatePlayerForm(missingStatsMatches, 1.5, 90);
    console.log('[FIXED] evaluatePlayerForm with missing kills fell back to baseline safely:', form);
    expect(form.recentKd).toBe(1.5);
    expect(form.formStatus).toBe('STABLE');
  });

  it('Verification 4: Memory Cache stays within MAX_MEMORY_ENTRIES limit', async () => {
    for (let i = 0; i < 550; i++) {
      await cacheManager.set(`test_key_${i}`, { data: `val_${i}` }, 10000);
    }
    const stats = await cacheManager.getStats();
    console.log(`[FIXED] Cache entries count: ${stats.totalEntries} (Limit: 500)`);
    expect(stats.totalEntries).toBeLessThanOrEqual(500);
  });

  describe('calculateAdvancedMatchPrediction adversarial hardening', () => {
    const emptyPremades: PremadeGroup[] = [];

    const buildPlayer = (id: string, overrides: Partial<FaceitPlayerFullStats> = {}): FaceitPlayerFullStats =>
      ({
        playerId: id,
        nickname: id,
        elo: 1500,
        skillLevel: 5,
        totalMatches: 200,
        overallWinRate: 50,
        overallKd: 1.0,
        overallHsPercent: 45,
        currentStreak: { type: 'NONE', count: 0 },
        recentMatches: [],
        mapStats: {},
        formStatus: 'STABLE',
        recentKd: 1.0,
        recentAdr: 75,
        ...overrides,
      } as FaceitPlayerFullStats);

    const baseParams = {
      f1Players: [buildPlayer('f1_a'), buildPlayer('f1_b')],
      f2Players: [buildPlayer('f2_a'), buildPlayer('f2_b')],
      premadeGroups: emptyPremades,
      riskAnalysis: {},
      f1Fcr: {},
      f2Fcr: {},
    };

    it('Verification 5: NaN avg Elo inputs never produce NaN win chances or scores', () => {
      const res = calculateAdvancedMatchPrediction({
        ...baseParams,
        f1AvgElo: NaN,
        f2AvgElo: 1800,
      });

      expect(Number.isFinite(res.winChanceF1)).toBe(true);
      expect(Number.isFinite(res.winChanceF2)).toBe(true);
      expect(Number.isFinite(res.factors.eloDelta)).toBe(true);
      expect(res.winChanceF1 + res.winChanceF2).toBe(100);
      // NaN falls back to default 1000 Elo vs 1800 → faction2 favored
      expect(res.winChanceF2).toBeGreaterThan(res.winChanceF1);
    });

    it('Verification 6: Infinite avg Elo inputs fall back to the safe default rating', () => {
      const res = calculateAdvancedMatchPrediction({
        ...baseParams,
        f1AvgElo: Infinity,
        f2AvgElo: -Infinity,
      });

      // Non-finite inputs fall back to the 1000 Elo default on BOTH sides,
      // equal-average fallbacks → perfectly even match
      expect(Number.isFinite(res.winChanceF1)).toBe(true);
      expect(res.factors.eloDelta).toBe(0);
      expect(res.winChanceF1).toBe(50);
      expect(res.winChanceF2).toBe(50);
    });

    it('Verification 7: Empty rosters and missing maps degrade gracefully without crashing', () => {
      const res = calculateAdvancedMatchPrediction({
        f1AvgElo: 2000,
        f2AvgElo: 1400,
        f1Players: [],
        f2Players: [],
        selectedMap: undefined,
        premadeGroups: [],
        riskAnalysis: undefined as unknown as Record<string, never>,
        f1Fcr: {},
        f2Fcr: {},
      });

      expect(res.winChanceF1).toBeGreaterThan(res.winChanceF2);
      expect(res.predictedScore.f1Score).toBe(13);
      expect(res.starMatchup).toBeUndefined();
      expect(typeof res.keyAdvantageText).toBe('string');
      expect(res.keyAdvantageText.length).toBeGreaterThan(0);
    });
  });
});
