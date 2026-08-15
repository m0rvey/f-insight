import React, { useState } from 'react';
import { FaceitPlayerFullStats, MapSpecificStats } from '../../types/faceit';
import { Trophy, Swords } from 'lucide-react';

interface PlayerMapsTabProps {
  stats: FaceitPlayerFullStats;
}

export const PlayerMapsTab: React.FC<PlayerMapsTabProps> = ({ stats }) => {
  const [sortBy, setSortBy] = useState<'matches' | 'winRate' | 'kd'>('matches');

  const mapsList = Object.values(stats.mapStats || {});

  if (mapsList.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-400 text-xs">
        No map breakdown statistics available yet for this player.
      </div>
    );
  }

  const sortedMaps = [...mapsList].sort((a, b) => {
    if (sortBy === 'winRate') return b.winRate - a.winRate;
    if (sortBy === 'kd') return b.kd - a.kd;
    return b.matches - a.matches;
  });

  const bestMap = [...mapsList].sort((a, b) => (b.wins * b.winRate) - (a.wins * a.winRate))[0];
  const mostPlayed = [...mapsList].sort((a, b) => b.matches - a.matches)[0];

  return (
    <div className="space-y-3 font-sans">
      {/* Top Map Highlights */}
      <div className="grid grid-cols-2 gap-3">
        {bestMap && (
          <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                <Trophy className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div>
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                  Best Map
                </span>
                <span className="text-sm font-extrabold text-white capitalize font-mono">
                  {bestMap.mapName}
                </span>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-xs font-bold text-emerald-400 block">{bestMap.winRate}% WR</span>
              <span className="text-[10px] text-zinc-400">{bestMap.matches} games</span>
            </div>
          </div>
        )}

        {mostPlayed && (
          <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
                <Swords className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div>
                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block">
                  Most Played
                </span>
                <span className="text-sm font-extrabold text-white capitalize font-mono">
                  {mostPlayed.mapName}
                </span>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-xs font-bold text-blue-400 block">{mostPlayed.matches} Matches</span>
              <span className="text-[10px] text-zinc-400">{mostPlayed.kd.toFixed(2)} K/D</span>
            </div>
          </div>
        )}
      </div>

      {/* Sort Buttons */}
      <div className="flex items-center justify-between text-xs pt-1">
        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
          Map Pool Breakdown ({sortedMaps.length} Maps)
        </span>
        <div className="flex items-center gap-1 font-mono text-[10px]">
          <button
            onClick={() => setSortBy('matches')}
            className={`px-2 py-0.5 rounded border transition ${
              sortBy === 'matches'
                ? 'bg-faceit-orange/20 text-faceit-orange border-faceit-orange/50 font-bold'
                : 'bg-zinc-800 text-zinc-400 border-white/5 hover:text-zinc-200'
            }`}
          >
            Matches
          </button>
          <button
            onClick={() => setSortBy('winRate')}
            className={`px-2 py-0.5 rounded border transition ${
              sortBy === 'winRate'
                ? 'bg-faceit-orange/20 text-faceit-orange border-faceit-orange/50 font-bold'
                : 'bg-zinc-800 text-zinc-400 border-white/5 hover:text-zinc-200'
            }`}
          >
            Win Rate
          </button>
          <button
            onClick={() => setSortBy('kd')}
            className={`px-2 py-0.5 rounded border transition ${
              sortBy === 'kd'
                ? 'bg-faceit-orange/20 text-faceit-orange border-faceit-orange/50 font-bold'
                : 'bg-zinc-800 text-zinc-400 border-white/5 hover:text-zinc-200'
            }`}
          >
            K/D
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-faceit-border/80 bg-faceit-card">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-faceit-border/80 text-faceit-muted font-bold text-[10px] uppercase tracking-wider bg-black/20">
              <th className="py-2.5 px-3">Map</th>
              <th className="py-2.5 px-3 text-center">Matches</th>
              <th className="py-2.5 px-3">Win Rate</th>
              <th className="py-2.5 px-3 text-center">K/D</th>
              <th className="py-2.5 px-3 text-center">Avg Kills</th>
              <th className="py-2.5 px-3 text-center">ADR</th>
              <th className="py-2.5 px-3 text-center">HS%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-faceit-border/40 font-mono">
            {sortedMaps.map((m: MapSpecificStats) => {
              const wrColor =
                m.winRate >= 60
                  ? 'text-emerald-400'
                  : m.winRate <= 42
                  ? 'text-red-400'
                  : 'text-zinc-300';

              const kdColor =
                m.kd >= 1.25
                  ? 'text-emerald-400 font-bold'
                  : m.kd < 0.95
                  ? 'text-red-400 font-bold'
                  : 'text-zinc-200';

              return (
                <tr key={m.mapName} className="hover:bg-white/5 transition">
                  <td className="py-2.5 px-3">
                    <span className="font-extrabold text-zinc-100 capitalize font-sans block">
                      {m.mapName}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {m.wins}W - {m.losses}L
                    </span>
                  </td>

                  <td className="py-2.5 px-3 text-center text-zinc-300 font-bold">
                    {m.matches}
                  </td>

                  <td className="py-2.5 px-3 min-w-[120px]">
                    <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                      <span className={wrColor}>{m.winRate}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-black/60 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          m.winRate >= 60
                            ? 'bg-emerald-400'
                            : m.winRate <= 42
                            ? 'bg-red-400'
                            : 'bg-amber-400'
                        }`}
                        style={{ width: `${Math.max(4, m.winRate)}%` }}
                      />
                    </div>
                  </td>

                  <td className="py-2.5 px-3 text-center">
                    <span className={kdColor}>{m.kd != null ? m.kd.toFixed(2) : '—'}</span>
                  </td>

                  <td className="py-2.5 px-3 text-center text-zinc-300">
                    {m.avgKills ? m.avgKills.toFixed(1) : ((m.kd * 18).toFixed(1))}
                  </td>

                  <td className="py-2.5 px-3 text-center text-zinc-300">
                    {m.avgAdr != null ? Math.round(m.avgAdr) : 75}
                  </td>

                  <td className="py-2.5 px-3 text-center text-zinc-300">
                    {m.hsPercent != null ? `${Math.round(m.hsPercent)}%` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
