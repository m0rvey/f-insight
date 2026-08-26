import {
  FaceitPlayerFullStats,
  PlayerRecentMatch,
  PlayerFormStatus,
} from '../types/faceit';
import { AdvancedMatchPrediction } from '../types/messages';
import { PremadeGroup } from '../types/settings';
import { RiskAnalysisResult } from '../types/risk';
import { MAP_POOL_CONFIG } from '../constants/config';

/**
 * Calculates FCR (Firepower Contribution Rating) for players on a team.
 * Shares are normalized so the rounded values always total exactly 100%
 * (20% is baseline, >25% indicates a primary carry).
 */
export function calculateTeamFcr(
  teamPlayers: FaceitPlayerFullStats[]
): Record<string, number> {
  const result: Record<string, number> = {};
  if (!teamPlayers || teamPlayers.length === 0) return result;

  const powers = teamPlayers.map((p) => {
    const rawElo = Number.isFinite(p.elo) ? p.elo : 1000;
    const eloWeight = Math.max(500, rawElo || 1000) / 1000;
    const rawKd = Number.isFinite(p.last30Kd) ? p.last30Kd : (Number.isFinite(p.overallKd) ? p.overallKd : 1.0);
    // Cap the K/D weight both ways: 60/0-style outliers must not swallow the
    // whole share, and sub-0.4 baselines stay meaningful.
    const kdWeight = Math.min(2.5, Math.max(0.4, rawKd ?? 1.0));
    const rawAdr = Number.isFinite(p.last30Adr) ? p.last30Adr : (Number.isFinite(p.overallAdr) ? p.overallAdr : 75);
    const adrWeight = 1 + ((rawAdr ?? 75) - 75) / 150;
    const power = eloWeight * kdWeight * Math.max(0.6, adrWeight);
    return { id: p.playerId, power: Number.isFinite(power) && power > 0 ? power : 1.0 };
  });

  const totalPower = powers.reduce((sum, item) => sum + item.power, 0);
  const safeTotalPower = Number.isFinite(totalPower) && totalPower > 0 ? totalPower : 0;

  if (safeTotalPower <= 0) {
    const evenShare = parseFloat((100 / teamPlayers.length).toFixed(1));
    for (const item of powers) {
      result[item.id] = evenShare;
    }
    return result;
  }

  // Assign rounded shares, then give the residual to the largest contributor
  // so the displayed values always add up to exactly 100%.
  let assigned = 0;
  let biggestId = '';
  let biggestValue = -1;
  for (const item of powers) {
    const percent = parseFloat((item.power / safeTotalPower * 100).toFixed(1));
    result[item.id] = percent;
    assigned += percent;
    if (percent > biggestValue) {
      biggestValue = percent;
      biggestId = item.id;
    }
  }
  const residual = parseFloat((100 - assigned).toFixed(1));
  if (residual !== 0 && biggestId) {
    result[biggestId] = parseFloat((result[biggestId] + residual).toFixed(1));
  }

  return result;
}

/**
 * Evaluates a player's recent form and momentum by comparing their last 5 matches against their lifetime baseline.
 */
