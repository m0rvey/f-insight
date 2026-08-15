import {
  FaceitPlayerFullStats,
  PlayerRecentMatch,
  PlayerFormStatus,
} from '../types/faceit';
import { ProjectedElo, AdvancedMatchPrediction } from '../types/messages';
import { PremadeGroup } from '../types/settings';
import { RiskAnalysisResult } from '../types/risk';

/**
 * Calculates projected Elo gain/loss for both teams based on team average Elo ratings.
 * Follows standard FACEIT 5v5 Elo rating curve (K-factor = 50).
 */
export function calculateProjectedElo(
  f1AvgElo: number,
  f2AvgElo: number
): { faction1: ProjectedElo; faction2: ProjectedElo } {
  const eloDiff = f2AvgElo - f1AvgElo;
  const expectedF1 = 1 / (1 + Math.pow(10, eloDiff / 400));
  const expectedF2 = 1 - expectedF1;

  const K = 50;
  const f1WinGain = Math.max(1, Math.min(49, Math.round(K * (1 - expectedF1))));
  const f1LossLoss = Math.max(1, Math.min(49, Math.round(K * expectedF1)));

  const f2WinGain = Math.max(1, Math.min(49, Math.round(K * (1 - expectedF2))));
  const f2LossLoss = Math.max(1, Math.min(49, Math.round(K * expectedF2)));

  return {
    faction1: {
      winGain: f1WinGain,
      lossLoss: f1LossLoss,
    },
    faction2: {
      winGain: f2WinGain,
      lossLoss: f2LossLoss,
    },
  };
}

/**
 * Calculates FCR (Firepower Contribution Rating) for players on a team.
 * Sum of all players on a team equals 100%. (20% is baseline, >25% indicates a primary carry).
 */
export function calculateTeamFcr(
  teamPlayers: FaceitPlayerFullStats[]
): Record<string, number> {
  const result: Record<string, number> = {};
  if (teamPlayers.length === 0) return result;

  const powers = teamPlayers.map((p) => {
    const eloWeight = Math.max(500, p.elo || 1000) / 1000;
    const kdWeight = Math.max(0.4, p.overallKd || 1.0);
    const adrWeight = 1 + ((p.overallAdr || 75) - 75) / 150;
    const power = eloWeight * kdWeight * Math.max(0.6, adrWeight);
    return { id: p.playerId, power };
  });

  const totalPower = powers.reduce((sum, item) => sum + item.power, 0);

  for (const item of powers) {
    const percent = totalPower > 0 ? (item.power / totalPower) * 100 : 100 / teamPlayers.length;
    result[item.id] = parseFloat(percent.toFixed(1));
  }

  return result;
}

/**
 * Evaluates a player's recent form and momentum by comparing their last 5 matches against their lifetime baseline.
 */
export function evaluatePlayerForm(
  recentMatches: PlayerRecentMatch[],
  overallKd: number,
  overallAdr: number
): { formStatus: PlayerFormStatus; recentKd: number; recentAdr: number } {
  if (!recentMatches || recentMatches.length < 2) {
    return {
      formStatus: 'STABLE',
      recentKd: overallKd || 1.0,
      recentAdr: overallAdr || 75,
    };
  }

  const last5 = recentMatches.slice(0, 5);
  const totalKills = last5.reduce((sum, m) => sum + (m.kills || 0), 0);
  const totalDeaths = last5.reduce((sum, m) => sum + (m.deaths || 0), 0);
  const recentKd = totalDeaths > 0 ? parseFloat((totalKills / totalDeaths).toFixed(2)) : parseFloat(totalKills.toFixed(2));

  const validAdrs = last5.map((m) => m.adr).filter((a): a is number => a !== undefined && a > 0);
  const recentAdr = validAdrs.length > 0
    ? Math.round(validAdrs.reduce((sum, a) => sum + a, 0) / validAdrs.length)
    : overallAdr || 75;

  const baselineKd = Math.max(0.5, overallKd || 1.0);
  const ratio = recentKd / baselineKd;

  let formStatus: PlayerFormStatus = 'STABLE';
  if (ratio >= 1.15 || (recentKd >= 1.4 && last5.filter((m) => m.result === 'W').length >= 4)) {
    formStatus = 'HOT';
  } else if (ratio <= 0.82 || (recentKd <= 0.75 && last5.filter((m) => m.result === 'L').length >= 4)) {
    formStatus = 'COLD';
  }

  return {
    formStatus,
    recentKd,
    recentAdr,
  };
}

/**
 * Comprehensive Multi-Factor CS2 Match Prediction Engine
 * Factors in: Base Elo differences, Map Pool history, Player Momentum (Hot/Cold),
 * Premade/Party Cohesion, and Smurf carry probability.
 */
