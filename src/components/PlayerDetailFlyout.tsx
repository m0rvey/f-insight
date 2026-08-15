import React, { useState, useEffect } from 'react';
import { FaceitPlayerFullStats } from '../types/faceit';
import { SteamFullData } from '../types/steam';
import { RiskAnalysisResult } from '../types/risk';
import { PlayerOverviewTab } from './player/PlayerOverviewTab';
import { PlayerMapsTab } from './player/PlayerMapsTab';
import { PlayerHistoryTab } from './player/PlayerHistoryTab';
import { PlayerRiskTab } from './player/PlayerRiskTab';
import {
  X,
  ShieldAlert,
  Flame,
  Snowflake,
  ExternalLink,
  MapPin,
  History,
  TrendingUp,
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
          {activeTab === 'overview' && <PlayerOverviewTab stats={stats} steam={steam} risk={risk} />}
          {activeTab === 'maps' && <PlayerMapsTab stats={stats} />}
          {activeTab === 'history' && <PlayerHistoryTab stats={stats} />}
          {activeTab === 'risk' && <PlayerRiskTab risk={risk} />}
        </div>
      </div>
    </div>
  );
};
