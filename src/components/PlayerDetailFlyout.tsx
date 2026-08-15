import React, { useState, useEffect } from 'react';
import { FaceitPlayerFullStats } from '../types/faceit';
import { SteamFullData } from '../types/steam';
import { RiskAnalysisResult } from '../types/risk';
import {
  X,
  ShieldAlert,
  Flame,
  Snowflake,
  ExternalLink,
  MapPin,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Lock,
  History,
  TrendingUp,
  Zap,
} from 'lucide-react';

interface PlayerDetailFlyoutProps {
  stats: FaceitPlayerFullStats;
  steam?: SteamFullData;
  risk?: RiskAnalysisResult;
  onClose: () => void;
}

type TabType = 'overview' | 'maps' | 'history' | 'risk';

export const PlayerDetailFlyout: React.FC<PlayerDetailFlyoutProps> = ({
  stats,
  steam,
  risk,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const steamSummary = steam?.summary;
  const steamPlaytime = steam?.playtime;
  const steamBans = steam?.bans;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm font-sans antialiased text-white animate-fade-in"
    >
      <div className="glass-panel w-full max-w-2xl max-h-[85vh] rounded-2xl border border-faceit-border/90 shadow-2xl flex flex-col overflow-hidden bg-faceit-dark" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-faceit-card via-zinc-900 to-faceit-card border-b border-faceit-border/80 flex items-start justify-between relative">
          <div className="flex items-center gap-4">
            <div className="relative">
              {stats.avatar ? (
                <img
                  src={stats.avatar}
                  alt={stats.nickname}
                  className="w-14 h-14 rounded-xl object-cover border-2 border-faceit-border shadow-md"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-zinc-800 border-2 border-faceit-border flex items-center justify-center font-bold text-xl text-zinc-400">
                  {stats.nickname.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="absolute -bottom-1.5 -right-1.5 px-1.5 py-0.5 rounded bg-faceit-orange text-black font-black text-[10px] font-mono shadow">
                LVL {stats.skillLevel}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white tracking-wide">{stats.nickname}</h2>
                {stats.country && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 uppercase font-mono">
                    {stats.country}
                  </span>
                )}
                {stats.formStatus === 'HOT' && (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-mono font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40 animate-pulse">
                    <Flame className="w-3 h-3 text-orange-400" />
                    ON FIRE (Form +{Math.round((stats.recentKd / stats.overallKd - 1) * 100)}%)
                  </span>
                )}
                {stats.formStatus === 'COLD' && (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    <Snowflake className="w-3 h-3 text-cyan-300" />
                    COLD / TILT
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-400 flex-wrap">
                <span className="font-mono text-zinc-200">
                  <strong className="text-faceit-orange">{stats.elo}</strong> Elo
                </span>
                <span>•</span>
                <span>{stats.totalMatches} Matches</span>
                <span>•</span>
                <span>{stats.overallWinRate.toFixed(0)}% Win Rate</span>
                <span>•</span>
                <span>{stats.overallKd.toFixed(2)} K/D</span>
                <span>•</span>
                <span>{Math.round(stats.overallAdr)} ADR</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {stats.steamId64 && /^\d+$/.test(stats.steamId64) && (
              <a
                href={`https://steamcommunity.com/profiles/${stats.steamId64}`}
                target="_blank"
                rel="noreferrer noopener"
                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white transition text-xs flex items-center gap-1"
                title="Open Steam Profile"
              >
                <span>Steam</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-faceit-border/80 bg-zinc-900/60 px-5">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2.5 px-4 text-xs font-medium border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-faceit-orange text-faceit-orange font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Overview & Form
          </button>
          <button
            onClick={() => setActiveTab('maps')}
            className={`py-2.5 px-4 text-xs font-medium border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'maps'
                ? 'border-faceit-orange text-faceit-orange font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Map Pool Stats ({Object.keys(stats.mapStats || {}).length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2.5 px-4 text-xs font-medium border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-faceit-orange text-faceit-orange font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Recent Matches ({stats.recentMatches?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('risk')}
            className={`py-2.5 px-4 text-xs font-medium border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'risk'
                ? 'border-faceit-orange text-faceit-orange font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Red Flags Audit
            {risk && risk.score >= 25 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-red-500/30 text-red-300">
                {risk.score}%
              </span>
            )}
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Quick KPI Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-faceit-card rounded-xl p-3 border border-faceit-border/80 text-center">
                  <div className="text-[10px] text-faceit-muted uppercase">Overall K/D</div>
                  <div className="text-xl font-bold font-mono text-zinc-100 mt-1">{stats.overallKd.toFixed(2)}</div>
                </div>
                <div className="bg-faceit-card rounded-xl p-3 border border-faceit-border/80 text-center">
                  <div className="text-[10px] text-faceit-muted uppercase">Avg ADR</div>
                  <div className="text-xl font-bold font-mono text-zinc-100 mt-1">{Math.round(stats.overallAdr)}</div>
                </div>
                <div className="bg-faceit-card rounded-xl p-3 border border-faceit-border/80 text-center">
                  <div className="text-[10px] text-faceit-muted uppercase">Win Rate</div>
                  <div className="text-xl font-bold font-mono text-zinc-100 mt-1">{stats.overallWinRate.toFixed(0)}%</div>
                </div>
                <div className="bg-faceit-card rounded-xl p-3 border border-faceit-border/80 text-center">
                  <div className="text-[10px] text-faceit-muted uppercase">FCR Impact</div>
                  <div className="text-xl font-bold font-mono text-purple-400 mt-1">
                    {stats.fcrContributionPercent !== undefined ? `${stats.fcrContributionPercent}%` : '20%'}
                  </div>
                </div>
                <div className="bg-faceit-card rounded-xl p-3 border border-faceit-border/80 text-center">
                  <div className="text-[10px] text-faceit-muted uppercase">Risk Score</div>
                  <div
                    className="text-xl font-bold font-mono mt-1"
                    style={{ color: risk?.color || '#10B981' }}
                  >
                    {risk?.score ?? 0}%
                  </div>
                </div>
              </div>

              {/* Form & Momentum Section */}
              <div className="bg-faceit-card rounded-xl p-4 border border-faceit-border/80">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-xs text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-faceit-orange" />
                    Current Form & Momentum (Last 5 Games vs Baseline)
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
                    <div className="text-[10px] text-faceit-muted uppercase">Recent 5 Games K/D</div>
                    <div className="text-lg font-bold font-mono text-zinc-100 mt-0.5">
                      {stats.recentKd.toFixed(2)}
                      <span className="text-xs text-faceit-muted font-sans ml-1">
                        (vs {stats.overallKd.toFixed(2)} baseline)
                      </span>
                    </div>
                  </div>

                  <div className="bg-faceit-dark/70 rounded-lg p-2.5 border border-faceit-border/50">
                    <div className="text-[10px] text-faceit-muted uppercase">Recent 5 Games ADR</div>
                    <div className="text-lg font-bold font-mono text-zinc-100 mt-0.5">
                      {Math.round(stats.recentAdr)}
                      <span className="text-xs text-faceit-muted font-sans ml-1">
                        (vs {Math.round(stats.overallAdr)} baseline)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Steam Info Block */}
              <div className="bg-faceit-card rounded-xl p-4 border border-faceit-border/80">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-zinc-200">Steam Account Data</span>
                    {steam?.isPrivate ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300">
                        <Lock className="w-3 h-3" /> Private Profile
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                        <CheckCircle2 className="w-3 h-3" /> Public Profile
                      </span>
                    )}
                  </div>
                  {steamSummary?.timeCreated && (
                    <div className="flex items-center gap-1 text-xs text-zinc-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{steamSummary.accountAgeYears ? `${steamSummary.accountAgeYears.toFixed(1)} years old` : 'Verified'}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-faceit-dark/70 rounded-lg p-2.5 border border-faceit-border/50">
                    <div className="text-[10px] text-faceit-muted flex items-center justify-center gap-1">
                      <Clock className="w-3 h-3" /> CS2 Hours
                    </div>
                    <div className="text-base font-bold font-mono text-zinc-100 mt-1">
                      {steamPlaytime?.cs2HoursTotal ? `${steamPlaytime.cs2HoursTotal} hrs` : (steam?.isPrivate ? 'Hidden' : '0 hrs')}
                    </div>
                  </div>

                  <div className="bg-faceit-dark/70 rounded-lg p-2.5 border border-faceit-border/50">
                    <div className="text-[10px] text-faceit-muted">Past 2 Weeks</div>
                    <div className="text-base font-bold font-mono text-zinc-100 mt-1">
                      {steamPlaytime?.cs2HoursLast2Weeks ? `${steamPlaytime.cs2HoursLast2Weeks} hrs` : (steam?.isPrivate ? 'Hidden' : '0 hrs')}
                    </div>
                  </div>

                  <div className="bg-faceit-dark/70 rounded-lg p-2.5 border border-faceit-border/50">
                    <div className="text-[10px] text-faceit-muted">VAC / Game Bans</div>
                    <div
                      className={`text-base font-bold font-mono mt-1 ${
                        steamBans?.vacBanned || steamBans?.numberOfGameBans ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {steamBans?.vacBanned || (steamBans?.numberOfGameBans ?? 0) > 0 ? 'Banned' : 'Clean'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MAP POOL STATS */}
          {activeTab === 'maps' && (
            <div className="space-y-3">
              {Object.keys(stats.mapStats || {}).length === 0 ? (
                <div className="text-center py-8 text-zinc-400 text-xs">
                  No map breakdown statistics available yet for this player.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-faceit-border text-faceit-muted font-medium">
                        <th className="py-2 px-3">Map</th>
                        <th className="py-2 px-3 text-center">Matches</th>
                        <th className="py-2 px-3 text-center">Win Rate</th>
                        <th className="py-2 px-3 text-center">K/D</th>
                        <th className="py-2 px-3 text-center">Avg ADR</th>
                        <th className="py-2 px-3 text-center">HS %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-faceit-border/40 font-mono">
                      {Object.values(stats.mapStats).map((m) => (
                        <tr key={m.mapName} className="hover:bg-faceit-card/60 transition">
                          <td className="py-2.5 px-3 font-bold text-zinc-200 capitalize font-sans">
                            {m.mapName}
                          </td>
                          <td className="py-2.5 px-3 text-center text-zinc-300">{m.matches}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                m.winRate >= 60
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : m.winRate <= 40
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'text-zinc-300'
                              }`}
                            >
                              {m.winRate.toFixed(0)}%
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`font-bold ${
                                m.kd >= 1.3 ? 'text-emerald-400' : m.kd < 0.95 ? 'text-red-400' : 'text-zinc-200'
                              }`}
                            >
                              {m.kd.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center text-zinc-300">{m.avgAdr ? Math.round(m.avgAdr) : 78}</td>
                          <td className="py-2.5 px-3 text-center text-zinc-300">{Math.round(m.hsPercent)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RECENT MATCHES */}
          {activeTab === 'history' && (
            <div className="space-y-2">
              {stats.recentMatches?.length === 0 ? (
                <div className="text-center py-8 text-zinc-400 text-xs">
                  No recent match history found.
                </div>
              ) : (
                stats.recentMatches.map((m, idx) => (
                  <div
                    key={m.matchId || idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-faceit-card border border-faceit-border/80 hover:border-zinc-600 transition flex-wrap gap-2"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs font-mono ${
                          m.result === 'W'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-red-500/20 text-red-400 border border-red-500/40'
                        }`}
                      >
                        {m.result}
                      </span>
                      <div>
                        <div className="font-semibold text-xs text-zinc-200 capitalize">
                          {m.map || 'CS2 Match'}
                        </div>
                        <div className="text-[10px] text-faceit-muted font-mono">{m.score}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div className="text-right">
                        <div className="text-zinc-300 font-bold">{m.kills} - {m.deaths}</div>
                        <div className="text-[10px] text-faceit-muted">K - D</div>
                      </div>
                      <div className="text-right min-w-[45px]">
                        <div
                          className={`font-bold ${
                            m.kd >= 1.3 ? 'text-emerald-400' : m.kd < 0.9 ? 'text-red-400' : 'text-zinc-200'
                          }`}
                        >
                          {m.kd.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-faceit-muted">K/D</div>
                      </div>
                      <div className="text-right min-w-[40px]">
                        <div className="text-zinc-300 font-bold">{m.adr ? Math.round(m.adr) : 78}</div>
                        <div className="text-[10px] text-faceit-muted">ADR</div>
                      </div>
                      <div className="text-right min-w-[35px]">
                        <div className="text-zinc-300">{Math.round(m.hsPercent)}%</div>
                        <div className="text-[10px] text-faceit-muted">HS</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: RED FLAGS AUDIT */}
          {activeTab === 'risk' && (
            <div className="space-y-3">
              <div
                className="p-4 rounded-xl border flex items-center justify-between"
                style={{
                  backgroundColor: `${risk?.color || '#10B981'}15`,
                  borderColor: `${risk?.color || '#10B981'}40`,
                }}
              >
                <div className="flex items-center gap-3">
                  <ShieldAlert
                    className="w-6 h-6"
                    style={{ color: risk?.color || '#10B981' }}
                  />
                  <div>
                    <div className="font-bold text-sm text-white">
                      Risk Level: {risk?.level} ({risk?.score}% Risk Score)
                    </div>
                    <div className="text-xs text-zinc-300 mt-0.5">
                      {risk?.score === 0
                        ? 'Account metrics are completely consistent with normal play.'
                        : 'Algorithmic analysis of FACEIT & Steam historical metrics.'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mt-3">
                <h4 className="text-xs font-bold text-faceit-muted uppercase tracking-wider">
                  Triggered Indicators ({risk?.flags.length || 0})
                </h4>

                {risk?.flags.map((flag) => (
                  <div
                    key={flag.id}
                    className="p-3 rounded-lg bg-faceit-card border border-faceit-border flex items-start gap-3"
                  >
                    <AlertTriangle
                      className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        flag.severity === 'danger'
                          ? 'text-red-400'
                          : flag.severity === 'warning'
                          ? 'text-amber-400'
                          : 'text-blue-400'
                      }`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-zinc-200">{flag.title}</span>
                        {flag.weight > 0 && (
                          <span className="text-[10px] font-mono font-bold text-red-400">
                            +{flag.weight} Risk
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{flag.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
