import { FaceitPlayerFullStats } from '../types/faceit';

export type PlayerRole = 'AWP' | 'Entry' | 'Support' | 'Rifler' | 'IGL' | 'Lurker';

/**
 * Heuristic role detection based on FACEIT stats.
 * Not a ML model — simple thresholds tuned on CS2 pub data.
 * Uses overall + last30 aggregates; when last30 is missing falls back to overall.
 */
export function detectPlayerRole(stats: FaceitPlayerFullStats): PlayerRole {
  const kd = stats.last30Kd ?? stats.overallKd ?? 1.0;
  const adr = stats.last30Adr ?? stats.overallAdr ?? 75;
  const hs = stats.last30HsPercent ?? stats.overallHsPercent ?? 40;
  const winRate = stats.overallWinRate ?? 50;
  const hsLow = hs < 38;
  const hsHigh = hs > 55;

  // AWP: low HS% + high KD + decent ADR (AWP HS% naturally low, but impact high)
  if (hsLow && kd >= 1.15 && adr >= 72) return 'AWP';
  // Entry: high ADR + high KD + high HS% (aggressive rifler peeks, trades)
  if (adr >= 85 && kd >= 1.12 && hsHigh) return 'Entry';
  // Support: low ADR + lower KD, often high winrate via utility
  if (adr < 70 && kd < 1.05) return 'Support';
  // Lurker: decent KD but low HS% and moderate ADR, high winrate on solo plays
  if (kd >= 1.1 && hs < 42 && winRate >= 52) return 'Lurker';
  // IGL: low KD but high winrate + many matches (experience) — fallback rifler if not enough matches
  if (kd < 1.0 && winRate >= 54 && (stats.totalMatches ?? 0) > 500) return 'IGL';
  return 'Rifler';
}

export const ROLE_LABEL: Record<PlayerRole, string> = {
  AWP: 'AWP',
  Entry: 'Entry',
  Support: 'Support',
  Rifler: 'Rifler',
  IGL: 'IGL',
  Lurker: 'Lurker',
};

export const ROLE_COLOR: Record<PlayerRole, string> = {
  AWP: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  Entry: 'bg-red-500/15 text-red-300 border-red-500/30',
  Support: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Rifler: 'bg-zinc-700 text-zinc-300 border-zinc-600',
  IGL: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  Lurker: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};
