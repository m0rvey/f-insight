import React from 'react';
import { FaceitPlayerFullStats } from '../types/faceit';
import { SteamFullData } from '../types/steam';
import { RiskAnalysisResult } from '../types/risk';
import { PremadeGroup } from '../types/settings';
import { Flame, Snowflake, ShieldAlert, Crosshair, Lock, ExternalLink, Zap } from 'lucide-react';

interface PlayerBadgeProps {
  playerId: string;
  stats?: FaceitPlayerFullStats;
  steam?: SteamFullData;
  risk?: RiskAnalysisResult;
  premadeGroup?: PremadeGroup;
  selectedMap?: string;
  onOpenDetails: (playerId: string) => void;
}

export const PlayerBadge: React.FC<PlayerBadgeProps> = ({
  playerId,
  stats,
  steam,
  risk,
  premadeGroup,
  selectedMap,
  onOpenDetails,
}) => {
  if (!stats) {
    return (
      <div className="inline-flex items-center gap-1 text-[11px] text-zinc-500 font-mono animate-pulse">
        <span>Loading stats...</span>
      </div>
    );
  }

  const mapNameClean = selectedMap?.replace('de_', '').toLowerCase();
  const mapStat = mapNameClean && stats.mapStats ? stats.mapStats[mapNameClean] : undefined;

  const displayKd = mapStat ? mapStat.kd : stats.overallKd;
  const displayHs = mapStat ? mapStat.hsPercent : stats.overallHsPercent;
  const displayAdr = mapStat?.avgAdr || stats.overallAdr;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onOpenDetails(playerId);
      }}
      className="inline-flex items-center flex-wrap gap-1.5 p-1 rounded-lg bg-[#141417]/95 hover:bg-[#1A1A1E] border border-white/10 text-white font-sans text-xs cursor-pointer transition-all duration-150 shadow-sm hover:border-faceit-orange/70 hover:shadow-glow-orange group active:scale-[0.98]"
      title="Click to view deep player analysis, form, and match history"
    >
      {/* Country Code */}
      {stats.country && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/90 border border-zinc-700/80 text-zinc-300 font-mono font-bold uppercase">
          {stats.country}
        </span>
      )}

      {/* Premade Group Tag */}
      {premadeGroup && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider shadow-sm"
          style={{
            backgroundColor: `${premadeGroup.color}25`,
            color: premadeGroup.color,
            border: `1px solid ${premadeGroup.color}60`,
          }}
        >
          {premadeGroup.tag}
        </span>
      )}

      {/* Player Form / Momentum Indicator */}
      {stats.formStatus === 'HOT' && (
        <span
          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono font-extrabold bg-orange-500/20 text-orange-400 border border-orange-500/50 shadow-glow-orange animate-pulse"
          title={`On Fire: Last 5 games avg KD is ${stats.recentKd} (${Math.round((stats.recentKd / stats.overallKd - 1) * 100)}% above baseline)`}
        >
          <Flame className="w-3 h-3 text-orange-400 fill-orange-400" />
          <span>ON FIRE</span>
        </span>
      )}

      {stats.formStatus === 'COLD' && (
        <span
          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
          title={`Cold / Tilt: Last 5 games avg KD is ${stats.recentKd}`}
        >
          <Snowflake className="w-3 h-3 text-cyan-300" />
          <span>COLD</span>
        </span>
      )}

      {stats.currentStreak.count >= 2 && (
        <span
          className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-mono font-extrabold ${
            stats.currentStreak.type === 'W'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
          }`}
          title={`${stats.currentStreak.count} ${stats.currentStreak.type === 'W' ? 'Wins' : 'Losses'} in a row`}
        >
          <span>
            {stats.currentStreak.count}
            {stats.currentStreak.type}
          </span>
        </span>
      )}

      {stats.fcrContributionPercent !== undefined && (
        <span
          className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-mono font-extrabold ${
            stats.fcrContributionPercent >= 24
              ? 'bg-purple-500/25 text-purple-300 border border-purple-500/50'
              : stats.fcrContributionPercent <= 16
              ? 'bg-zinc-800/90 text-zinc-400 border border-zinc-700/60'
              : 'bg-zinc-800/90 text-zinc-200 border border-zinc-700/60'
          }`}
          title={`FCR Team Firepower Share: ${stats.fcrContributionPercent}% (20% is ideal balance)`}
        >
          <Zap className="w-2.5 h-2.5 text-purple-400 fill-purple-400" />
          <span>{stats.fcrContributionPercent}% FCR</span>
        </span>
      )}

      {/* ADR */}
      <span
        className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-black/40 border border-white/10 font-mono"
        title="Average Damage per Round (ADR)"
      >
        <span className="text-zinc-400 text-[9px] font-sans">ADR</span>
        <span className={`font-bold ${displayAdr >= 85 ? 'text-emerald-400' : displayAdr < 70 ? 'text-zinc-400' : 'text-zinc-100'}`}>
          {Math.round(displayAdr)}
        </span>
      </span>

      {/* Map or Overall K/D */}
      <span
        className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-black/40 border border-white/10 font-mono"
        title={mapStat ? `K/D on ${mapNameClean} (${mapStat.matches} matches)` : `Overall K/D (${stats.totalMatches} matches)`}
      >
        <span className="text-zinc-400 text-[9px] font-sans">{mapStat ? 'MAP K/D' : 'K/D'}</span>
        <span
          className={`font-extrabold ${
            displayKd >= 1.3 ? 'text-emerald-400' : displayKd < 0.95 ? 'text-red-400' : 'text-zinc-100'
          }`}
        >
          {displayKd.toFixed(2)}
        </span>
      </span>

      {/* HS % */}
      <span
        className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded bg-black/40 border border-white/10 font-mono"
        title="Headshot %"
      >
        <Crosshair className="w-2.5 h-2.5 text-zinc-400" />
        <span className="font-semibold text-zinc-300">{Math.round(displayHs)}%</span>
      </span>

      {/* Steam Status */}
      {steam && (
        <span
          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-black/40 border border-white/10 font-mono text-zinc-300"
          title={steam.isPrivate ? 'Steam profile is private' : `Steam CS2 Hours: ${steam.playtime?.cs2HoursTotal ?? 'N/A'}`}
        >
          {steam.isPrivate ? (
            <>
              <Lock className="w-2.5 h-2.5 text-amber-400" />
              <span className="text-[9px] text-amber-300">Priv Steam</span>
            </>
          ) : (
            <span>{steam.playtime?.cs2HoursTotal ? `${steam.playtime.cs2HoursTotal}h` : 'Steam'}</span>
          )}
        </span>
      )}

      {/* Risk / Red Flag Score */}
      {risk && (
        <span
          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono font-extrabold border shadow-sm"
          style={{
            backgroundColor: `${risk.color}20`,
            color: risk.color,
            borderColor: `${risk.color}50`,
          }}
          title={risk.flags.map((f) => f.title).join(' • ') || 'No suspicious flags'}
        >
          {risk.score >= 25 && <ShieldAlert className="w-3 h-3" />}
          <span>{risk.score}% {risk.badgeText}</span>
        </span>
      )}

      <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-faceit-orange transition ml-0.5" />
    </div>
  );
};
