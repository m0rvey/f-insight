import React from 'react';
import { Target } from 'lucide-react';
import { AdvancedMatchPrediction } from '../../types/messages';

interface ProbabilityBarProps {
  win1: number;
  win2: number;
  team1Name: string;
  team2Name: string;
  prediction?: AdvancedMatchPrediction;
}

export const ProbabilityBar = React.memo<ProbabilityBarProps>(({
  win1,
  win2,
  team1Name,
  team2Name,
  prediction,
}) => {
  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs font-mono font-bold text-zinc-300 px-1">
        <span className="text-blue-400 font-black flex items-center gap-1 min-w-0">
          <span className="shrink-0">{win1}%</span> <span className="min-w-0 truncate">{team1Name}</span>
        </span>
        {prediction ? (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/90 border border-white/10 text-zinc-200 text-[11px] shadow-sm shrink-0">
            <Target className="w-3.5 h-3.5 text-faceit-orange shrink-0" />
            <span className="whitespace-nowrap">Predicted MR12:</span>
            <span className="text-white font-extrabold font-mono whitespace-nowrap">
              {prediction.predictedScore.f1Score} : {prediction.predictedScore.f2Score}
            </span>
            {prediction.predictedScore.isOvertimeLikely && (
              <span className="text-[10px] text-amber-400 font-sans font-bold whitespace-nowrap">(OT Likely)</span>
            )}
          </div>
        ) : (
          <span className="shrink-0" />
        )}
        <span className="text-orange-400 font-black flex items-center justify-end gap-1 min-w-0">
          <span className="min-w-0 truncate">{team2Name}</span> <span className="shrink-0">{win2}%</span>
        </span>
      </div>

      <div className="w-full bg-zinc-950 rounded-full h-2.5 p-0.5 border border-white/10 flex overflow-hidden shadow-inner">
        <div
          className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-l-full transition-all duration-500 relative group"
          style={{ width: `${Math.max(10, Math.min(90, win1))}%` }}
          title={`${team1Name}: ${win1}% win probability`}
        />
        <div
          className="h-full bg-gradient-to-r from-orange-400 to-faceit-orange rounded-r-full transition-all duration-500 relative group"
          style={{ flex: 1 }}
          title={`${team2Name}: ${win2}% win probability`}
        />
      </div>
    </div>
  );
});
ProbabilityBar.displayName = 'ProbabilityBar';
