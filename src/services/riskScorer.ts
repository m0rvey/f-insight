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

  // 1. Matches vs Elo check (Smurf detection core)
  if (elo >= 2000 && totalMatches < 150) {
    const weight = 35;
    score += weight;
    flags.push({
      id: 'lvl10_low_matches',
      title: 'High Elo with Very Few Matches',
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
  } else if (totalMatches < 30) {
    const weight = 15;
    score += weight;
    flags.push({
      id: 'fresh_faceit_account',
      title: 'Brand New FACEIT Account',
      description: `Only ${totalMatches} total matches on record`,
      weight,
      severity: 'info',
      category: 'MATCHES_ELO',
    });
  }

  // 2. K/D Anomaly
  if (kd >= 1.8) {
    const weight = 25;
    score += weight;
    flags.push({
      id: 'extreme_kd',
      title: 'Exceptional K/D Ratio',
      description: `Overall K/D of ${kd.toFixed(2)} is significantly above normal distribution`,
      weight,
      severity: 'danger',
      category: 'KD_ANOMALY',
    });
  } else if (kd >= 1.45) {
    const weight = 12;
    score += weight;
    flags.push({
      id: 'high_kd',
      title: 'High K/D Ratio',
      description: `Overall K/D of ${kd.toFixed(2)}`,
      weight,
      severity: 'warning',
      category: 'KD_ANOMALY',
    });
  }

  // 3. Win Rate Anomaly
  if (winRate >= 70 && totalMatches >= 15) {
    const weight = 20;
    score += weight;
    flags.push({
      id: 'extreme_winrate',
      title: 'Extreme Win Rate',
      description: `Lifetime win rate of ${winRate.toFixed(0)}% across ${totalMatches} matches`,
      weight,
      severity: 'danger',
      category: 'WINRATE_ANOMALY',
    });
  } else if (winRate >= 62 && totalMatches >= 20) {
    const weight = 10;
    score += weight;
    flags.push({
      id: 'high_winrate',
      title: 'Elevated Win Rate',
      description: `Lifetime win rate of ${winRate.toFixed(0)}%`,
      weight,
      severity: 'warning',
      category: 'WINRATE_ANOMALY',
    });
  }

  // 4. Steam Data (if available)
  let isPrivateSteam = true;

  if (steam && !steam.isPrivate && steam.summary) {
    isPrivateSteam = false;

    // Steam CS2 Hours vs Elo
    const hours = steam.playtime?.cs2HoursTotal ?? 0;
    if (hours > 0 && hours < 200 && elo >= 1600) {
      const weight = 30;
      score += weight;
      flags.push({
        id: 'low_steam_hours',
        title: 'Very Low CS2 Hours for Elo',
        description: `Only ${hours} hours in CS2 with ${elo} Elo`,
        weight,
        severity: 'danger',
        category: 'STEAM_HOURS',
      });
    } else if (hours > 0 && hours < 400 && elo >= 2000) {
      const weight = 20;
      score += weight;
      flags.push({
        id: 'moderate_hours_high_elo',
        title: 'Low Hours for Level 10',
        description: `${hours} hours on Level 10 account`,
        weight,
        severity: 'warning',
        category: 'STEAM_HOURS',
      });
    }

    // Steam Account Age
    const ageYears = steam.summary.accountAgeYears;
    if (ageYears !== undefined && ageYears < 1 && elo >= 1400) {
      const weight = 20;
      score += weight;
      flags.push({
        id: 'fresh_steam_account',
        title: 'Fresh Steam Account',
        description: `Steam profile created less than 1 year ago (${ageYears.toFixed(1)} yrs)`,
        weight,
        severity: 'warning',
        category: 'STEAM_AGE',
      });
    }

    // Steam Ban History
    if (steam.bans?.numberOfVACBans || steam.bans?.numberOfGameBans) {
      const totalBans = (steam.bans.numberOfVACBans || 0) + (steam.bans.numberOfGameBans || 0);
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
    // Steam is private
    isPrivateSteam = true;
    flags.push({
      id: 'private_steam',
      title: 'Private Steam Profile',
      description: 'Steam hours and profile details are hidden by user privacy settings',
      weight: 0,
      severity: 'info',
      category: 'PRIVATE_PROFILE',
    });
  }

  // Cap score at 100
  const normalizedScore = Math.min(Math.max(score, 0), 100);

  let level: RiskLevel = 'LOW';
  let color = '#10B981'; // Green
  let badgeText = 'Legit';

  if (normalizedScore >= 75) {
    level = 'CRITICAL';
    color = '#DC2626'; // Deep Red
    badgeText = 'High Risk';
  } else if (normalizedScore >= 50) {
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
    summary: `${normalizedScore}% Risk (${level})`,
    color,
    badgeText,
  };
}
