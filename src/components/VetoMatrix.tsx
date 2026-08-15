import React from 'react';
import { FaceitMatchDetails, FaceitPlayerFullStats } from '../types/faceit';
import { Layers, ThumbsUp, ThumbsDown, Shield, Sparkles } from 'lucide-react';

interface VetoMatrixProps {
  match: FaceitMatchDetails;
  playersStats: Record<string, FaceitPlayerFullStats>;
}

const ACTIVE_DUTY_MAPS = [
  'mirage',
  'inferno',
  'nuke',
  'ancient',
  'anubis',
  'dust2',
  'vertigo',
];

export const VetoMatrix: React.FC<VetoMatrixProps> = ({ match, playersStats }) => {
  const f1 = match.teams.faction1;
  const f2 = match.teams.faction2;

  // Calculate team stats per map
  const mapAnalysis = ACTIVE_DUTY_MAPS.map((mapName) => {
    // Faction 1 stats
    const f1Players = f1.roster.map((r) => playersStats[r.player_id]?.mapStats?.[mapName]);
    const f1Matches = f1Players.reduce((acc, p) => acc + (p?.matches || 0), 0);
    const f1Wins = f1Players.reduce((acc, p) => acc + (p?.wins || 0), 0);
    const f1WinRate = f1Matches > 0 ? Math.round((f1Wins / f1Matches) * 100) : 50;
    const f1AvgKd =
      f1Players.filter(Boolean).length > 0
        ? parseFloat(
            (
              f1Players.reduce((acc, p) => acc + (p?.kd || 1.0), 0) /
              f1Players.filter(Boolean).length
            ).toFixed(2)
          )
        : 1.0;

    // Faction 2 stats
    const f2Players = f2.roster.map((r) => playersStats[r.player_id]?.mapStats?.[mapName]);
    const f2Matches = f2Players.reduce((acc, p) => acc + (p?.matches || 0), 0);
    const f2Wins = f2Players.reduce((acc, p) => acc + (p?.wins || 0), 0);
    const f2WinRate = f2Matches > 0 ? Math.round((f2Wins / f2Matches) * 100) : 50;
    const f2AvgKd =
      f2Players.filter(Boolean).length > 0
        ? parseFloat(
            (
              f2Players.reduce((acc, p) => acc + (p?.kd || 1.0), 0) /
              f2Players.filter(Boolean).length
            ).toFixed(2)
          )
        : 1.0;

    const winRateDelta = f1WinRate - f2WinRate;

    return {
      mapName,
      f1Matches,
      f1WinRate,
      f1AvgKd,
      f2Matches,
      f2WinRate,
      f2AvgKd,
      winRateDelta,
    };
  });

  return (
    <div className="w-full mb-4 font-sans text-white animate-fade-in">
      <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/10 shadow-card bg-gradient-to-b from-[#18181C]/95 to-[#121214]/95">
        <div className="flex items-center justify-between pb-3 border-b border-white/10 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shadow-sm">
              <Layers className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-wide text-zinc-100 block">
                Map Pool Tactical Advantage Matrix
              </span>
              <span className="text-[11px] text-zinc-400 font-normal">
                Aggregated lifetime map winrates & K/D comparisons across both rosters
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto mt-3.5">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="border-b border-white/10 text-zinc-400 font-semibold text-[11px]">
                <th className="py-2.5 px-3">Map</th>
                <th className="py-2.5 px-3 text-center text-blue-400 font-bold">{f1.name} (WR% / K/D)</th>
                <th className="py-2.5 px-3 text-center text-orange-400 font-bold">{f2.name} (WR% / K/D)</th>
                <th className="py-2.5 px-3 text-center">Advantage Delta</th>
                <th className="py-2.5 px-3 text-right">Tactical Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {mapAnalysis.map((m) => {
                const isSelected = match.selected_map?.replace('de_', '').toLowerCase() === m.mapName;

                return (
                  <tr
                    key={m.mapName}
                    className={`hover:bg-white/[0.03] transition-all ${
                      isSelected ? 'bg-faceit-orange/10 border-l-2 border-faceit-orange' : ''
                    }`}
                  >
                    <td className="py-3 px-3 font-extrabold text-zinc-200 capitalize font-sans flex items-center gap-2">
                      <span>{m.mapName}</span>
                      {isSelected && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-extrabold uppercase bg-faceit-orange text-black flex items-center gap-1 shadow-glow-orange">
                          <Sparkles className="w-2.5 h-2.5" /> Selected
                        </span>
                      )}
                    </td>

                    {/* Faction 1 stats */}
                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-zinc-100">{m.f1WinRate}%</span>
                      <span className="text-zinc-400 text-[10px] ml-1">({m.f1AvgKd})</span>
                      <span className="text-zinc-500 text-[9px] block font-sans">{m.f1Matches} games</span>
                    </td>

                    {/* Faction 2 stats */}
                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-zinc-100">{m.f2WinRate}%</span>
                      <span className="text-zinc-400 text-[10px] ml-1">({m.f2AvgKd})</span>
                      <span className="text-zinc-500 text-[9px] block font-sans">{m.f2Matches} games</span>
                    </td>

                    {/* Advantage Delta */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                          m.winRateDelta >= 10
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : m.winRateDelta <= -10
                            ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                            : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                        }`}
                      >
                        {m.winRateDelta > 0
                          ? `+${m.winRateDelta}% ${f1.name.slice(0, 8)}`
                          : m.winRateDelta < 0
                          ? `+${Math.abs(m.winRateDelta)}% ${f2.name.slice(0, 8)}`
                          : 'Balanced (0%)'}
                      </span>
                    </td>

                    {/* Tactical Recommendation */}
                    <td className="py-3 px-3 text-right font-sans">
                      {m.winRateDelta >= 12 ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                          <ThumbsUp className="w-3.5 h-3.5" /> Pick for {f1.name.slice(0, 8)}
                        </span>
                      ) : m.winRateDelta <= -12 ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-red-400">
                          <ThumbsDown className="w-3.5 h-3.5" /> Ban for {f1.name.slice(0, 8)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
                          <Shield className="w-3.5 h-3.5 text-zinc-500" /> Neutral Map
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
