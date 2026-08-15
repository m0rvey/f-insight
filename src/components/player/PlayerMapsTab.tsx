import React from 'react';
import { FaceitPlayerFullStats } from '../../types/faceit';

interface PlayerMapsTabProps {
  stats: FaceitPlayerFullStats;
}

export const PlayerMapsTab: React.FC<PlayerMapsTabProps> = ({ stats }) => {
  return (
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
  );
};