export function evaluatePlayerForm(
  recentMatches: PlayerRecentMatch[],
  overallKd?: number,
  overallAdr?: number
): { formStatus: PlayerFormStatus; recentKd: number; recentAdr: number } {
  const baselineKd = Number.isFinite(overallKd) ? Math.max(0.5, overallKd!) : 1.0;
  const baselineAdr = Number.isFinite(overallAdr) ? Math.max(20, overallAdr!) : 75;

  if (!recentMatches || recentMatches.length < 2) {
    return {
      formStatus: 'STABLE',
      recentKd: baselineKd,
      recentAdr: baselineAdr,
    };
  }

  const last5 = recentMatches.slice(0, 5);
  const validMatches = last5.filter(
    (m) => typeof m.kills === 'number' && Number.isFinite(m.kills) && typeof m.deaths === 'number' && Number.isFinite(m.deaths)
  );

  let recentKd = baselineKd;
  if (validMatches.length > 0) {
    const totalKills = validMatches.reduce((sum, m) => sum + (m.kills || 0), 0);
    const totalDeaths = validMatches.reduce((sum, m) => sum + (m.deaths || 0), 0);
    recentKd = totalDeaths > 0
      ? parseFloat((totalKills / totalDeaths).toFixed(2))
      // A flawless 60/0 sample must not collapse back to the baseline — that
      // would hide exactly the outlier performance worth flagging. Cap by a
      // conservative "min deaths per match" denominator instead.
      : parseFloat(Math.max(baselineKd, totalKills / (validMatches.length * 2)).toFixed(2));
  }

  const validAdrs = last5.map((m) => m.adr).filter((a): a is number => typeof a === 'number' && Number.isFinite(a) && a > 0);
  const recentAdr = validAdrs.length > 0
    ? Math.round(validAdrs.reduce((sum, a) => sum + a, 0) / validAdrs.length)
    : baselineAdr;

  const ratio = recentKd / baselineKd;

  let formStatus: PlayerFormStatus = 'STABLE';
  // Symmetric ±15% thresholds around the personal baseline
  // (1/1.15 ≈ 0.87 is the exact mirror of +15%).
  if (ratio >= 1.15) {
    formStatus = 'HOT';
  } else if (ratio <= 1 / 1.15) {
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
    f1Players,
    f2Players,
    selectedMap,
    premadeGroups,
    riskAnalysis,
    f1Fcr,
    f2Fcr,
  } = params;

  // Defensive input sanitization: never allow NaN/Infinity Elo into the logistic curve
  const safeF1AvgElo = Number.isFinite(params.f1AvgElo)
    ? Math.max(100, Math.min(6000, params.f1AvgElo))
    : 1000;
  const safeF2AvgElo = Number.isFinite(params.f2AvgElo)
    ? Math.max(100, Math.min(6000, params.f2AvgElo))
    : 1000;
  const f1AvgElo = safeF1AvgElo;
  const f2AvgElo = safeF2AvgElo;

  // 1. Base Elo Probability (Logistic curve)
  const eloDiff = f2AvgElo - f1AvgElo;
  const baseWinProbF1 = 1 / (1 + Math.pow(10, eloDiff / 400));

  // 2. Map Advantage Factor
  let mapDelta = 0;
  let mapAdvantageData: AdvancedMatchPrediction['factors']['mapAdvantage'] = undefined;
  const cleanMap = (selectedMap || '').replace(/^(cs2_|csgo_|de_)/, '').toLowerCase();

  if (cleanMap) {
    const f1MapWins = f1Players.reduce((acc, p) => acc + (p.mapStats?.[cleanMap]?.wins || 0), 0);
    const f1MapMatches = f1Players.reduce((acc, p) => acc + (p.mapStats?.[cleanMap]?.matches || 0), 0);

    const f2MapWins = f2Players.reduce((acc, p) => acc + (p.mapStats?.[cleanMap]?.wins || 0), 0);
    const f2MapMatches = f2Players.reduce((acc, p) => acc + (p.mapStats?.[cleanMap]?.matches || 0), 0);

    // Bayesian sample-weighted win rates (shrink toward 50%) — the same
    // estimator the veto module uses, so both views can't disagree because
    // one player's lucky 3-0 sample skews the prediction.
    const f1Wr = Math.round(((f1MapWins + 2.5) / (f1MapMatches + 5)) * 100);
    const f2Wr = Math.round(((f2MapWins + 2.5) / (f2MapMatches + 5)) * 100);

    const deltaWr = f1Wr - f2Wr;
    // Require a minimal combined sample before shifting the odds at all.
    if (f1MapMatches + f2MapMatches >= 10) {
      // Map shift: up to ±12%
      mapDelta = Math.max(-0.12, Math.min(0.12, (deltaWr / 100) * 0.25));
    }

    mapAdvantageData = {
      leader: deltaWr >= 5 ? 'faction1' : deltaWr <= -5 ? 'faction2' : 'balanced',
      mapName: cleanMap,
      f1WinRate: f1Wr,
      f2WinRate: f2Wr,
      deltaWinRate: Math.abs(deltaWr),
    };
  }

  // 2b. ADR Advantage Factor (team firepower beyond Elo)
  let adrDelta = 0;
  let adrAdvantageData: AdvancedMatchPrediction['factors']['adrAdvantage'] = undefined;
  const f1Adrs = f1Players
    .map((p) => p.last30Adr ?? p.overallAdr)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 5 && v <= 200);
  const f2Adrs = f2Players
    .map((p) => p.last30Adr ?? p.overallAdr)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 5 && v <= 200);
  if (f1Adrs.length >= 3 && f2Adrs.length >= 3) {
    const f1AvgAdr = Math.round(f1Adrs.reduce((a, b) => a + b, 0) / f1Adrs.length);
    const f2AvgAdr = Math.round(f2Adrs.reduce((a, b) => a + b, 0) / f2Adrs.length);
    const diff = f1AvgAdr - f2AvgAdr;
    adrDelta = Math.max(-0.08, Math.min(0.08, diff / 130));
    adrAdvantageData = {
      leader: diff >= 5 ? 'faction1' : diff <= -5 ? 'faction2' : 'balanced',
      f1AvgAdr,
      f2AvgAdr,
      delta: diff,
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

  // High risk / smurf count
  const f1HighRisk = f1Players.filter((p) => {
    const lvl = riskAnalysis[p.playerId]?.level;
    return lvl === 'HIGH' || lvl === 'CRITICAL';
  }).length;
  const f2HighRisk = f2Players.filter((p) => {
    const lvl = riskAnalysis[p.playerId]?.level;
    return lvl === 'HIGH' || lvl === 'CRITICAL';
  }).length;

  // 5. Final Adjusted Win Chances
  const riskDelta = Math.max(-0.06, Math.min(0.06, (f1HighRisk - f2HighRisk) * 0.02));
  const rawWinF1 = baseWinProbF1 + mapDelta + adrDelta + momentumDelta + premadeDelta + riskDelta;
  const clampedWinF1 = Math.max(0.06, Math.min(0.94, rawWinF1));
  const winChanceF1 = Math.round(clampedWinF1 * 100);
  const winChanceF2 = 100 - winChanceF1;

  // 6. MR12 Predicted Score Line
  // In CS2 MR12 overtime is triggered at 12:12, so "OT likely" means the
  // matchup is close enough that a regulation 13:X finish is a coin flip —
  // not a specific final scoreline (OT finals look like 16:13/16:14).
  let f1Score = 13;
  let f2Score = 9;
  const diffProb = Math.abs(winChanceF1 - 50);
  const isOvertimeLikely = diffProb <= 8;

  if (diffProb <= 8) {
    f1Score = winChanceF1 >= 50 ? 13 : 11;
    f2Score = winChanceF1 >= 50 ? 11 : 13;
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

  if (adrAdvantageData && Math.abs(adrAdvantageData.delta) >= 8) {
    narratives.push(
      adrAdvantageData.leader === 'faction1'
        ? `Team 1 ADR edge +${adrAdvantageData.delta} (firepower)`
        : `Team 2 ADR edge +${Math.abs(adrAdvantageData.delta)} (firepower)`
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

  if (Math.abs(riskDelta) >= 0.04 && f1HighRisk + f2HighRisk > 0) {
    if (f1HighRisk > f2HighRisk) {
      narratives.push(`Team 1 likely carries flagged accounts (${f1HighRisk} risk flagged)`);
    } else if (f2HighRisk > f1HighRisk) {
      narratives.push(`Team 2 likely carries flagged accounts (${f2HighRisk} risk flagged)`);
    }
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
      const score = fcr * 1.5 + (p.last30Kd ?? p.overallKd ?? 1.0) * 10;
      if (score > topScore) {
        topScore = score;
        topPlayer = p;
      }
    }
    return topPlayer
      ? {
          nickname: topPlayer.nickname,
          fcr: fcrMap[topPlayer.playerId] || 20,
          kd: topPlayer.last30Kd ?? topPlayer.overallKd ?? 1.0,
          elo: topPlayer.elo || 1000,
        }
      : undefined;
  };

  const f1Star = findStar(f1Players, f1Fcr);
  const f2Star = findStar(f2Players, f2Fcr);

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
        impactPercent: Math.round(riskDelta * 100),
      },
      adrAdvantage: adrAdvantageData,
    },
    starMatchup: f1Star && f2Star ? { f1Star, f2Star } : undefined,
  };
}

