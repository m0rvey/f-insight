import React from 'react';
import { FaceitPlayerFullStats } from '../../types/faceit';

interface PlayerHistoryTabProps {
  stats: FaceitPlayerFullStats;
}

export const PlayerHistoryTab: React.FC<PlayerHistoryTabProps> = ({ stats }) => {
  return (
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
  );
};
