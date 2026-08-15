import React from 'react';
import { calculateLevelProgress } from '../../services/eloLevels';
import { TrendingUp, Shield, ChevronRight } from 'lucide-react';

interface LevelProgressBarProps {
  elo: number;
}

export const LevelProgressBar = React.memo<LevelProgressBarProps>(({ elo }) => {
  const progress = calculateLevelProgress(elo);

  return (
    <div className="p-3.5 rounded-xl bg-gradient-to-r from-faceit-card via-[#16161A] to-faceit-card border border-faceit-border/80 shadow-sm font-sans">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-faceit-orange/20 border border-faceit-orange/40 flex items-center justify-center font-black text-xs font-mono text-faceit-orange shadow-glow-orange">
            {progress.currentLevel}
          </div>
          <div>
            <span className="text-xs font-bold text-zinc-100 flex items-center gap-1">
              Level {progress.currentLevel}
              <ChevronRight className="w-3 h-3 text-zinc-500" />
              <strong className="text-faceit-orange font-mono">{progress.currentElo}</strong> Elo
            </span>
          </div>
        </div>

        <div className="text-right text-xs font-mono">
          {progress.pointsToNext !== null ? (
            <span className="text-emerald-400 font-bold">
              +{progress.pointsToNext} ELO to Lvl {progress.nextLevel}
            </span>
          ) : (
            <span className="text-faceit-orange font-bold flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Max Level 10
            </span>
          )}
        </div>
      </div>

      {/* Track & Bar */}
      <div className="relative w-full h-2 rounded-full bg-black/60 border border-white/5 overflow-hidden p-0.5 shadow-inner">
        <div
          className="h-full rounded-full bg-gradient-to-r from-faceit-orange via-amber-400 to-emerald-400 transition-all duration-500 shadow-glow-orange"
          style={{ width: `${Math.max(4, progress.progressPercent)}%` }}
        />
      </div>

      {/* Footer Boundaries */}
      <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono text-zinc-500">
        <span>{progress.minElo} Elo</span>
        {progress.pointsToDemotion !== null && progress.pointsToDemotion > 0 && progress.pointsToDemotion <= 50 && (
          <span className="text-red-400/90 font-semibold flex items-center gap-0.5">
            <Shield className="w-2.5 h-2.5" /> -{progress.pointsToDemotion} to Lvl {progress.previousLevel}
          </span>
        )}
        <span>{progress.maxElo ? `${progress.maxElo} Elo` : `${progress.minElo}+ Elo`}</span>
      </div>
    </div>
  );
});
LevelProgressBar.displayName = "LevelProgressBar";