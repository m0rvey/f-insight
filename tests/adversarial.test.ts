import { describe, it, expect } from 'vitest';
import {
  calculateTeamFcr,
  calculateProjectedElo,
  evaluatePlayerForm,
} from '../src/services/forecastEngine';
import { cacheManager } from '../src/services/cacheManager';
import { FaceitPlayerFullStats, PlayerRecentMatch } from '../src/types/faceit';

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

  it('Verification 2: Projected Elo safely clamps and eliminates NaN on non-numeric inputs', () => {
    const res = calculateProjectedElo(NaN, 1500);
    console.log('[FIXED] calculateProjectedElo with NaN input produced safe defaults:', res);
    expect(Number.isFinite(res.faction1.winGain)).toBe(true);
    expect(Number.isFinite(res.faction1.lossLoss)).toBe(true);
    expect(res.faction1.winGain).toBeGreaterThanOrEqual(1);
    expect(res.faction1.winGain).toBeLessThanOrEqual(49);
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
});
