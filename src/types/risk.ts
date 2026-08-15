export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RiskSeverity = 'info' | 'warning' | 'danger';

export interface RiskFlag {
  id: string;
  title: string;
  description: string;
  weight: number; // Impact on score (0 - 40)
  severity: RiskSeverity;
  category: 'MATCHES_ELO' | 'KD_ANOMALY' | 'ADR_ANOMALY' | 'HS_ANOMALY' | 'WINRATE_ANOMALY' | 'STEAM_HOURS' | 'STEAM_AGE' | 'BAN_HISTORY' | 'PRIVATE_PROFILE' | 'ACCOUNT_AGE';
}

export interface RiskAnalysisResult {
  score: number; // 0 to 100
  level: RiskLevel;
  flags: RiskFlag[];
  isPrivateSteam: boolean;
  summary: string;
  color: string;
  badgeText: string;
}
