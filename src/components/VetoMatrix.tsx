import React from 'react';
import { FaceitMatchDetails, FaceitPlayerFullStats } from '../types/faceit';
import { calculateMapVetoRanking, MapVetoRankItem } from '../services/forecastEngine';
import {
  Layers,
  ThumbsUp,
  ThumbsDown,
  Shield,
  Sparkles,
  Ban,
  Crown,
} from 'lucide-react';

interface VetoMatrixProps {
  match: FaceitMatchDetails;
  playersStats: Record<string, FaceitPlayerFullStats>;
}

export const VetoMatrix: React.FC<VetoMatrixProps> = ({ match, playersStats }) => {
  const f1 = match.teams.faction1;
  const f2 = match.teams.faction2;

  const getPlayer = (r: { player_id?: string; id?: string; nickname?: string }) => {
    const id = r.player_id || r.id || '';
    if (id && playersStats[id]) return playersStats[id];
    if (r.nickname) {
      const found = Object.values(playersStats).find(
        (p) => p.nickname?.toLowerCase() === r.nickname?.toLowerCase()
      );
      if (found) return found;
    }
    return undefined;
  };

  const f1Players = (f1.roster || []).map(getPlayer).filter((p): p is FaceitPlayerFullStats => Boolean(p));
  const f2Players = (f2.roster || []).map(getPlayer).filter((p): p is FaceitPlayerFullStats => Boolean(p));

  // Calculate 100% accurate Bayesian sample-weighted rankings
  const rankedMaps = calculateMapVetoRanking({ f1Players, f2Players });

  // Map voting entities for live veto status
  const votingEntities = match.voting?.map?.entities || [];
  const mapStatusMap = new Map<string, string>();
  for (const entity of votingEntities) {
    const cleanName = (entity.name || '').replace('de_', '').toLowerCase();
    if (cleanName) {
      mapStatusMap.set(cleanName, (entity as any).status || 'remaining');
    }
  }

  // Best Pick & Best Ban for Team 1
  const bestPick = rankedMaps.find((m) => {
    const status = mapStatusMap.get(m.mapName);
    return status !== 'drop';
  }) || rankedMaps[0];

  const bestBan = [...rankedMaps].reverse().find((m) => {
    const status = mapStatusMap.get(m.mapName);
    return status !== 'drop';
  }) || rankedMaps[rankedMaps.length - 1];

  const selectedMapClean = match.selected_map?.replace('de_', '').toLowerCase();

  return (
    <div className="w-full mb-4 font-sans text-white animate-fade-in selection:bg-faceit-orange selection:text-black">
      <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/10 shadow-card bg-gradient-to-b from-[#18181C]/95 to-[#121214]/95 space-y-4">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 flex-wrap gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shadow-sm">
              <Layers className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-wide text-zinc-100 block">
                Map Veto & Action Plan
              </span>
              <span className="text-[11px] text-zinc-400 font-normal">
                True sample-weighted map proficiency (wins, matches, K/D, ADR) across both 5-man rosters
              </span>
            </div>
          </div>
        </div>

        {/* Captain Action Plan Quick HUD */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Recommended Pick */}
          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div>
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                  Priority 1: Best Pick for {f1.name.slice(0, 10)}
                </span>
                <span className="text-sm font-extrabold text-white capitalize font-mono">
                  {bestPick.mapName}
                </span>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-xs font-black text-emerald-400 block">
                +{bestPick.advantageDelta}%
              </span>
              <span className="text-[10px] text-zinc-400">
                {bestPick.f1WinRate}% vs {bestPick.f2WinRate}% WR
              </span>
            </div>
          </div>

          {/* Recommended Ban */}
          <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                <ThumbsDown className="w-3.5 h-3.5 text-red-400" />
              </div>
              <div>
                <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider block">
                  Priority 1: Must Ban for {f1.name.slice(0, 10)}
                </span>
                <span className="text-sm font-extrabold text-white capitalize font-mono">
                  {bestBan.mapName}
                </span>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-xs font-black text-red-400 block">
                {bestBan.advantageDelta}%
              </span>
              <span className="text-[10px] text-zinc-400">
                {bestBan.f1WinRate}% vs {bestBan.f2WinRate}% WR
              </span>
            </div>
          </div>
        </div>

        {/* 7-Map Detailed Tactical Matrix */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="border-b border-white/10 text-zinc-400 font-semibold text-[11px]">
                <th className="py-2.5 px-3">Priority</th>
                <th className="py-2.5 px-3">Map</th>
                <th className="py-2.5 px-3 text-center text-blue-400 font-bold">{f1.name} (WR% / K/D / ADR)</th>
                <th className="py-2.5 px-3 text-center text-orange-400 font-bold">{f2.name} (WR% / K/D / ADR)</th>
                <th className="py-2.5 px-3 text-center">Advantage Index</th>
                <th className="py-2.5 px-3 text-right">Tactical Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {rankedMaps.map((m: MapVetoRankItem) => {
                const liveStatus = mapStatusMap.get(m.mapName);
                const isBanned = liveStatus === 'drop';
                const isSelected = selectedMapClean === m.mapName || liveStatus === 'pick';

                return (
                  <tr
                    key={m.mapName}
                    className={`transition-all ${
                      isBanned
                        ? 'opacity-40 line-through bg-red-950/10'
                        : isSelected
                        ? 'bg-faceit-orange/15 border-l-2 border-faceit-orange shadow-inner'
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    {/* Rank */}
                    <td className="py-3 px-3">
                      <span
                        className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-black ${
                          m.rank === 1
                            ? 'bg-emerald-500 text-black shadow-glow-orange'
                            : m.rank === 7
                            ? 'bg-red-500/80 text-white'
                            : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                        }`}
                      >
                        #{m.rank}
                      </span>
                    </td>

                    {/* Map Name & Live Badges */}
                    <td className="py-3 px-3 font-extrabold text-zinc-200 capitalize font-sans">
                      <div className="flex items-center gap-2">
                        <span className={isBanned ? 'line-through text-zinc-500' : ''}>{m.mapName}</span>
                        {isSelected && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full font-extrabold uppercase bg-faceit-orange text-black flex items-center gap-1 shadow-glow-orange no-underline">
                            <Sparkles className="w-2.5 h-2.5" /> Selected
                          </span>
                        )}
                        {isBanned && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/40 no-underline flex items-center gap-1">
                            <Ban className="w-2.5 h-2.5" /> Banned
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Faction 1 Stats */}
                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-zinc-100">{m.f1WinRate}%</span>
                      <span className="text-zinc-400 text-[10px] ml-1">({m.f1AvgKd})</span>
                      <span className="text-zinc-500 text-[9px] block font-sans">
                        {m.f1Matches} matches • {m.f1AvgAdr} ADR
                      </span>
                    </td>

                    {/* Faction 2 Stats */}
                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-zinc-100">{m.f2WinRate}%</span>
                      <span className="text-zinc-400 text-[10px] ml-1">({m.f2AvgKd})</span>
                      <span className="text-zinc-500 text-[9px] block font-sans">
                        {m.f2Matches} matches • {m.f2AvgAdr} ADR
                      </span>
                    </td>

                    {/* Advantage Index */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                          m.advantageDelta >= 10
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                            : m.advantageDelta <= -10
                            ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                        }`}
                      >
                        {m.advantageDelta > 0
                          ? `+${m.advantageDelta}% ${f1.name.slice(0, 8)}`
                          : m.advantageDelta < 0
                          ? `+${Math.abs(m.advantageDelta)}% ${f2.name.slice(0, 8)}`
                          : 'Balanced (0%)'}
                      </span>
                    </td>

                    {/* Tactical Recommendation */}
                    <td className="py-3 px-3 text-right font-sans">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${m.badgeColor}`}>
                        {m.recommendation === 'MUST_PICK' && <Crown className="w-3 h-3 text-emerald-400" />}
                        {m.recommendation === 'SAFE_PICK' && <ThumbsUp className="w-3 h-3 text-blue-400" />}
                        {m.recommendation === 'BALANCED' && <Shield className="w-3 h-3 text-zinc-400" />}
                        {m.recommendation === 'RISK_BAN' && <ThumbsDown className="w-3 h-3 text-amber-400" />}
                        {m.recommendation === 'PERMABAN' && <Ban className="w-3 h-3 text-red-400" />}
                        <span>{m.recommendation.replace('_', ' ')}</span>
                      </span>
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