export function calculateAdvancedMatchPrediction(params: {
  f1AvgElo: number;
  f2AvgElo: number;
  f1Players: FaceitPlayerFullStats[];
  f2Players: FaceitPlayerFullStats[];
  selectedMap?: string;
  premadeGroups: PremadeGroup[];
  riskAnalysis: Record<string, RiskAnalysisResult>;
  f1Fcr: Record<string, number>;
  f2Fcr: Record<string, number>;
}): AdvancedMatchPrediction {
  const {
    f1AvgElo,
    f2AvgElo,
    f1Players,
    f2Players,
    selectedMap,
    premadeGroups,
    riskAnalysis,
    f1Fcr,
    f2Fcr,
  } = params;

  // 1. Base Elo Probability (Logistic curve)
  const eloDiff = f2AvgElo - f1AvgElo;
  const baseWinProbF1 = 1 / (1 + Math.pow(10, eloDiff / 400));

  // 2. Map Advantage Factor
  let mapDelta = 0;
  let mapAdvantageData: AdvancedMatchPrediction['factors']['mapAdvantage'] = undefined;
  const cleanMap = (selectedMap || '').replace('de_', '').toLowerCase();

  if (cleanMap) {
    const f1MapWins = f1Players.reduce((acc, p) => acc + (p.mapStats?.[cleanMap]?.wins || 0), 0);
    const f1MapMatches = f1Players.reduce((acc, p) => acc + (p.mapStats?.[cleanMap]?.matches || 0), 0);
    const f1Wr = f1MapMatches > 0 ? Math.round((f1MapWins / f1MapMatches) * 100) : 50;

    const f2MapWins = f2Players.reduce((acc, p) => acc + (p.mapStats?.[cleanMap]?.wins || 0), 0);
    const f2MapMatches = f2Players.reduce((acc, p) => acc + (p.mapStats?.[cleanMap]?.matches || 0), 0);
    const f2Wr = f2MapMatches > 0 ? Math.round((f2MapWins / f2MapMatches) * 100) : 50;

    const deltaWr = f1Wr - f2Wr;
    // Map shift: up to ±12%
    mapDelta = Math.max(-0.12, Math.min(0.12, (deltaWr / 100) * 0.25));

    mapAdvantageData = {
      leader: deltaWr >= 5 ? 'faction1' : deltaWr <= -5 ? 'faction2' : 'balanced',
      mapName: cleanMap,
      f1WinRate: f1Wr,
      f2WinRate: f2Wr,
      deltaWinRate: Math.abs(deltaWr),
    };
  }

  // 3. Momentum & Player Form Factor
  const f1HotCount = f1Players.filter((p) => p.formStatus === 'HOT').length;
  const f1ColdCount = f1Players.filter((p) => p.formStatus === 'COLD').length;
  const f2HotCount = f2Players.filter((p) => p.formStatus === 'HOT').length;
  const f2ColdCount = f2Players.filter((p) => p.formStatus === 'COLD').length;

  const f1NetForm = f1HotCount - f1ColdCount;
  const f2NetForm = f2HotCount - f2ColdCount;
  // Momentum shift: up to ±10%
  const momentumDelta = Math.max(-0.10, Math.min(0.10, (f1NetForm - f2NetForm) * 0.03));

  // 4. Premade Party Cohesion Factor
  const f1Ids = new Set(f1Players.map((p) => p.playerId));
  const f2Ids = new Set(f2Players.map((p) => p.playerId));

  let f1MaxParty = 1;
  let f2MaxParty = 1;
  for (const group of premadeGroups) {
    const inF1 = group.playerIds.filter((id) => f1Ids.has(id)).length;
    const inF2 = group.playerIds.filter((id) => f2Ids.has(id)).length;
    if (inF1 > f1MaxParty) f1MaxParty = inF1;
    if (inF2 > f2MaxParty) f2MaxParty = inF2;
  }

  // Stack shift: up to ±8%
  const premadeDelta = Math.max(-0.08, Math.min(0.08, (f1MaxParty - f2MaxParty) * 0.02));

  // 5. Final Adjusted Win Chances
  const rawWinF1 = baseWinProbF1 + mapDelta + momentumDelta + premadeDelta;
  const clampedWinF1 = Math.max(0.06, Math.min(0.94, rawWinF1));
  const winChanceF1 = Math.round(clampedWinF1 * 100);
  const winChanceF2 = 100 - winChanceF1;

  // 6. MR12 Predicted Score Line
  let f1Score = 13;
  let f2Score = 9;
  let isOvertimeLikely = false;

  const diffProb = Math.abs(winChanceF1 - 50);
  if (diffProb <= 3) {
    f1Score = winChanceF1 >= 50 ? 13 : 11;
    f2Score = winChanceF1 >= 50 ? 11 : 13;
    isOvertimeLikely = true;
  } else if (diffProb <= 8) {
    f1Score = winChanceF1 >= 50 ? 13 : 10;
    f2Score = winChanceF1 >= 50 ? 10 : 13;
  } else if (diffProb <= 16) {
    f1Score = winChanceF1 >= 50 ? 13 : 8;
    f2Score = winChanceF1 >= 50 ? 8 : 13;
  } else if (diffProb <= 26) {
    f1Score = winChanceF1 >= 50 ? 13 : 5;
    f2Score = winChanceF1 >= 50 ? 5 : 13;
  } else {
    f1Score = winChanceF1 >= 50 ? 13 : 3;
    f2Score = winChanceF1 >= 50 ? 3 : 13;
  }

  // 7. Tactical Narrative Key Advantage Text
  const narratives: string[] = [];
  if (Math.abs(f1AvgElo - f2AvgElo) >= 60) {
    narratives.push(
      f1AvgElo > f2AvgElo
        ? `Team 1 holds +${Math.round(f1AvgElo - f2AvgElo)} avg Elo edge`
        : `Team 2 holds +${Math.round(f2AvgElo - f1AvgElo)} avg Elo edge`
    );
  }

  if (mapAdvantageData && mapAdvantageData.deltaWinRate >= 8) {
    narratives.push(
      mapAdvantageData.leader === 'faction1'
        ? `Team 1 dominates ${mapAdvantageData.mapName} (+${mapAdvantageData.deltaWinRate}% WR)`
        : `Team 2 dominates ${mapAdvantageData.mapName} (+${mapAdvantageData.deltaWinRate}% WR)`
    );
  }

  if (f1HotCount > f2HotCount && f1HotCount >= 2) {
    narratives.push(`Team 1 on hot momentum (${f1HotCount} players On Fire)`);
  } else if (f2HotCount > f1HotCount && f2HotCount >= 2) {
    narratives.push(`Team 2 on hot momentum (${f2HotCount} players On Fire)`);
  }

  if (f1MaxParty >= 3 && f1MaxParty > f2MaxParty) {
    narratives.push(`Team 1 has ${f1MaxParty}-stack coordination`);
  } else if (f2MaxParty >= 3 && f2MaxParty > f1MaxParty) {
    narratives.push(`Team 2 has ${f2MaxParty}-stack coordination`);
  }

  const keyAdvantageText = narratives.length > 0
    ? narratives.join(' • ')
    : 'Evenly matched teams with balanced firepower & map proficiency';

  // 8. Key Star Head-to-Head
  const findStar = (players: FaceitPlayerFullStats[], fcrMap: Record<string, number>) => {
    let topPlayer = players[0];
    let topScore = -1;
    for (const p of players) {
      const fcr = fcrMap[p.playerId] || 20;
      const score = fcr * 1.5 + (p.overallKd || 1.0) * 10;
      if (score > topScore) {
        topScore = score;
        topPlayer = p;
      }
    }
    return topPlayer
      ? {
          nickname: topPlayer.nickname,
          fcr: fcrMap[topPlayer.playerId] || 20,
          kd: topPlayer.overallKd || 1.0,
          elo: topPlayer.elo || 1000,
        }
      : undefined;
  };

  const f1Star = findStar(f1Players, f1Fcr);
  const f2Star = findStar(f2Players, f2Fcr);

  // High risk / smurf count
  const f1HighRisk = f1Players.filter((p) => {
    const lvl = riskAnalysis[p.playerId]?.level;
    return lvl === 'HIGH' || lvl === 'CRITICAL';
  }).length;
  const f2HighRisk = f2Players.filter((p) => {
    const lvl = riskAnalysis[p.playerId]?.level;
    return lvl === 'HIGH' || lvl === 'CRITICAL';
  }).length;

  return {
    winChanceF1,
    winChanceF2,
    predictedScore: {
      f1Score,
      f2Score,
      isOvertimeLikely,
    },
    keyAdvantageText,
    factors: {
      eloDelta: Math.round(f1AvgElo - f2AvgElo),
      mapAdvantage: mapAdvantageData,
      momentumAdvantage: {
        leader: f1NetForm > f2NetForm ? 'faction1' : f2NetForm > f1NetForm ? 'faction2' : 'balanced',
        f1HotCount,
        f2HotCount,
        f1ColdCount,
        f2ColdCount,
      },
      premadeAdvantage: {
        leader: f1MaxParty > f2MaxParty ? 'faction1' : f2MaxParty > f1MaxParty ? 'faction2' : 'balanced',
        f1MaxPartySize: f1MaxParty,
        f2MaxPartySize: f2MaxParty,
      },
      smurfRiskDelta: {
        f1HighRiskCount: f1HighRisk,
        f2HighRiskCount: f2HighRisk,
      },
    },
    starMatchup: f1Star && f2Star ? { f1Star, f2Star } : undefined,
  };
}
