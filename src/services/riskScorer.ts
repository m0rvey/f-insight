import { FaceitPlayerFullStats } from '../types/faceit';
import { SteamFullData } from '../types/steam';
import { RiskAnalysisResult, RiskFlag, RiskLevel } from '../types/risk';

export function calculateRiskScore(
  player: FaceitPlayerFullStats,
  steam?: SteamFullData
): RiskAnalysisResult {
  const flags: RiskFlag[] = [];
  let score = 0;

  const totalMatches = player.totalMatches || 0;
  const elo = player.elo || 1000;
  const kd = player.overallKd || 1.0;
  const winRate = player.overallWinRate || 50;
  const recentKd = player.recentKd || kd;
  const recentAdr = player.recentAdr || 75;

  // 1. Matches vs Elo check (Core Smurf Curve)
  if (elo >= 2200 && totalMatches < 100) {
    const weight = 45;
    score += weight;
    flags.push({
      id: 'lvl10_extreme_low_matches',
      title: 'High Elo on Very Fresh Account',
      description: `${elo} Elo achieved in only ${totalMatches} matches`,
      weight,
      severity: 'danger',
      category: 'MATCHES_ELO',
    });
  } else if (elo >= 2000 && totalMatches < 150) {
    const weight = 35;
    score += weight;
    flags.push({
      id: 'lvl10_low_matches',
      title: 'Level 10 with Low Matches',
      description: `Level 10 (${elo} Elo) in only ${totalMatches} matches`,
      weight,
      severity: 'danger',
      category: 'MATCHES_ELO',
    });
  } else if (elo >= 1600 && totalMatches < 80) {
    const weight = 25;
    score += weight;
    flags.push({
      id: 'high_elo_low_matches',
      title: 'High Level on Fresh Account',
      description: `${elo} Elo achieved in only ${totalMatches} matches`,
      weight,
      severity: 'warning',
      category: 'MATCHES_ELO',
    });
  } else if (elo >= 1350 && totalMatches < 40) {
    const weight = 18;
    score += weight;
    flags.push({
      id: 'mid_elo_fresh_account',
      title: 'Level 7+ on New Account',
      description: `${elo} Elo with only ${totalMatches} matches`,
      weight,
      severity: 'warning',
      category: 'MATCHES_ELO',
    });
  } else if (totalMatches < 20) {
    const weight = 10;
    score += weight;
    flags.push({
      id: 'fresh_faceit_account',
      title: 'New FACEIT Account',
      description: `Only ${totalMatches} total matches on record`,
      weight,
      severity: 'info',
      category: 'MATCHES_ELO',
    });
  } else if (totalMatches >= 800) {
    // Mature account bonus (dampener)
    score -= 15;
  }

  // 2. K/D Ratio Anomaly
  if (kd >= 2.0) {
    const weight = 30;
    score += weight;
    flags.push({
      id: 'extreme_kd',
      title: 'Exceptional K/D Ratio (2.0+)',
      description: `Lifetime K/D of ${kd.toFixed(2)} is drastically above normal distribution`,
      weight,
      severity: 'danger',
      category: 'KD_ANOMALY',
    });
  } else if (kd >= 1.6 && totalMatches < 200) {
    const weight = 20;
    score += weight;
    flags.push({
      id: 'high_kd_fresh',
      title: 'High K/D Ratio on Recent Account',
      description: `K/D of ${kd.toFixed(2)} with ${totalMatches} matches`,
      weight,
      severity: 'warning',
      category: 'KD_ANOMALY',
    });
  } else if (kd >= 1.4 && totalMatches < 150) {
    const weight = 12;
    score += weight;
    flags.push({
      id: 'elevated_kd',
      title: 'Elevated K/D Ratio',
      description: `Overall K/D of ${kd.toFixed(2)}`,
      weight,
      severity: 'warning',
      category: 'KD_ANOMALY',
    });
  } else if (kd < 0.95 && totalMatches >= 50) {
    // Normal / low KD dampener
    score -= 10;
  }

  // 2b. ADR Anomaly (reliable ADR only — no fabricated fallbacks)
  if (player.overallAdr !== undefined && player.overallAdr >= 95 && totalMatches < 300) {
    const weight = 22;
    score += weight;
    flags.push({
      id: 'extreme_adr',
      title: 'Exceptional Average Damage (95+)',
      description: `Lifetime ADR of ${player.overallAdr.toFixed(0)} is far above the typical range`,
      weight,
      severity: 'danger',
      category: 'ADR_ANOMALY',
    });
  }
  if (player.last30Adr !== undefined && player.last30Adr >= 100 && (player.last30AdrMatches ?? 0) >= 3) {
    const weight = 18;
    score += weight;
    flags.push({
      id: 'recent_extreme_adr',
      title: 'Recent ADR Anomaly (100+)',
      description: `ADR of ${player.last30Adr} across the last 30 matches`,
      weight,
      severity: 'warning',
      category: 'ADR_ANOMALY',
    });
  }
  if (recentAdr >= 95 && player.overallAdr !== undefined && recentAdr >= player.overallAdr * 1.2) {
    const weight = 12;
    score += weight;
    flags.push({
      id: 'recent_adr_spike',
      title: 'Recent ADR Spike',
      description: `Last 5 games ADR (${recentAdr}) is 20%+ above lifetime baseline (${player.overallAdr.toFixed(0)})`,
      weight,
      severity: 'warning',
      category: 'ADR_ANOMALY',
    });
  }

  // 2c. Headshot Rate Anomaly
  if ((player.last30HsPercent ?? 0) >= 60) {
    const weight = 10;
    score += weight;
    flags.push({
      id: 'extreme_hs_recent',
      title: 'Extreme Headshot Rate (60%+)',
      description: `Average ${player.last30HsPercent}% headshots over the last 30 matches`,
      weight,
      severity: 'warning',
      category: 'HS_ANOMALY',
    });
  } else if (player.overallHsPercent >= 60 && kd >= 1.5) {
    const weight = 8;
    score += weight;
    flags.push({
      id: 'extreme_hs',
      title: 'High Headshot Rate (60%+)',
      description: `Lifetime headshot rate of ${player.overallHsPercent.toFixed(0)}% with K/D ${kd.toFixed(2)}`,
      weight,
      severity: 'info',
      category: 'HS_ANOMALY',
    });
  }

  // 3. Win Rate Anomaly
  if (winRate >= 80 && totalMatches >= 10) {
    const weight = 30;
    score += weight;
    flags.push({
      id: 'extreme_winrate',
      title: 'Extreme Win Rate (80%+)',
      description: `Lifetime win rate of ${winRate.toFixed(0)}% across ${totalMatches} matches`,
      weight,
      severity: 'danger',
      category: 'WINRATE_ANOMALY',
    });
  } else if (winRate >= 70 && totalMatches >= 15) {
    const weight = 20;
    score += weight;
    flags.push({
      id: 'high_winrate',
      title: 'Very High Win Rate (70%+)',
      description: `Lifetime win rate of ${winRate.toFixed(0)}%`,
      weight,
      severity: 'warning',
      category: 'WINRATE_ANOMALY',
    });
  } else if (winRate >= 62 && totalMatches >= 25) {
    const weight = 10;
    score += weight;
    flags.push({
      id: 'elevated_winrate',
      title: 'Elevated Win Rate',
      description: `Lifetime win rate of ${winRate.toFixed(0)}%`,
      weight,
      severity: 'info',
      category: 'WINRATE_ANOMALY',
    });
  }

  // 3b. Recent (30 matches) Win Rate Anomaly
  if (player.last30WinRate !== undefined && (player.last30Matches ?? 0) >= 5) {
    if (player.last30WinRate >= 85 && totalMatches < 300) {
      const weight = 15;
      score += weight;
      flags.push({
        id: 'recent_dominance',
        title: 'Recent Dominance (85%+)',
        description: `Won ${player.last30WinRate}% of the last ${player.last30Matches} matches`,
        weight,
        severity: 'warning',
        category: 'WINRATE_ANOMALY',
      });
    } else if (player.last30WinRate >= 75 && elo >= 1500) {
      const weight = 8;
      score += weight;
      flags.push({
        id: 'elevated_recent_winrate',
        title: 'High Recent Win Rate (75%+)',
        description: `Won ${player.last30WinRate}% of the last ${player.last30Matches} matches`,
        weight,
        severity: 'info',
        category: 'WINRATE_ANOMALY',
      });
    }
  }

  // 4. Recent Carry / Booster Spike
  if (recentKd >= 1.75 && recentKd >= kd * 1.35 && totalMatches >= 10) {
    const weight = 15;
    score += weight;
    flags.push({
      id: 'recent_kd_spike',
      title: 'Recent Performance Hard Spike',
      description: `Recent 5 games K/D (${recentKd.toFixed(2)}) is significantly higher than lifetime baseline (${kd.toFixed(2)})`,
      weight,
      severity: 'warning',
      category: 'KD_ANOMALY',
    });
  }

  // 4b. Mid-Term (30 matches) K/D Spike — less noisy than the 5-game sample
  if (player.last30Kd !== undefined && player.last30Kd >= 1.5 && player.last30Kd >= kd * 1.3 && totalMatches >= 30) {
    const weight = 10;
    score += weight;
    flags.push({
      id: 'midterm_kd_spike',
      title: 'Mid-Term K/D Spike',
      description: `Last 30 games K/D (${player.last30Kd.toFixed(2)}) well above lifetime baseline (${kd.toFixed(2)})`,
      weight,
      severity: 'warning',
      category: 'KD_ANOMALY',
    });
  }

  // 5. Steam Profile Analysis
  let isPrivateSteam = true;

  if (steam?.fetchError) {
    // Steam data unavailable (network/rate-limit) — skip steam-based analysis
    isPrivateSteam = false;
  } else if (steam && !steam.isPrivate && steam.summary) {
    isPrivateSteam = false;

    // Steam CS2 Hours vs Elo
    const hours = steam.playtime?.cs2HoursTotal ?? 0;
    if (hours > 0 && hours < 150 && elo >= 1600) {
      const weight = 30;
      score += weight;
      flags.push({
        id: 'low_steam_hours',
        title: 'Very Low CS2 Hours for Elo Rating',
        description: `Only ${hours}h in CS2 with ${elo} Elo`,
        weight,
        severity: 'danger',
        category: 'STEAM_HOURS',
      });
    } else if (hours > 0 && hours < 350 && elo >= 2000) {
      const weight = 20;
      score += weight;
      flags.push({
        id: 'moderate_hours_high_elo',
        title: 'Low Hours for Level 10',
        description: `${hours}h total on Level 10 account`,
        weight,
        severity: 'warning',
        category: 'STEAM_HOURS',
      });
    } else if (hours >= 2500) {
      // Veteran player hours dampener
      score -= 15;
    }

    // Steam Account Age
    const ageYears = steam.summary.accountAgeYears;
    if (ageYears !== undefined && ageYears < 1.0 && elo >= 1400) {
      const weight = 18;
      score += weight;
      flags.push({
        id: 'fresh_steam_account',
        title: 'Fresh Steam Account (<1 Year)',
        description: `Steam account created only ${ageYears.toFixed(1)} years ago`,
        weight,
        severity: 'warning',
        category: 'STEAM_AGE',
      });
    }

    // Steam Ban History
    if (steam.bans?.vacBanned || steam.bans?.numberOfGameBans) {
      const totalBans = (steam.bans.vacBanned ? 1 : 0) + (steam.bans.numberOfGameBans || 0);
      const weight = 25;
      score += weight;
      flags.push({
        id: 'steam_ban_history',
        title: 'Past Ban on Record',
        description: `Account has ${totalBans} ban(s) on record (${steam.bans.daysSinceLastBan || 0} days ago)`,
        weight,
        severity: 'danger',
        category: 'BAN_HISTORY',
      });
    }
  } else if (steam?.isPrivate) {
    isPrivateSteam = true;
    flags.push({
      id: 'private_steam',
      title: 'Hidden Account (Private Steam)',
      description: 'Steam hours and profile details are hidden by user privacy settings',
      weight: 0,
      severity: 'info',
      category: 'PRIVATE_PROFILE',
    });

    // Hidden profiles hide the strongest smurf signals (hours, age, bans) — scale suspicion with Elo
    const hiddenWeight = elo >= 2200 ? 25 : elo >= 2000 ? 22 : elo >= 1600 ? 15 : elo >= 1350 ? 10 : 6;
    if (hiddenWeight >= 15) {
      score += hiddenWeight;
      flags.push({
        id: 'hidden_high_elo',
        title: 'Hidden Account with High Elo',
        description: `Private Steam profile with ${elo} Elo`,
        weight: hiddenWeight,
        severity: hiddenWeight >= 22 ? 'danger' : 'warning',
        category: 'PRIVATE_PROFILE',
      });
    }
    if (totalMatches < 100) {
      const weight = 10;
      score += weight;
      flags.push({
        id: 'private_steam_fresh_account',
        title: 'Hidden Account on Fresh FACEIT Account',
        description: `Private Steam profile with only ${totalMatches} matches on record`,
        weight,
        severity: 'warning',
        category: 'PRIVATE_PROFILE',
      });
    }
    const strongKd = player.last30Kd ?? recentKd;
    if (strongKd >= 1.6) {
      const weight = 8;
      score += weight;
      flags.push({
        id: 'hidden_strong_performance',
        title: 'Hidden Profile with Strong Recent Performance',
        description: `Hidden Steam profile with recent K/D of ${strongKd.toFixed(2)}`,
        weight,
        severity: 'warning',
        category: 'PRIVATE_PROFILE',
      });
    }
  } else {
    // steam === undefined — no Steam ID available, treat as unknown (no privacy assumption)
    isPrivateSteam = false;
  }

  // 6. FACEIT Account Age (independent of Steam privacy)
  const regDate = player.registrationDate ? new Date(player.registrationDate) : null;
  if (regDate && !isNaN(regDate.getTime())) {
    const faceitAgeYears = (Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (faceitAgeYears < 0.5 && elo >= 1350) {
      const weight = 22;
      score += weight;
      flags.push({
        id: 'fresh_faceit_high_elo',
        title: 'Fresh FACEIT Account (<6 Months)',
        description: `FACEIT account created ${faceitAgeYears.toFixed(1)} years ago with ${elo} Elo`,
        weight,
        severity: 'danger',
        category: 'ACCOUNT_AGE',
      });
    } else if (faceitAgeYears < 1.0 && elo >= 1600) {
      const weight = 18;
      score += weight;
      flags.push({
        id: 'young_faceit_high_elo',
        title: 'Young FACEIT Account (<1 Year)',
        description: `FACEIT account created ${faceitAgeYears.toFixed(1)} years ago with ${elo} Elo`,
        weight,
        severity: 'warning',
        category: 'ACCOUNT_AGE',
      });
    }
  }

  // Normalize score between 0 and 100
  const normalizedScore = Math.min(100, Math.max(0, Math.round(score)));

  let level: RiskLevel = 'LOW';
  let color = '#10B981'; // Green
  let badgeText = 'Legit';

  if (normalizedScore >= 70) {
    level = 'CRITICAL';
    color = '#DC2626'; // Deep Red
    badgeText = 'High Risk';
  } else if (normalizedScore >= 45) {
    level = 'HIGH';
    color = '#EF4444'; // Red
    badgeText = 'Likely Smurf';
  } else if (normalizedScore >= 25) {
    level = 'MEDIUM';
    color = '#F59E0B'; // Yellow/Amber
    badgeText = 'Suspicious';
  }

  return {
    score: normalizedScore,
    level,
    flags,
    isPrivateSteam,
    summary: `${normalizedScore}% Smurf Risk (${level})`,
    color,
    badgeText,
  };
}
