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
      <div className="w-full mt-1.5 p-2 rounded-xl bg-[#121215]/80 border border-white/5 text-center text-[10px] text-zinc-500 font-mono animate-pulse">
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
      className="w-full mt-2 p-2 rounded-xl bg-[#141418]/95 hover:bg-[#1A1A20] border border-white/10 hover:border-faceit-orange/60 text-white font-sans transition-all duration-150 cursor-pointer shadow-md hover:shadow-glow-orange group active:scale-[0.99] select-none"
      title="Click to view deep player performance, match history, and risk analysis"
    >
      {/* Top Row: Key Performance Metrics */}
      <div className="grid grid-cols-4 gap-1 text-center font-mono">
        {/* K/D */}
        <div className="bg-black/40 rounded-lg p-1 border border-white/5 group-hover:border-white/10 transition">
          <div className="text-[8px] text-zinc-400 font-sans uppercase font-bold">
            {mapStat ? 'MAP K/D' : 'K/D'}
          </div>
          <div
            className={`text-xs font-black mt-0.5 ${
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
        <div className="bg-black/40 rounded-lg p-1 border border-white/5 group-hover:border-white/10 transition">
          <div className="text-[8px] text-zinc-400 font-sans uppercase font-bold">ADR</div>
          <div
            className={`text-xs font-black mt-0.5 ${
              displayAdr >= 85
                ? 'text-emerald-400'
                : displayAdr < 70
                ? 'text-zinc-400'
                : 'text-zinc-100'
            }`}
          >
            {Math.round(displayAdr)}
          </div>
        </div>

        {/* HS% */}
        <div className="bg-black/40 rounded-lg p-1 border border-white/5 group-hover:border-white/10 transition">
          <div className="text-[8px] text-zinc-400 font-sans uppercase font-bold">HS%</div>
          <div className="text-xs font-bold text-zinc-200 mt-0.5">
            {Math.round(displayHs)}%
          </div>
        </div>

        {/* Win Rate & Matches */}
        <div className="bg-black/40 rounded-lg p-1 border border-white/5 group-hover:border-white/10 transition">
          <div className="text-[8px] text-zinc-400 font-sans uppercase font-bold">
            {mapStat ? 'MAP WR' : 'WIN%'}
          </div>
          <div className="text-xs font-bold text-zinc-200 mt-0.5 truncate">
            {mapStat ? `${mapStat.winRate}%` : `${stats.overallWinRate.toFixed(0)}%`}
          </div>
        </div>
      </div>

      {/* Bottom Row: Context Tags & Badges */}
      <div className="mt-1.5 flex items-center justify-between flex-wrap gap-1 text-[9px] font-mono font-bold">
        <div className="flex items-center flex-wrap gap-1">
          {/* Premade Group */}
          {premadeGroup && (
            <span
              className="px-1.5 py-0.2 rounded font-extrabold uppercase"
              style={{
                backgroundColor: `${premadeGroup.color}25`,
                color: premadeGroup.color,
                border: `1px solid ${premadeGroup.color}60`,
              }}
            >
              {premadeGroup.tag}
            </span>
          )}

          {/* Form Status */}
          {stats.formStatus === 'HOT' && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-400 border border-orange-500/50 shadow-glow-orange animate-pulse">
              <Flame className="w-2.5 h-2.5 text-orange-400 fill-orange-400" />
              <span>HOT</span>
            </span>
          )}

          {stats.formStatus === 'COLD' && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              <Snowflake className="w-2.5 h-2.5 text-cyan-300" />
              <span>COLD</span>
            </span>
          )}

          {/* Consecutive Win / Loss Streak */}
          {stats.currentStreak.count >= 2 && (
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded font-extrabold ${
                stats.currentStreak.type === 'W'
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                  : 'bg-red-500/25 text-red-300 border border-red-500/40'
              }`}
              title={`${stats.currentStreak.count} ${stats.currentStreak.type === 'W' ? 'wins' : 'losses'} in a row`}
            >
              {stats.currentStreak.type === 'W' ? (
                <span>🔥 {stats.currentStreak.count}W</span>
              ) : (
                <span>🧊 {stats.currentStreak.count}L</span>
              )}
            </span>
          )}

          {/* FCR Share */}
          {stats.fcrContributionPercent !== undefined && stats.fcrContributionPercent >= 24 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
              <Zap className="w-2.5 h-2.5 text-purple-400 fill-purple-400" />
              <span>{stats.fcrContributionPercent}%</span>
            </span>
          )}

          {/* Risk Alert */}
          {risk && risk.score >= 35 && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded border"
              style={{
                backgroundColor: `${risk.color}20`,
                color: risk.color,
                borderColor: `${risk.color}60`,
              }}
            >
              <ShieldAlert className="w-2.5 h-2.5" />
              <span>{risk.score}%</span>
            </span>
          )}

          {/* Steam Hours */}
          {steam && !steam.isPrivate && steam.playtime?.cs2HoursTotal && (
            <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              {steam.playtime.cs2HoursTotal}h
            </span>
          )}
        </div>

        <a
          href={`https://www.faceit.com/en/players/${stats.nickname}/stats/cs2`}
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
};
