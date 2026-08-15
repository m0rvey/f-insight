import React, { useState } from 'react';
import { LobbyAnalysisPayload } from '../types/messages';
import {
  ShieldAlert,
  Users,
  TrendingUp,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Check,
  Play,
  Layers,
  Globe,
  Calendar,
  Sparkles,
  MapPin,
  Target,
} from 'lucide-react';

interface LobbySummaryBarProps {
  payload: LobbyAnalysisPayload;
  onRefresh: () => void;
  isLoading: boolean;
  isVisible: boolean;
  onToggleVisibility: () => void;
  showVetoMatrix?: boolean;
  onToggleVetoMatrix?: () => void;
}

export const LobbySummaryBar: React.FC<LobbySummaryBarProps> = ({
  payload,
  onRefresh,
  isLoading,
  isVisible,
  onToggleVisibility,
  showVetoMatrix,
  onToggleVetoMatrix,
}) => {
  const { match, teamSummary, riskAnalysis, premadeGroups } = payload;
  const f1 = match.teams.faction1;
  const f2 = match.teams.faction2;

  const [copiedIp, setCopiedIp] = useState(false);

  // Count high risk players
  const highRiskCount = Object.values(riskAnalysis).filter(
    (r) => r.level === 'HIGH' || r.level === 'CRITICAL'
  ).length;

  const rawServerIp = match.server_ip;
  const serverIp = rawServerIp && /^[a-zA-Z0-9.\-:]+$/.test(rawServerIp) ? rawServerIp : undefined;

  const handleCopyIp = () => {
    if (!serverIp) return;
    navigator.clipboard.writeText(`connect ${serverIp}`);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

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
      case 'READY':
        return { label: 'Server Ready', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
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

  const win1 = teamSummary.faction1.winChancePercent;
  const win2 = teamSummary.faction2.winChancePercent;

  return (
    <div className="w-full mb-4 font-sans antialiased text-white selection:bg-faceit-orange selection:text-black">
      <div className="glass-panel rounded-2xl p-4 sm:p-5 shadow-card border border-white/10 relative overflow-hidden bg-gradient-to-b from-[#18181C]/90 to-[#121214]/95">
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
                <span className="font-extrabold text-sm tracking-wide text-white drop-shadow-sm">f-insight Intelligence</span>
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
                {match.server_location && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-zinc-300 font-medium">
                      <MapPin className="w-3 h-3 text-faceit-orange" />
                      Server: {match.server_location}
                    </span>
                  </>
                )}
                {match.configured_at && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-zinc-400" />
                      {new Date(match.configured_at * 1000).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
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

            {premadeGroups.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-200 text-xs font-medium shadow-sm">
                <Users className="w-3.5 h-3.5 text-purple-400" />
                <span>{premadeGroups.length} Party</span>
              </div>
            )}

            {onToggleVetoMatrix && (
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

        {/* Server Connect Bar when configured */}
        {serverIp && (
          <div className="mt-3.5 p-3 rounded-xl bg-gradient-to-r from-zinc-900 via-black to-zinc-900 border border-faceit-orange/40 flex items-center justify-between flex-wrap gap-2 shadow-inner">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-glow-orange" />
              <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Server Ready:</span>
              <code className="text-xs font-mono px-2.5 py-1 rounded bg-black/80 border border-zinc-700/80 text-faceit-orange font-bold">
                connect {serverIp}
              </code>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyIp}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-faceit-orange hover:bg-faceit-orange-hover text-black font-extrabold text-xs transition shadow-glow-orange active:scale-95"
              >
                {copiedIp ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedIp ? 'Copied to Clipboard!' : 'Copy Connect'}</span>
              </button>

              <a
                href={`steam://connect/${serverIp}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-200 text-xs font-bold transition active:scale-95"
              >
                <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                <span>Launch CS2</span>
              </a>
            </div>
          </div>
        )}

        {/* Content row: Team 1 vs Team 2 Comparison with Projected Elo & Tug-of-War Probability Bar */}
        {isVisible && (
          <div className="mt-4 space-y-3.5">
            {/* Probability & Predicted Score Line */}
            <div className="flex items-center justify-between text-xs font-mono font-bold text-zinc-300 px-1">
              <span className="text-blue-400 font-black">{win1}% {f1.name.slice(0, 10)}</span>
              {payload.prediction && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/90 border border-white/10 text-zinc-200 text-[11px] shadow-sm">
                  <Target className="w-3.5 h-3.5 text-faceit-orange" />
                  <span>Predicted MR12:</span>
                  <span className="text-white font-extrabold font-mono">
                    {payload.prediction.predictedScore.f1Score} : {payload.prediction.predictedScore.f2Score}
                  </span>
                  {payload.prediction.predictedScore.isOvertimeLikely && (
                    <span className="text-[10px] text-amber-400 font-sans font-bold">(OT Likely)</span>
                  )}
                </div>
              )}
              <span className="text-orange-400 font-black">{win2}% {f2.name.slice(0, 10)}</span>
            </div>

            {/* Visual Tug-of-War Probability Bar */}
            <div className="w-full bg-zinc-950 rounded-full h-2.5 p-0.5 border border-white/10 flex overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-l-full transition-all duration-500 relative group"
                style={{ width: `${Math.max(10, Math.min(90, win1))}%` }}
                title={`${f1.name}: ${win1}% win probability`}
              />
              <div
                className="h-full bg-gradient-to-r from-orange-400 to-faceit-orange rounded-r-full transition-all duration-500 relative group"
                style={{ width: `${Math.max(10, Math.min(90, win2))}%` }}
                title={`${f2.name}: ${win2}% win probability`}
              />
            </div>

            {/* Tactical Key Factor Summary */}
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

            <div className="grid grid-cols-1 md:grid-cols-11 gap-3.5 items-center">
              {/* Team 1 Card */}
              <div className="md:col-span-5 bg-[#17171B]/90 hover:bg-[#1B1B20]/95 rounded-xl p-4 border border-white/10 hover:border-blue-500/40 transition-all duration-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3.5 h-3.5 rounded-full bg-blue-500 ring-2 ring-blue-500/30" />
                    <span className="font-extrabold text-sm text-zinc-100 truncate max-w-[150px]">{f1.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-mono font-extrabold">
                      +{teamSummary.faction1.projectedElo?.winGain || 25} / -{teamSummary.faction1.projectedElo?.lossLoss || 25} ELO
                    </span>
                    <span className="text-xs font-black text-blue-400 font-mono">
                      {win1}% Win
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center font-mono">
                  <div className="bg-black/40 rounded-lg p-2 border border-white/5 hover:border-white/10 transition">
                    <div className="text-[9px] text-zinc-400 uppercase font-sans font-bold">Avg Elo</div>
                    <div className="text-sm font-bold text-zinc-100 mt-0.5">{teamSummary.faction1.avgElo}</div>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2 border border-white/5 hover:border-white/10 transition">
                    <div className="text-[9px] text-zinc-400 uppercase font-sans font-bold">Avg K/D</div>
                    <div className="text-sm font-bold text-zinc-100 mt-0.5">{teamSummary.faction1.avgKd}</div>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2 border border-white/5 hover:border-white/10 transition">
                    <div className="text-[9px] text-zinc-400 uppercase font-sans font-bold">Avg ADR</div>
                    <div className="text-sm font-bold text-zinc-100 mt-0.5">{teamSummary.faction1.avgAdr}</div>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2 border border-white/5 hover:border-white/10 transition">
                    <div className="text-[9px] text-zinc-400 uppercase font-sans font-bold">Avg HS%</div>
                    <div className="text-sm font-bold text-zinc-100 mt-0.5">{teamSummary.faction1.avgHsPercent}%</div>
                  </div>
                </div>
              </div>

              {/* VS Divider & Delta */}
              <div className="md:col-span-1 flex flex-col items-center justify-center text-center">
                <div className="text-xs font-black text-zinc-500 uppercase tracking-widest px-2 py-0.5 rounded bg-black/60 border border-white/5">
                  VS
                </div>
                <div className="text-[10px] font-mono font-bold text-zinc-400 mt-1.5">
                  Δ {teamSummary.eloDifference}
                </div>
              </div>

              {/* Team 2 Card */}
              <div className="md:col-span-5 bg-[#17171B]/90 hover:bg-[#1B1B20]/95 rounded-xl p-4 border border-white/10 hover:border-faceit-orange/40 transition-all duration-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-orange-400 font-mono">
                      {win2}% Win
                    </span>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300 font-mono font-extrabold">
                      +{teamSummary.faction2.projectedElo?.winGain || 25} / -{teamSummary.faction2.projectedElo?.lossLoss || 25} ELO
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-extrabold text-sm text-zinc-100 truncate max-w-[150px]">{f2.name}</span>
                    <div className="w-3.5 h-3.5 rounded-full bg-faceit-orange ring-2 ring-faceit-orange/30" />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center font-mono">
                  <div className="bg-black/40 rounded-lg p-2 border border-white/5 hover:border-white/10 transition">
                    <div className="text-[9px] text-zinc-400 uppercase font-sans font-bold">Avg Elo</div>
                    <div className="text-sm font-bold text-zinc-100 mt-0.5">{teamSummary.faction2.avgElo}</div>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2 border border-white/5 hover:border-white/10 transition">
                    <div className="text-[9px] text-zinc-400 uppercase font-sans font-bold">Avg K/D</div>
                    <div className="text-sm font-bold text-zinc-100 mt-0.5">{teamSummary.faction2.avgKd}</div>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2 border border-white/5 hover:border-white/10 transition">
                    <div className="text-[9px] text-zinc-400 uppercase font-sans font-bold">Avg ADR</div>
                    <div className="text-sm font-bold text-zinc-100 mt-0.5">{teamSummary.faction2.avgAdr}</div>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2 border border-white/5 hover:border-white/10 transition">
                    <div className="text-[9px] text-zinc-400 uppercase font-sans font-bold">Avg HS%</div>
                    <div className="text-sm font-bold text-zinc-100 mt-0.5">{teamSummary.faction2.avgHsPercent}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
