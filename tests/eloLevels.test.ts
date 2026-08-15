import { describe, it, expect } from 'vitest';
import { calculateLevelProgress, CS2_LEVEL_BRACKETS } from '../src/services/eloLevels';

describe('eloLevels service', () => {
  it('should accurately define CS2 Elo boundaries for levels 1 to 10', () => {
    expect(CS2_LEVEL_BRACKETS[1].minElo).toBe(1);
    expect(CS2_LEVEL_BRACKETS[1].maxElo).toBe(500);

    expect(CS2_LEVEL_BRACKETS[5].minElo).toBe(1051);
    expect(CS2_LEVEL_BRACKETS[5].maxElo).toBe(1200);

    expect(CS2_LEVEL_BRACKETS[10].minElo).toBe(2001);
    expect(CS2_LEVEL_BRACKETS[10].maxElo).toBeNull();
  });

  it('should calculate Level 1 progress and points to next level', () => {
    const progress = calculateLevelProgress(250);
    expect(progress.currentLevel).toBe(1);
    expect(progress.progressPercent).toBe(50);
    expect(progress.pointsToNext).toBe(251); // 501 - 250
    expect(progress.pointsToDemotion).toBeNull();
    expect(progress.nextLevel).toBe(2);
  });

  it('should calculate Level 5 progress with accurate demotion buffer', () => {
    const progress = calculateLevelProgress(1100);
    expect(progress.currentLevel).toBe(5);
    expect(progress.minElo).toBe(1051);
    expect(progress.maxElo).toBe(1200);
    expect(progress.pointsToNext).toBe(101); // 1201 - 1100
    expect(progress.pointsToDemotion).toBe(49); // 1100 - 1051
    expect(progress.nextLevel).toBe(6);
    expect(progress.previousLevel).toBe(4);
  });

  it('should handle Level 10 master/challenger tier (> 2000 Elo)', () => {
    const progress = calculateLevelProgress(2450);
    expect(progress.currentLevel).toBe(10);
    expect(progress.maxElo).toBeNull();
    expect(progress.pointsToNext).toBeNull();
    expect(progress.nextLevel).toBeNull();
    expect(progress.previousLevel).toBe(9);
    expect(progress.pointsToDemotion).toBe(449); // 2450 - 2001
  });
});
