import React from 'react';
import { FaceitPlayerFullStats } from '../types/faceit';
import { SteamFullData } from '../types/steam';
import { RiskAnalysisResult } from '../types/risk';
import { PremadeGroup } from '../types/settings';
import {
  Flame,
  Snowflake,
  ShieldAlert,
  Zap,
  ExternalLink,
} from 'lucide-react';

interface PlayerBadgeProps {
  playerId: string;
  stats?: FaceitPlayerFullStats;
  steam?: SteamFullData;
  risk?: RiskAnalysisResult;
  premadeGroup?: PremadeGroup;
  isCurrentUser?: boolean;
  showFcr?: boolean;
  showForm?: boolean;
  compact?: boolean;
  onOpenDetails: (playerId: string) => void;
}

const RISK_BADGE_STYLES: Record<string, string> = {
  CRITICAL: 'bg-red-500/25 text-red-300 border-red-500/50 shadow-sm animate-pulse',
  HIGH: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  MEDIUM: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  LOW: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

export const PlayerBadge = React.memo<PlayerBadgeProps>(({
  playerId,
  stats,
  steam,
  risk,
  premadeGroup,
  isCurrentUser,
  showFcr = true,
  showForm = true,
  compact = false,
  onOpenDetails,
}) => {
  if (!stats) {
    return (
      <div className="w-full mt-2 p-2 rounded-xl bg-faceit-dark/80 border border-white/5 text-center text-[10px] text-zinc-500 font-mono">
        <span>Stats unavailable — Alt+R to retry</span>
      </div>
    );
  }

  // Stats over the last 30 matches, falling back to lifetime when unavailable
  const displayKd = stats.last30Kd ?? stats.overallKd;
  const displayHs = stats.last30HsPercent ?? (stats.overallHsPercent > 0 ? stats.overallHsPercent : undefined);
  const displayAdr = stats.last30Adr ?? stats.overallAdr;
  const displayWinRate = stats.last30WinRate ?? (stats.overallWinRate > 0 ? stats.overallWinRate : undefined);
  const statsWindow = stats.last30Matches !== undefined ? `last ${stats.last30Matches} matches` : 'lifetime stats';

  const riskBadgeStyle = risk ? (RISK_BADGE_STYLES[risk.level] || RISK_BADGE_STYLES.LOW) : null;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onOpenDetails(playerId);
      }}
      className={`w-full mt-2 rounded-xl border text-white font-sans transition-all duration-150 cursor-pointer shadow-md group active:scale-[0.99] select-none ${
        compact ? 'p-1.5' : 'p-2'
      } ${
        isCurrentUser
          ? 'bg-cyan-950/25 hover:bg-cyan-950/40 border-cyan-500/40 hover:border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
          : 'bg-faceit-card/95 hover:bg-faceit-card-hover border-white/10 hover:border-faceit-orange/60 hover:shadow-glow-orange'
      }`}
      title={isCurrentUser ? 'Your Profile (Click to view full details)' : 'Click to view deep player performance, match history, and risk analysis'}
    >
      {/* Top Row: Key Performance Metrics (last 30 matches) */}
      <div className="grid grid-cols-4 gap-1 text-center font-mono">
        {/* K/D */}
        <div className="stat-cell p-1 min-w-0" title={`Average K/D over the ${statsWindow}`}>
          <div className="text-[9px] text-zinc-400 font-sans uppercase font-bold">K/D 30M</div>
          <div
            className={`text-xs font-black mt-0.5 truncate ${
              displayKd >= 1.25
                ? 'text-emerald-400'
                : displayKd < 0.95
                ? 'text-red-400'
                : 'text-zinc-100'
            }`}
          >
            {displayKd.toFixed(2)}
          </div>
        </div>

        {/* ADR */}
        <div className="stat-cell p-1 min-w-0" title={`Average ADR over the ${statsWindow}`}>
          <div className="text-[9px] text-zinc-400 font-sans uppercase font-bold">ADR 30M</div>
          {displayAdr !== undefined ? (
            <div
              className={`text-xs font-black mt-0.5 truncate ${
                displayAdr >= 85
                  ? 'text-emerald-400'
                  : displayAdr < 70
                  ? 'text-zinc-400'
                  : 'text-zinc-100'
              }`}
            >
              {Math.round(displayAdr)}
            </div>
          ) : (
            <div className="text-xs font-black text-zinc-500 mt-0.5">—</div>
          )}
        </div>

        {/* HS% */}
        <div className="stat-cell p-1 min-w-0" title={`Average headshot % over the ${statsWindow}`}>
          <div className="text-[9px] text-zinc-400 font-sans uppercase font-bold">HS% 30M</div>
          <div className="text-xs font-black text-zinc-100 mt-0.5 truncate">
            {displayHs !== undefined ? `${Math.round(displayHs)}%` : <span className="text-zinc-500">—</span>}
          </div>
        </div>

        {/* Win Rate & Matches */}
        <div className="stat-cell p-1 min-w-0" title={`Win rate over the ${statsWindow}`}>
          <div className="text-[9px] text-zinc-400 font-sans uppercase font-bold">WR 30M</div>
          <div className="text-xs font-black text-zinc-100 mt-0.5 truncate">
            {displayWinRate !== undefined ? `${displayWinRate.toFixed(0)}%` : <span className="text-zinc-500">—</span>}
          </div>
        </div>
      </div>

      {/* Bottom Row: Context Tags & Badges */}
      <div className={`${compact ? 'mt-1' : 'mt-1.5'} flex items-center justify-between flex-wrap gap-1 text-[9px] font-mono font-bold`}>
        <div className="flex items-center flex-wrap gap-1">
          {/* Premade Group */}
          {premadeGroup && (
            <span
              className="px-1.5 py-0.5 rounded font-extrabold uppercase"
              style={{
                backgroundColor: `${premadeGroup.color}25`,
                color: premadeGroup.color,
                border: `1px solid ${premadeGroup.color}60`,
              }}
            >
              {premadeGroup.tag}
            </span>
          )}

          {/* Current User Indicator */}
          {isCurrentUser && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-cyan-500/25 text-cyan-300 border border-cyan-400/60 font-black shadow-sm tracking-wider">
              YOU
            </span>
          )}

          {/* Form Status */}
          {showForm && stats.formStatus === 'HOT' && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/50 shadow-glow-orange animate-pulse">
              <Flame className="w-2.5 h-2.5 text-orange-400 fill-orange-400" />
              <span>HOT</span>
            </span>
          )}

          {showForm && stats.formStatus === 'COLD' && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              <Snowflake className="w-2.5 h-2.5 text-cyan-300" />
              <span>COLD</span>
            </span>
          )}

          {/* Consecutive Win / Loss Streak */}
          {stats.currentStreak.count >= 2 && (
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-extrabold ${
                stats.currentStreak.type === 'W'
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                  : 'bg-red-500/25 text-red-300 border border-red-500/40'
              }`}
              title={`${stats.currentStreak.count} ${stats.currentStreak.type === 'W' ? 'wins' : 'losses'} in a row`}
            >
              {stats.currentStreak.type === 'W' ? (
                <Flame className="w-2.5 h-2.5 text-emerald-300 fill-emerald-300" />
              ) : (
                <Snowflake className="w-2.5 h-2.5 text-red-300" />
              )}
              <span>{stats.currentStreak.count}{stats.currentStreak.type === 'W' ? 'W' : 'L'}</span>
            </span>
          )}

          {/* FCR Share */}
          {showFcr && stats.fcrContributionPercent !== undefined && stats.fcrContributionPercent >= 24 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
              <Zap className="w-2.5 h-2.5 text-purple-400 fill-purple-400" />
              <span>{stats.fcrContributionPercent}%</span>
            </span>
          )}

          {/* Smurf Risk Score */}
          {risk ? (
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border ${riskBadgeStyle}`}
              title={`Smurf Risk Assessment: ${risk.score}% (${risk.level})`}
            >
              <ShieldAlert className="w-2.5 h-2.5" />
              <span>Smurf: {risk.score}%</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              <span>Smurf: —</span>
            </span>
          )}

          {/* Steam Hours or Hidden Account */}
          {steam?.fetchError ? (
            <span
              className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700"
              title="Steam profile could not be fetched — hours unavailable"
            >
              Hours Hidden
            </span>
          ) : steam && !steam.isPrivate && steam.playtime?.cs2HoursTotal ? (
            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              {steam.playtime.cs2HoursTotal}h
            </span>
          ) : steam?.isPrivate ? (
            <span
              className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30"
              title="Steam profile is hidden/private — hours unavailable"
            >
              Hours Hidden
            </span>
          ) : null}
        </div>

        <a
          href={`https://www.faceit.com/en/players/${encodeURIComponent(stats.nickname)}/stats/cs2`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="flex items-center gap-1 text-faceit-orange hover:text-orange-400 font-bold hover:underline transition px-1.5 py-0.5 rounded bg-faceit-orange/10 border border-faceit-orange/30 hover:bg-faceit-orange/20"
          title="Open player CS2 stats on FACEIT"
        >
          <span className="text-[9px] font-sans">Details</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    </div>
  );
});
PlayerBadge.displayName = "PlayerBadge";