export interface MapVetoRankItem {
  mapName: string;
  rank: number; // 1 to N (map pool size)
  recommendation: 'MUST_PICK' | 'SAFE_PICK' | 'BALANCED' | 'RISK_BAN' | 'PERMABAN';
  badgeColor: string;
  f1Matches: number;
  f1WinRate: number;
  f1AvgKd: number;
  f1AvgAdr: number;
  f1BayesWr: number;
  f2Matches: number;
  f2WinRate: number;
  f2AvgKd: number;
  f2AvgAdr: number;
  f2BayesWr: number;
  advantageDelta: number;
}

/**
 * Calculates 100% accurate Bayesian sample-weighted CS2 map veto rankings
 */
export function calculateMapVetoRanking(params: {
  f1Players: FaceitPlayerFullStats[];
  f2Players: FaceitPlayerFullStats[];
  availableMaps?: string[];
  userFaction?: 'faction1' | 'faction2';
}): MapVetoRankItem[] {
  // Single source of truth — must stay in sync with MAP_POOL_CONFIG (Active Duty 2026-01)
  const DEFAULT_CS2_MAPS = [...MAP_POOL_CONFIG.FALLBACK_MAPS] as string[];

  const mapPool = params.availableMaps && params.availableMaps.length > 0
    ? Array.from(new Set(params.availableMaps.map((m) => m.replace(/^cs2_/, '').replace(/^csgo_/, '').replace(/^de_/, '').toLowerCase().trim()).filter(Boolean)))
    : DEFAULT_CS2_MAPS;

  const getPlayerMapStat = (p: FaceitPlayerFullStats, name: string) => {
    if (!p.mapStats) return undefined;
    if (p.mapStats[name]) return p.mapStats[name];
    if (p.mapStats[`de_${name}`]) return p.mapStats[`de_${name}`];
    if (p.mapStats[`cs2_${name}`]) return p.mapStats[`cs2_${name}`];
    for (const [k, v] of Object.entries(p.mapStats)) {
      if (k.toLowerCase().replace(/^(cs2_|csgo_|de_)/, '') === name) {
        return v;
      }
    }
    return undefined;
  };

  const isF2Perspective = params.userFaction === 'faction2';

  const items: MapVetoRankItem[] = mapPool.map((mapName) => {
    // Faction 1
    const f1Stats = params.f1Players.map((p) => getPlayerMapStat(p, mapName)).filter((m): m is NonNullable<typeof m> => Boolean(m));
    const f1Matches = f1Stats.reduce((acc, m) => acc + (m.matches || 0), 0);
    const f1Wins = f1Stats.reduce((acc, m) => acc + (m.wins || 0), 0);
    const f1WinRate = f1Matches > 0 ? Math.round((f1Wins / f1Matches) * 100) : 50;
    const f1AvgKd = f1Stats.length > 0 ? parseFloat((f1Stats.reduce((acc, m) => acc + (m.kd || 1.0), 0) / f1Stats.length).toFixed(2)) : 1.0;
    const f1AvgAdr = f1Stats.length > 0 ? Math.round(f1Stats.reduce((acc, m) => acc + (m.avgAdr || 75), 0) / f1Stats.length) : 75;
    const f1BayesWr = parseFloat((((f1Wins + 2.5) / (f1Matches + 5)) * 100).toFixed(1));
    const f1Power = f1BayesWr * (1 + (f1AvgKd - 1.0) / 2) * (1 + (f1AvgAdr - 75) / 200);

    // Faction 2
    const f2Stats = params.f2Players.map((p) => getPlayerMapStat(p, mapName)).filter((m): m is NonNullable<typeof m> => Boolean(m));
    const f2Matches = f2Stats.reduce((acc, m) => acc + (m.matches || 0), 0);
    const f2Wins = f2Stats.reduce((acc, m) => acc + (m.wins || 0), 0);
    const f2WinRate = f2Matches > 0 ? Math.round((f2Wins / f2Matches) * 100) : 50;
    const f2AvgKd = f2Stats.length > 0 ? parseFloat((f2Stats.reduce((acc, m) => acc + (m.kd || 1.0), 0) / f2Stats.length).toFixed(2)) : 1.0;
    const f2AvgAdr = f2Stats.length > 0 ? Math.round(f2Stats.reduce((acc, m) => acc + (m.avgAdr || 75), 0) / f2Stats.length) : 75;
    const f2BayesWr = parseFloat((((f2Wins + 2.5) / (f2Matches + 5)) * 100).toFixed(1));
    const f2Power = f2BayesWr * (1 + (f2AvgKd - 1.0) / 2) * (1 + (f2AvgAdr - 75) / 200);

    const advantageDelta = isF2Perspective
      ? parseFloat((f2Power - f1Power).toFixed(1))
      : parseFloat((f1Power - f2Power).toFixed(1));

    return {
      mapName,
      rank: 0,
      recommendation: 'BALANCED',
      badgeColor: '',
      f1Matches,
      f1WinRate,
      f1AvgKd,
      f1AvgAdr,
      f1BayesWr,
      f2Matches,
      f2WinRate,
      f2AvgKd,
      f2AvgAdr,
      f2BayesWr,
      advantageDelta,
    };
  });

  // Sort maps by advantageDelta descending
  items.sort((a, b) => b.advantageDelta - a.advantageDelta);

  // Assign ranks 1..N and recommendations
  items.forEach((item, idx) => {
    item.rank = idx + 1;
    if (item.advantageDelta >= 15) {
      item.recommendation = 'MUST_PICK';
      item.badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    } else if (item.advantageDelta >= 5) {
      item.recommendation = 'SAFE_PICK';
      item.badgeColor = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    } else if (item.advantageDelta > -5) {
      item.recommendation = 'BALANCED';
      item.badgeColor = 'bg-zinc-800 text-zinc-300 border-zinc-700';
    } else if (item.advantageDelta > -15) {
      item.recommendation = 'RISK_BAN';
      item.badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    } else {
      item.recommendation = 'PERMABAN';
      item.badgeColor = 'bg-red-500/20 text-red-300 border-red-500/40';
    }
  });

  return items;
}
