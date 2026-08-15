/**
 * CS2 FACEIT Official Skill Level Elo Boundaries
 */
export interface LevelBracket {
  level: number;
  minElo: number;
  maxElo: number | null; // Level 10 has no upper cap
}

export const CS2_LEVEL_BRACKETS: Record<number, LevelBracket> = {
  1: { level: 1, minElo: 1, maxElo: 500 },
  2: { level: 2, minElo: 501, maxElo: 750 },
  3: { level: 3, minElo: 751, maxElo: 900 },
  4: { level: 4, minElo: 901, maxElo: 1050 },
  5: { level: 5, minElo: 1051, maxElo: 1200 },
  6: { level: 6, minElo: 1201, maxElo: 1350 },
  7: { level: 7, minElo: 1351, maxElo: 1530 },
  8: { level: 8, minElo: 1531, maxElo: 1750 },
  9: { level: 9, minElo: 1751, maxElo: 2000 },
  10: { level: 10, minElo: 2001, maxElo: null },
};

export interface LevelProgressResult {
  currentLevel: number;
  currentElo: number;
  minElo: number;
  maxElo: number | null;
  progressPercent: number; // 0 to 100
  pointsToNext: number | null; // e.g. 45 or null if level 10
  pointsToDemotion: number | null; // e.g. 28 or null if level 1
  nextLevel: number | null;
  previousLevel: number | null;
}

/**
 * Calculates accurate Elo level progress, boundaries, and rank up/down deltas.
 */
export function calculateLevelProgress(
  rawElo: number,
  reportedLevel?: number
): LevelProgressResult {
  const currentElo = Math.max(1, Math.round(rawElo || 1000));

  // Determine actual level based on Elo
  let level = reportedLevel || 1;
  for (let lvl = 10; lvl >= 1; lvl--) {
    const bracket = CS2_LEVEL_BRACKETS[lvl];
    if (currentElo >= bracket.minElo) {
      level = lvl;
      break;
    }
  }

  const bracket = CS2_LEVEL_BRACKETS[level];
  const minElo = bracket.minElo;
  const maxElo = bracket.maxElo;

  let progressPercent = 100;
  let pointsToNext: number | null = null;
  let pointsToDemotion: number | null = null;

  if (maxElo !== null) {
    const range = maxElo - minElo + 1;
    const currentOffset = Math.max(0, currentElo - minElo);
    progressPercent = Math.min(100, Math.max(0, Math.round((currentOffset / range) * 100)));
    pointsToNext = Math.max(1, maxElo + 1 - currentElo);
  } else {
    // Level 10 (Master / Challenger progress indicator towards 2500, 3000 milestones)
    progressPercent = Math.min(100, Math.round(((currentElo - 2001) / 999) * 100));
    pointsToNext = null;
  }

  if (level > 1) {
    pointsToDemotion = Math.max(0, currentElo - minElo);
  }

  return {
    currentLevel: level,
    currentElo,
    minElo,
    maxElo,
    progressPercent,
    pointsToNext,
    pointsToDemotion,
    nextLevel: level < 10 ? level + 1 : null,
    previousLevel: level > 1 ? level - 1 : null,
  };
}
