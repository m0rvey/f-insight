import React from 'react';
import { FaceitPlayerFullStats } from '../../types/faceit';
import { SteamFullData } from '../../types/steam';
import { RiskAnalysisResult } from '../../types/risk';
import { LevelProgressBar } from './LevelProgressBar';
import { PlayerRadarChart } from './PlayerRadarChart';
import { Zap, Lock, CheckCircle2, Calendar, Clock } from 'lucide-react';

interface PlayerOverviewTabProps {
  stats: FaceitPlayerFullStats;
  steam?: SteamFullData;
  risk?: RiskAnalysisResult;
}

export const PlayerOverviewTab = React.memo<PlayerOverviewTabProps>(({ stats, steam, risk }) => {
  const steamSummary = steam?.summary;
  const steamPlaytime = steam?.playtime;
  const steamBans = steam?.bans;

  const kd30 = stats.last30Kd ?? stats.overallKd;
  const adr30 = stats.last30Adr ?? stats.overallAdr;
  const wr30 = stats.last30WinRate ?? (stats.overallWinRate > 0 ? stats.overallWinRate : undefined);

  return (
    <div className="space-y-4">
      {/* Elo Level Progress Bar */}
      <LevelProgressBar elo={stats.elo} />

      {/* Quick KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="surface-card p-3 text-center">
          <div className="text-[10px] text-faceit-muted uppercase">K/D 30M</div>
          <div className="text-xl font-bold font-mono text-zinc-100 mt-1">{kd30.toFixed(2)}</div>
        </div>
        <div className="surface-card p-3 text-center">
          <div className="text-[10px] text-faceit-muted uppercase">ADR 30M</div>
          <div className="text-xl font-bold font-mono text-zinc-100 mt-1">
            {adr30 !== undefined ? Math.round(adr30) : <span className="text-zinc-500">—</span>}
          </div>
        </div>
        <div className="surface-card p-3 text-center">
          <div className="text-[10px] text-faceit-muted uppercase">Win Rate 30M</div>
          <div className="text-xl font-bold font-mono text-zinc-100 mt-1">
            {wr30 !== undefined ? `${wr30.toFixed(0)}%` : <span className="text-zinc-500">—</span>}
          </div>
        </div>
        <div className="surface-card p-3 text-center">
          <div className="text-[10px] text-faceit-muted uppercase">FCR Impact</div>
          <div className="text-xl font-bold font-mono text-purple-400 mt-1">
            {stats.fcrContributionPercent !== undefined ? `${stats.fcrContributionPercent}%` : <span className="text-zinc-500">—</span>}
          </div>
        </div>
        <div className="surface-card p-3 text-center">
          <div className="text-[10px] text-faceit-muted uppercase">Smurf Risk</div>
          {risk ? (
            <div
              className="text-xl font-bold font-mono mt-1"
              style={{ color: risk.color }}
            >
              {risk.score}%
            </div>
          ) : (
            <div className="text-xl font-bold font-mono text-zinc-500 mt-1">—</div>
          )}
        </div>
      </div>

      {/* Deep Performance & Radar Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left Column: 5-Axis Pentagon Skill Radar */}
        <div className="md:col-span-5 flex flex-col">
          <PlayerRadarChart stats={stats} />
        </div>

        {/* Right Column: Form & Momentum + Steam Account Details */}
        <div className="md:col-span-7 space-y-4">
          {/* Form & Momentum Section */}
          <div className="bg-faceit-card rounded-xl p-4 border border-faceit-border/80">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-xs text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-faceit-orange" />
                Form & Momentum (Last 5 Games)
              </span>
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                stats.formStatus === 'HOT'
                  ? 'bg-orange-500/20 text-orange-400'
                  : stats.formStatus === 'COLD'
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'bg-zinc-800 text-zinc-300'
              }`}>
                {stats.formStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-faceit-dark/70 rounded-lg p-2.5 border border-faceit-border/50">
                <div className="text-[10px] text-faceit-muted uppercase">Recent 5 K/D</div>
                <div className="text-lg font-bold font-mono text-zinc-100 mt-0.5">
                  {stats.recentKd.toFixed(2)}
                  <span className="text-xs text-faceit-muted font-sans ml-1">
                    (vs {stats.overallKd.toFixed(2)})
                  </span>
                </div>
              </div>

              <div className="bg-faceit-dark/70 rounded-lg p-2.5 border border-faceit-border/50">
                <div className="text-[10px] text-faceit-muted uppercase">Recent 5 ADR</div>
                <div className="text-lg font-bold font-mono text-zinc-100 mt-0.5">
                  {Math.round(stats.recentAdr)}
                  <span className="text-xs text-faceit-muted font-sans ml-1">
                    (vs {stats.overallAdr !== undefined ? Math.round(stats.overallAdr) : '—'})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Steam Info Block */}
          <div className="bg-faceit-card rounded-xl p-4 border border-faceit-border/80">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-zinc-200">Steam Account</span>
                {steam?.fetchError ? (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                    <Lock className="w-3 h-3" /> Unavailable
                  </span>
                ) : steam?.isPrivate ? (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300">
                    <Lock className="w-3 h-3" /> Hidden account
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                    <CheckCircle2 className="w-3 h-3" /> Public
                  </span>
                )}
              </div>
              {steamSummary?.timeCreated && (
                <div className="flex items-center gap-1 text-xs text-zinc-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{steamSummary.accountAgeYears ? `${steamSummary.accountAgeYears.toFixed(1)}y old` : 'Verified'}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="bg-faceit-dark/70 rounded-lg p-2 border border-faceit-border/50">
                <div className="text-[10px] text-faceit-muted flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3" /> Hours
                </div>
                <div className="text-sm font-bold font-mono text-zinc-100 mt-0.5">
                  {steam?.isPrivate || steam?.fetchError ? 'Hours Hidden' : !steam ? '—' : steamPlaytime?.cs2HoursTotal ? `${steamPlaytime.cs2HoursTotal}h` : '0h'}
                </div>
              </div>

              <div className="bg-faceit-dark/70 rounded-lg p-2 border border-faceit-border/50">
                <div className="text-[10px] text-faceit-muted">2 Weeks</div>
                <div className="text-sm font-bold font-mono text-zinc-100 mt-0.5">
                  {steam?.isPrivate || steam?.fetchError ? 'Hours Hidden' : !steam ? '—' : steamPlaytime?.cs2HoursLast2Weeks ? `${steamPlaytime.cs2HoursLast2Weeks}h` : '0h'}
                </div>
              </div>

              <div className="bg-faceit-dark/70 rounded-lg p-2 border border-faceit-border/50">
                <div className="text-[10px] text-faceit-muted">Bans</div>
                {steamBans ? (
                  <div
                    className={`text-sm font-bold font-mono mt-0.5 ${
                      steamBans.vacBanned || steamBans.numberOfGameBans ? 'text-red-400' : 'text-emerald-400'
                    }`}
                  >
                    {steamBans.vacBanned || (steamBans.numberOfGameBans ?? 0) > 0 ? 'Banned' : 'Clean'}
                  </div>
                ) : (
                  <div className="text-sm font-bold font-mono text-zinc-500 mt-0.5">No data</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
PlayerOverviewTab.displayName = "PlayerOverviewTab";