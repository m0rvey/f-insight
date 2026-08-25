import { RiskAnalysisResult, RiskLevel } from '../types/risk';

/**
 * Single source of truth for smurf-risk visual styling.
 *
 * Used by PlayerBadge (level-based), PlayerDetailFlyout (score-based) and
 * PlayerRiskTab so the risk color scale never drifts between components.
 */
export const RISK_LEVEL_BADGE_STYLES: Record<RiskLevel, string> = {
  CRITICAL: 'bg-red-500/25 text-red-300 border-red-500/50 shadow-sm animate-pulse',
  HIGH: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  MEDIUM: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  LOW: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

/** Score thresholds mirror riskScorer.ts level boundaries. */
const SCORE_THRESHOLDS: Array<{ min: number; style: string }> = [
  { min: 70, style: RISK_LEVEL_BADGE_STYLES.CRITICAL },
  { min: 45, style: RISK_LEVEL_BADGE_STYLES.HIGH },
  { min: 25, style: RISK_LEVEL_BADGE_STYLES.MEDIUM },
  { min: 0, style: RISK_LEVEL_BADGE_STYLES.LOW },
];

/** Badge classes for a numeric risk score (0–100). Falls back to LOW styling. */
export function riskBadgeStyleForScore(score: number | undefined): string {
  if (score === undefined || !Number.isFinite(score)) {
    return RISK_LEVEL_BADGE_STYLES.LOW;
  }
  return SCORE_THRESHOLDS.find((t) => score >= t.min)!.style;
}

/** Badge classes for an analysis result object (or undefined → muted placeholder). */
export function riskBadgeStyleFor(result?: RiskAnalysisResult): string {
  return result ? RISK_LEVEL_BADGE_STYLES[result.level] ?? RISK_LEVEL_BADGE_STYLES.LOW : '';
}
