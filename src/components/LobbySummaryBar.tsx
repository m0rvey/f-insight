import React from 'react';
import { LobbyAnalysisPayload } from '../types/messages';
import { ExtensionSettings } from '../types/settings';
import { ServerConnectBar } from './lobby/ServerConnectBar';
import { ProbabilityBar } from './lobby/ProbabilityBar';
import { TeamCard } from './lobby/TeamCard';
import { calculateMapVetoRanking } from '../services/forecastEngine';
import { FaceitPlayerFullStats } from '../types/faceit';
import {
  ShieldAlert,
  Users,
  TrendingUp,
  RefreshCw,
  Eye,
  EyeOff,
  Layers,
  Globe,
  Calendar,
  Sparkles,
} from 'lucide-react';

import { DetectedCurrentUser } from '../services/currentUserDetector';

interface LobbySummaryBarProps {
  payload: LobbyAnalysisPayload;
  onRefresh: () => void;
  isLoading: boolean;
  isVisible: boolean;
  onToggleVisibility: () => void;
  showVetoMatrix?: boolean;
  onToggleVetoMatrix?: () => void;
  currentUser?: DetectedCurrentUser;
  settings?: ExtensionSettings;
}

export const LobbySummaryBar: React.FC<LobbySummaryBarProps> = ({
  payload,
  onRefresh,
  isLoading,
  isVisible,
  onToggleVisibility,
  showVetoMatrix,
  onToggleVetoMatrix,
  currentUser,
  settings,
}) => {
  const { match, teamSummary, riskAnalysis, premadeGroups, playersStats } = payload;
  const f1 = match.teams.faction1;
  const f2 = match.teams.faction2;
  const compact = settings?.compactMode === true;
  const vetoEnabled = settings?.enableVetoHelper !== false;

  // Use the forecastEngine map ranker for Top Map
  const getPlayer = (r: { player_id?: string; nickname?: string }) => {
    const id = r.player_id || '';
    if (id && playersStats?.[id]) return playersStats[id];
    if (r.nickname) {
      const found = Object.values(playersStats || {}).find(
        (p) => p.nickname?.toLowerCase() === r.nickname?.toLowerCase()
      );
      if (found) return found;
    }
    return undefined;
  };

  const f1Players = (f1.roster || []).map(getPlayer).filter((p): p is FaceitPlayerFullStats => Boolean(p));
  const f2Players = (f2.roster || []).map(getPlayer).filter((p): p is FaceitPlayerFullStats => Boolean(p));
  
  const votingEntities = match.voting?.map?.entities || [];
  const availableMaps = votingEntities.map((e) => e.name || (e as any).guid || '').filter(Boolean);
  const rankedMaps = vetoEnabled ? calculateMapVetoRanking({
    f1Players,
    f2Players,
    availableMaps,
    userFaction: currentUser?.faction,
  }) : [];
  
  // Best maps for each team
  const f1TopMap = [...rankedMaps].sort((a, b) => b.advantageDelta - a.advantageDelta)[0];
  const f2TopMap = [...rankedMaps].sort((a, b) => a.advantageDelta - b.advantageDelta)[0];

  const f1TopMapSummary = f1TopMap ? { name: f1TopMap.mapName, wr: f1TopMap.f1WinRate } : null;
  const f2TopMapSummary = f2TopMap ? { name: f2TopMap.mapName, wr: f2TopMap.f2WinRate } : null;

  const selectedMapClean = match.selected_map?.replace(/^cs2_/, '').replace(/^csgo_/, '').replace(/^de_/, '').toLowerCase();
  const selectedMapRankItem = selectedMapClean ? rankedMaps.find((m) => m.mapName === selectedMapClean) : undefined;

  // Compute High Risk Count
  const allRiskResults = Object.values(riskAnalysis || {});
  const highRiskCount = settings?.enableRedFlags === false
    ? 0
    : allRiskResults.filter((r) => r.level === 'HIGH' || r.level === 'CRITICAL').length;
  const visiblePremadeGroups = settings?.enablePremadeDetection === false ? [] : (premadeGroups || []);

  const rawServerIp = match.server_ip;
  const serverIp = rawServerIp && /^[a-zA-Z0-9.\-:]+$/.test(rawServerIp) ? rawServerIp : undefined;

  // Format Status into authentic readable text
  const getStatusDisplay = () => {
    switch (match.status) {
      case 'FINISHED':
        return { label: 'Match Finished', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      case 'ON_GOING':
        return { label: 'Live Match', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
      case 'VOTING':
        return { label: 'Map Veto Phase', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
      case 'CONFIGURING':
        return { label: 'Server Configuring', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
      case 'READY':
        return { label: 'Server Ready', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      default:
        return { label: match.status, color: 'bg-zinc-800 text-zinc-300 border-zinc-700' };
    }
  };

  const statusInfo = getStatusDisplay();

  const getRegionName = (reg?: string) => {
    if (!reg) return 'Europe';
    const r = reg.toUpperCase();
    if (r === 'EU') return 'Europe';
    if (r === 'US' || r === 'NA') return 'North America';
    if (r === 'SA') return 'South America';
    if (r === 'SEA' || r === 'AS') return 'Southeast Asia';
    if (r === 'OCE') return 'Oceania';
    return reg;
  };

  const win1 = teamSummary?.faction1?.winChancePercent || 50;
  const win2 = teamSummary?.faction2?.winChancePercent || 50;

  return (
    <div className="w-full mb-4 font-sans antialiased text-white selection:bg-faceit-orange selection:text-black">
      <div className={`glass-panel rounded-2xl shadow-card border border-white/10 relative overflow-hidden bg-gradient-to-b from-[#18181C]/90 to-[#121214]/95 ${compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5'}`}>
        {/* Glowing top line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-faceit-orange to-amber-400 opacity-90" />

        {/* Header row */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/10 flex-wrap gap-2.5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-faceit-orange/30 to-faceit-orange/10 border border-faceit-orange/50 flex items-center justify-center shadow-glow-orange flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-faceit-orange" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm tracking-wide text-white drop-shadow-sm">F-Insight Extension</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-faceit-orange/20 text-faceit-orange border border-faceit-orange/40">
                  CS2 5v5
                </span>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
                {match.selected_map && (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {match.selected_map.replace('de_', '')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5 mt-1 text-[11px] text-zinc-400 flex-wrap">
                <span className="flex items-center gap-1">
                  <Globe className="w-3 h-3 text-zinc-400" />
                  {getRegionName(match.region)} ({match.region || 'EU'})
                </span>
                {match.configured_at && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-zinc-400" />
                      {new Date(match.configured_at > 1e12 ? match.configured_at : match.configured_at * 1000).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {highRiskCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-semibold animate-pulse shadow-sm">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                <span>{highRiskCount} Smurf Flagged</span>
              </div>
            )}

            {visiblePremadeGroups.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-200 text-xs font-medium shadow-sm">
                <Users className="w-3.5 h-3.5 text-purple-400" />
                <span>{visiblePremadeGroups.length} Party</span>
              </div>
            )}

            {onToggleVetoMatrix && vetoEnabled && (
              <button
                onClick={onToggleVetoMatrix}
                title="Toggle Veto & Map Pool Matrix"
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition shadow-sm ${
                  showVetoMatrix
                    ? 'bg-purple-500/30 text-purple-200 border-purple-500/50 shadow-glow-orange'
                    : 'bg-zinc-800/80 hover:bg-zinc-700 border-white/10 text-zinc-300 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span>Maps Matrix</span>
              </button>
            )}

            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Force Refresh Lobby Stats"
              className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 border border-white/10 text-zinc-300 hover:text-white transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-faceit-orange' : ''}`} />
            </button>

            <button
              onClick={onToggleVisibility}
              title={isVisible ? 'Collapse Overlay' : 'Expand Overlay'}
              className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 border border-white/10 text-zinc-300 hover:text-white transition"
            >
              {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {serverIp && <ServerConnectBar serverIp={serverIp} />}

        {isVisible && (
          <div className={`${compact ? 'mt-3 space-y-2.5' : 'mt-4 space-y-3.5'}`}>
            {!teamSummary ? (
              <div className="w-full h-32 flex items-center justify-center border border-white/5 bg-black/20 rounded-xl animate-pulse text-zinc-500 font-mono text-xs shadow-inner">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-faceit-orange" />
                  Calculating Match Prediction & Risk Factors...
                </span>
              </div>
            ) : (
              <>
                <ProbabilityBar 
                  win1={win1} 
                  win2={win2} 
                  team1Name={f1.name} 
                  team2Name={f2.name} 
                  prediction={payload.prediction} 
                />

                {payload.prediction?.keyAdvantageText && (
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs text-zinc-300 shadow-sm flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-faceit-orange flex-shrink-0" />
                      <span className="text-[11px] text-zinc-300 font-medium">
                        {payload.prediction.keyAdvantageText}
                      </span>
                    </div>
                    {payload.prediction.starMatchup && (
                      <div className="text-[10px] font-mono text-zinc-400">
                        <span className="text-blue-300 font-bold">{payload.prediction.starMatchup.f1Star.nickname}</span>
                        <span className="mx-1 text-zinc-600">vs</span>
                        <span className="text-orange-300 font-bold">{payload.prediction.starMatchup.f2Star.nickname}</span>
                      </div>
                    )}
                  </div>
                )}

                {selectedMapRankItem && (
                  <div className="p-3 rounded-xl bg-gradient-to-r from-blue-950/20 via-[#18181E] to-orange-950/20 border border-white/10 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-zinc-100 uppercase tracking-wide">
                            {selectedMapRankItem.mapName} Matchup
                          </span>
                          <span className="text-[10px] px-2 py-0.2 rounded-full font-mono font-bold bg-white/10 border border-white/10 text-zinc-300">
                            Map Impact
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          {selectedMapRankItem.advantageDelta > 0 ? (
                            <span className="text-blue-300 font-semibold">
                              +{selectedMapRankItem.advantageDelta}% Map Edge for {f1.name}
                            </span>
                          ) : selectedMapRankItem.advantageDelta < 0 ? (
                            <span className="text-orange-300 font-semibold">
                              +{Math.abs(selectedMapRankItem.advantageDelta)}% Map Edge for {f2.name}
                            </span>
                          ) : (
                            <span className="text-zinc-300 font-semibold">
                              Even Map Matchup (Balanced)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 font-mono text-[11px] self-end sm:self-auto">
                      <div className="text-right">
                        <div className="text-blue-400 font-bold">{selectedMapRankItem.f1WinRate}% WR</div>
                        <div className="text-[10px] text-zinc-500">{selectedMapRankItem.f1AvgKd} KD • {selectedMapRankItem.f1Matches}m</div>
                      </div>
                      <span className="text-zinc-600 font-sans">vs</span>
                      <div className="text-left">
                        <div className="text-orange-400 font-bold">{selectedMapRankItem.f2WinRate}% WR</div>
                        <div className="text-[10px] text-zinc-500">{selectedMapRankItem.f2AvgKd} KD • {selectedMapRankItem.f2Matches}m</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-11 gap-3.5 items-center">
                  <TeamCard
                    factionId={1}
                    teamName={f1.name}
                    winChance={win1}
                    projectedWin={teamSummary.faction1.projectedElo?.winGain || 25}
                    projectedLoss={teamSummary.faction1.projectedElo?.lossLoss || 25}
                    avgElo={teamSummary.faction1.avgElo}
                    avgKd={teamSummary.faction1.avgKd}
                    avgAdr={teamSummary.faction1.avgAdr}
                    avgHsPercent={teamSummary.faction1.avgHsPercent}
                    topMap={f1TopMapSummary}
                    isUserTeam={currentUser?.faction === 'faction1'}
                  />

                  <div className="md:col-span-1 flex flex-col items-center justify-center text-center">
                    <div className="text-xs font-black text-zinc-500 uppercase tracking-widest px-2 py-0.5 rounded bg-black/60 border border-white/5">
                      VS
                    </div>
                    <div className="text-[10px] font-mono font-bold text-zinc-400 mt-1.5">
                      Δ {teamSummary.eloDifference}
                    </div>
                  </div>

                  <TeamCard
                    factionId={2}
                    teamName={f2.name}
                    winChance={win2}
                    projectedWin={teamSummary.faction2.projectedElo?.winGain || 25}
                    projectedLoss={teamSummary.faction2.projectedElo?.lossLoss || 25}
                    avgElo={teamSummary.faction2.avgElo}
                    avgKd={teamSummary.faction2.avgKd}
                    avgAdr={teamSummary.faction2.avgAdr}
                    avgHsPercent={teamSummary.faction2.avgHsPercent}
                    topMap={f2TopMapSummary}
                    isUserTeam={currentUser?.faction === 'faction2'}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

