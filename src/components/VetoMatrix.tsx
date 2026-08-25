import React, { useMemo } from 'react';
import { FaceitMatchDetails, FaceitPlayerFullStats } from '../types/faceit';
import { calculateMapVetoRanking, MapVetoRankItem } from '../services/forecastEngine';
import { DetectedCurrentUser } from '../services/currentUserDetector';
import {
  Layers,
  ThumbsUp,
  ThumbsDown,
  Shield,
  Sparkles,
  Ban,
  Crown,
  UserCheck,
  Star,
} from 'lucide-react';

interface VetoMatrixProps {
  match: FaceitMatchDetails;
  playersStats: Record<string, FaceitPlayerFullStats>;
  currentUser?: DetectedCurrentUser;
  rankedMaps?: MapVetoRankItem[];
}

export const VetoMatrix = React.memo<VetoMatrixProps>(({
  match,
  playersStats = {},
  currentUser,
  rankedMaps: propsRankedMaps,
}) => {
  const f1 = match.teams.faction1;
  const f2 = match.teams.faction2;

  const { f1Players, f2Players } = useMemo(() => {
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

    return {
      f1Players: (f1.roster || []).map(getPlayer).filter((p): p is FaceitPlayerFullStats => Boolean(p)),
      f2Players: (f2.roster || []).map(getPlayer).filter((p): p is FaceitPlayerFullStats => Boolean(p)),
    };
  }, [f1.roster, f2.roster, playersStats]);

  const userFaction = currentUser?.faction;
  const isF2 = userFaction === 'faction2';

  // Calculate 100% accurate Bayesian sample-weighted rankings relative to user's perspective
  const rankedMaps = useMemo(() => {
    if (propsRankedMaps) return propsRankedMaps;
    const availableMaps = (match.voting?.map?.entities || [])
      .map((e) => e.name || (e as any).guid || '')
      .filter(Boolean);
    return calculateMapVetoRanking({
      f1Players,
      f2Players,
      availableMaps,
      userFaction,
    });
  }, [propsRankedMaps, match.voting?.map?.entities, f1Players, f2Players, userFaction]);

  const mapStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const entity of match.voting?.map?.entities || []) {
      const cleanName = (entity.name || '').replace(/^(de_|cs2_|csgo_)/, '').toLowerCase();
      if (cleanName) {
        map.set(cleanName, (entity as any).status || 'remaining');
      }
    }
    return map;
  }, [match.voting?.map?.entities]);

  // Best Pick & Best Ban for Your Team (or Faction 1)
  const { bestPick, bestBan } = useMemo(() => {
    const hasRemainingMaps = rankedMaps.some((m) => mapStatusMap.get(m.mapName) !== 'drop');
    return {
      bestPick: hasRemainingMaps
        ? rankedMaps.find((m) => mapStatusMap.get(m.mapName) !== 'drop')
        : undefined,
      bestBan: hasRemainingMaps
        ? [...rankedMaps].reverse().find((m) => mapStatusMap.get(m.mapName) !== 'drop')
        : undefined,
    };
  }, [rankedMaps, mapStatusMap]);

  // Personal Comfort Map for the Current User
  const userPlayer = currentUser?.playerId ? playersStats[currentUser.playerId] : undefined;

  const personalComfortMap = useMemo(() => {
    if (!userPlayer || !userPlayer.mapStats) return undefined;
    const activeMapStats = Object.values(userPlayer.mapStats).filter((m) => {
      const status = mapStatusMap.get(m.mapName);
      return status !== 'drop';
    });

    if (activeMapStats.length > 0) {
      const sorted = [...activeMapStats].sort(
        (a, b) => (b.wins * 3 + b.winRate + b.kd * 25) - (a.wins * 3 + a.winRate + a.kd * 25)
      );
      if (sorted[0] && sorted[0].matches >= 3) {
        return {
          mapName: sorted[0].mapName,
          winRate: sorted[0].winRate,
          kd: sorted[0].kd,
          matches: sorted[0].matches,
        };
      }
    }
    return undefined;
  }, [userPlayer, mapStatusMap]);

  const selectedMapClean = match.selected_map?.replace(/^(cs2_|csgo_|de_)/, '').toLowerCase();

  const myTeamLabel = userFaction ? 'Your Team' : f1.name;
  const enemyTeamLabel = userFaction ? 'Enemy Team' : f2.name;

  if (Object.keys(playersStats).length < 2) {
    return (
      <div className="w-full mb-4 font-sans text-white">
        <div className="panel-surface p-4 sm:p-5 space-y-4" aria-hidden="true">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 animate-pulse text-purple-400" />
            <span className="text-xs font-mono text-zinc-400">Building Map Veto Intelligence...</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="h-20 skeleton" />
            <div className="h-20 skeleton" />
            <div className="h-20 skeleton" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-28 skeleton" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mb-4 font-sans text-white animate-fade-in selection:bg-faceit-orange selection:text-black">
      <div className="panel-surface p-4 sm:p-5 space-y-4">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 flex-wrap gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shadow-sm">
              <Layers className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-wide text-zinc-100 block">
                  Map Veto & Action Plan
                </span>
                {currentUser?.isDetected && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 font-bold font-mono">
                    <UserCheck className="w-3 h-3 text-cyan-300" />
                    Personalized for {currentUser.nickname || 'You'} ({isF2 ? f2.name : f1.name})
                  </span>
                )}
              </div>
              <span className="text-[11px] text-zinc-400 font-normal block mt-0.5">
                True sample-weighted map proficiency (wins, matches, K/D, ADR) across both 5-man rosters
              </span>
            </div>
          </div>
        </div>

        {/* Action Plan Quick HUD */}
        <div className={`grid grid-cols-1 ${personalComfortMap ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
          {/* Recommended Pick */}
          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
                <ThumbsUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider block">
                  Priority 1: Best Pick ({myTeamLabel})
                </span>
                <span className={`text-sm font-black capitalize font-mono ${bestPick ? 'text-white' : 'text-zinc-500'}`}>
                  {bestPick ? bestPick.mapName : 'No maps remaining'}
                </span>
              </div>
            </div>
            {bestPick && (
              <div className="text-right font-mono">
                <span
                  className={`text-xs font-black block ${
                    bestPick.advantageDelta >= 0 ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {bestPick.advantageDelta >= 0
                    ? `+${bestPick.advantageDelta}% Adv`
                    : `-${Math.abs(bestPick.advantageDelta)}% Disadv`}
                </span>
                <span className="text-[10px] text-zinc-400">
                  {isF2 ? bestPick.f2WinRate : bestPick.f1WinRate}% vs {isF2 ? bestPick.f1WinRate : bestPick.f2WinRate}% WR
                </span>
              </div>
            )}
          </div>

          {/* Recommended Ban */}
          <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/40 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/50 flex items-center justify-center">
                <ThumbsDown className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <span className="text-[10px] text-red-400 font-extrabold uppercase tracking-wider block">
                  Priority 1: Must Ban ({enemyTeamLabel})
                </span>
                <span className={`text-sm font-black capitalize font-mono ${bestBan ? 'text-white' : 'text-zinc-500'}`}>
                  {bestBan ? bestBan.mapName : 'No maps remaining'}
                </span>
              </div>
            </div>
            {bestBan && (
              <div className="text-right font-mono">
                <span
                  className={`text-xs font-black block ${
                    bestBan.advantageDelta >= 0 ? 'text-red-400' : 'text-amber-400'
                  }`}
                >
                  {bestBan.advantageDelta >= 0
                    ? `+${bestBan.advantageDelta}% Adv`
                    : `-${Math.abs(bestBan.advantageDelta)}% Disadv`}
                </span>
                <span className="text-[10px] text-zinc-400">
                  {isF2 ? bestBan.f2WinRate : bestBan.f1WinRate}% vs {isF2 ? bestBan.f1WinRate : bestBan.f2WinRate}% WR
                </span>
              </div>
            )}
          </div>

          {/* Personal Comfort Pick */}
          {personalComfortMap && (
            <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/40 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center">
                  <Star className="w-4 h-4 text-cyan-300 fill-cyan-300" />
                </div>
                <div>
                  <span className="text-[10px] text-cyan-300 font-extrabold uppercase tracking-wider block">
                    Your Personal Comfort Map
                  </span>
                  <span className="text-sm font-black text-white capitalize font-mono">
                    {personalComfortMap.mapName}
                  </span>
                </div>
              </div>
              <div className="text-right font-mono">
                <span className="text-xs font-black text-cyan-300 block">
                  {personalComfortMap.winRate}% WR
                </span>
                <span className="text-[10px] text-zinc-400">
                  {personalComfortMap.kd.toFixed(2)} KD • {personalComfortMap.matches} games
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Tactical Map Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {rankedMaps.map((m: MapVetoRankItem) => {
            const liveStatus = mapStatusMap.get(m.mapName);
            const isBanned = liveStatus === 'drop';
            const isSelected = selectedMapClean === m.mapName || liveStatus === 'pick';

            const userMapStat = userPlayer?.mapStats?.[m.mapName];

            return (
              <div
                key={m.mapName}
                className={`relative flex flex-col p-3 rounded-xl border transition-all duration-200 overflow-hidden ${
                  isBanned
                    ? 'opacity-50 bg-red-950/10 border-red-900/30 grayscale-[50%]'
                    : isSelected
                    ? 'bg-faceit-orange/15 border-faceit-orange shadow-[0_0_15px_rgba(255,85,0,0.15)] scale-[1.02] z-10'
                    : 'bg-faceit-card/80 border-white/5 hover:border-white/20 hover:bg-faceit-card-hover'
                }`}
              >
                {/* Header: Map Name & Rank */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black ${
                        m.rank === 1
                          ? 'bg-emerald-500 text-black shadow-glow-orange'
                          : m.rank === rankedMaps.length
                          ? 'bg-red-500/80 text-white'
                          : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                      }`}
                    >
                      #{m.rank}
                    </span>
                    <span className={`font-extrabold text-zinc-100 capitalize font-sans ${isBanned ? 'line-through text-zinc-500' : ''}`}>
                      {m.mapName}
                    </span>
                  </div>
                  {/* Status Badges */}
                  {isSelected && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase bg-faceit-orange text-black flex items-center gap-1 shadow-glow-orange">
                      <Sparkles className="w-2.5 h-2.5" /> Pick
                    </span>
                  )}
                  {isBanned && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1">
                      <Ban className="w-2.5 h-2.5" /> Ban
                    </span>
                  )}
                </div>

                {/* Team Stats Comparison */}
                <div className="grid grid-cols-2 gap-2 mb-2 text-center font-mono">
                  <div className={`rounded-lg p-2 border ${userFaction === 'faction1' ? 'bg-cyan-950/20 border-cyan-500/30' : 'bg-black/40 border-white/5'}`}>
                    <div className="text-[9px] text-blue-400 font-bold mb-0.5 truncate">
                      {f1.name} {userFaction === 'faction1' ? '(YOU)' : ''}
                    </div>
                    <div className="font-bold text-zinc-100 text-xs">{m.f1WinRate}%</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">{m.f1AvgKd} KD • {m.f1Matches}m</div>
                  </div>
                  <div className={`rounded-lg p-2 border ${userFaction === 'faction2' ? 'bg-cyan-950/20 border-cyan-500/30' : 'bg-black/40 border-white/5'}`}>
                    <div className="text-[9px] text-orange-400 font-bold mb-0.5 truncate">
                      {f2.name} {userFaction === 'faction2' ? '(YOU)' : ''}
                    </div>
                    <div className="font-bold text-zinc-100 text-xs">{m.f2WinRate}%</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">{m.f2AvgKd} KD • {m.f2Matches}m</div>
                  </div>
                </div>

                {/* Personal stat chip on this map */}
                {userMapStat && (
                  <div className="mb-2 px-2 py-1 rounded bg-black/40 border border-cyan-500/20 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-cyan-300 font-bold">Your Stats:</span>
                    <span className="text-zinc-300">
                      {userMapStat.winRate}% WR • {userMapStat.kd.toFixed(2)} KD ({userMapStat.matches}g)
                    </span>
                  </div>
                )}

                {/* Advantage & Recommendation */}
                <div className="mt-auto flex items-center justify-between pt-2 border-t border-white/5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                      m.advantageDelta >= 10
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : m.advantageDelta <= -10
                        ? 'bg-red-500/20 text-red-300 border-red-500/30'
                        : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                    }`}
                  >
                    {m.advantageDelta > 0
                      ? `+${m.advantageDelta}% ${userFaction ? 'Your Adv' : 'Blue'}`
                      : m.advantageDelta < 0
                      ? `+${Math.abs(m.advantageDelta)}% ${userFaction ? 'Enemy Adv' : 'Orange'}`
                      : 'Balanced'}
                  </span>
                  
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${m.badgeColor}`}>
                    {m.recommendation === 'MUST_PICK' && <Crown className="w-2.5 h-2.5 text-emerald-400" />}
                    {m.recommendation === 'SAFE_PICK' && <ThumbsUp className="w-2.5 h-2.5 text-blue-400" />}
                    {m.recommendation === 'BALANCED' && <Shield className="w-2.5 h-2.5 text-zinc-400" />}
                    {m.recommendation === 'RISK_BAN' && <ThumbsDown className="w-2.5 h-2.5 text-amber-400" />}
                    {m.recommendation === 'PERMABAN' && <Ban className="w-2.5 h-2.5 text-red-400" />}
                    <span>{m.recommendation.replace('_', ' ')}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
VetoMatrix.displayName = "VetoMatrix";