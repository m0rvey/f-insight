import React from 'react';
import { FaceitPlayerFullStats } from '../../types/faceit';
import { Activity } from 'lucide-react';

interface PlayerHistoryTabProps {
  stats: FaceitPlayerFullStats;
}

export const PlayerHistoryTab = React.memo<PlayerHistoryTabProps>(({ stats }) => {
  const matches = stats.recentMatches || [];

  if (matches.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-400 text-xs">
        No recent match history found.
      </div>
    );
  }

  // Calculate aggregates over recent matches
  const totalGames = matches.length;
  const wins = matches.filter((m) => m.result === 'W').length;
  const losses = totalGames - wins;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  const totalKills = matches.reduce((acc, m) => acc + (m.kills || 0), 0);
  const totalDeaths = matches.reduce((acc, m) => acc + (m.deaths || 0), 0);
  const avgKd = totalDeaths > 0 ? parseFloat((totalKills / totalDeaths).toFixed(2)) : 1.0;
  const adrValues = matches.map((m) => m.adr).filter((a): a is number => a !== undefined && a > 0);
  const avgAdr = adrValues.length > 0 ? Math.round(adrValues.reduce((acc, a) => acc + a, 0) / adrValues.length) : undefined;
  const hsValues = matches.map((m) => m.hsPercent).filter((v): v is number => v !== undefined);
  const avgHs = hsValues.length > 0 ? Math.round(hsValues.reduce((acc, v) => acc + v, 0) / hsValues.length) : undefined;

  const netElo = matches.reduce((acc, m) => acc + (m.eloDiff || (m.result === 'W' ? 25 : -25)), 0);

  return (
    <div className="space-y-3 font-sans">
      {/* Recent Performance Aggregate Header */}
      <div className="p-3 rounded-xl bg-gradient-to-r from-faceit-card via-[#16161A] to-faceit-card border border-faceit-border/80">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-faceit-orange" />
            Last {totalGames} Matches Summary
          </span>
          <span
            className={`text-xs font-mono font-black ${
              netElo > 0 ? 'text-emerald-400' : netElo < 0 ? 'text-red-400' : 'text-zinc-300'
            }`}
          >
            {netElo > 0 ? `+${netElo}` : netElo} Net ELO
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center font-mono">
          <div className="stat-cell p-2">
            <div className="text-[10px] text-zinc-400 font-sans uppercase tracking-wide">Win / Loss</div>
            <div className="text-xs font-bold text-zinc-100 mt-0.5">
              <span className="text-emerald-400">{wins}W</span> - <span className="text-red-400">{losses}L</span>
              <span className="text-[10px] text-zinc-400 ml-1">({winRate}%)</span>
            </div>
          </div>

          <div className="stat-cell p-2">
            <div className="text-[10px] text-zinc-400 font-sans uppercase tracking-wide">Recent K/D</div>
            <div
              className={`text-xs font-bold mt-0.5 ${
                avgKd >= 1.25 ? 'text-emerald-400' : avgKd < 0.95 ? 'text-red-400' : 'text-zinc-100'
              }`}
            >
              {avgKd.toFixed(2)}
            </div>
          </div>

          <div className="stat-cell p-2">
            <div className="text-[10px] text-zinc-400 font-sans uppercase tracking-wide">Recent ADR</div>
            <div className="text-xs font-bold text-zinc-100 mt-0.5">{avgAdr ?? '—'}</div>
          </div>

          <div className="stat-cell p-2">
            <div className="text-[10px] text-zinc-400 font-sans uppercase tracking-wide">Recent HS%</div>
            <div className="text-xs font-bold text-zinc-100 mt-0.5">{avgHs !== undefined ? `${avgHs}%` : '—'}</div>
          </div>
        </div>
      </div>

      {/* Matches List */}
      <div className="space-y-1.5">
        {matches.map((m, idx) => (
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
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-xs text-zinc-200 capitalize font-sans">
                    {m.map || 'CS2 Match'}
                  </span>
                  {m.eloDiff !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        m.eloDiff > 0
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : m.eloDiff < 0
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {m.eloDiff > 0 ? `+${m.eloDiff}` : m.eloDiff}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-faceit-muted font-mono">
                  <span>{m.score}</span>
                  {m.elo && (
                    <>
                      <span>•</span>
                      <span>{m.elo} Elo</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="text-right">
                <div className="text-zinc-300 font-bold">{m.kills} - {m.deaths}</div>
                <div className="text-[10px] text-faceit-muted font-sans">K - D</div>
              </div>
              <div className="text-right min-w-[45px]">
                <div
                  className={`font-bold ${
                    m.kd >= 1.25 ? 'text-emerald-400' : m.kd < 0.95 ? 'text-red-400' : 'text-zinc-200'
                  }`}
                >
                  {m.kd?.toFixed(2) ?? '—'}
                </div>
                <div className="text-[10px] text-faceit-muted font-sans">K/D</div>
              </div>
              <div className="text-right min-w-[40px]">
                <div className="text-zinc-300 font-bold">{m.adr ?? '—'}</div>
                <div className="text-[10px] text-faceit-muted font-sans">ADR</div>
              </div>
              <div className="text-right min-w-[35px]">
                <div className="text-zinc-300">{m.hsPercent != null ? `${Math.round(m.hsPercent)}%` : '—'}</div>
                <div className="text-[10px] text-faceit-muted font-sans">HS</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
PlayerHistoryTab.displayName = "PlayerHistoryTab";