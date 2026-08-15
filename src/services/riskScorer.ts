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

  // 5. Steam Profile Analysis
  let isPrivateSteam = true;

  if (steam && !steam.isPrivate && steam.summary) {
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
  } else {
    isPrivateSteam = true;
    if (totalMatches < 100 && elo >= 1600) {
      const weight = 15;
      score += weight;
      flags.push({
        id: 'private_steam_fresh_high_elo',
        title: 'Hidden Account with High Elo',
        description: `Private Steam profile on fresh account with ${elo} Elo`,
        weight,
        severity: 'warning',
        category: 'PRIVATE_PROFILE',
      });
    } else {
      flags.push({
        id: 'private_steam',
        title: 'Hidden Account (Private Steam)',
        description: 'Steam hours and profile details are hidden by user privacy settings',
        weight: 0,
        severity: 'info',
        category: 'PRIVATE_PROFILE',
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
