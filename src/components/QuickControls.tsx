import React, { useState } from 'react';
import { RefreshCw, Eye, EyeOff, ShieldAlert, ChevronUp, ChevronDown, Zap } from 'lucide-react';

interface QuickControlsProps {
  onRefresh: () => void;
  isLoading: boolean;
  isVisible: boolean;
  onToggleVisibility: () => void;
  highRiskCount: number;
}

export const QuickControls: React.FC<QuickControlsProps> = ({
  onRefresh,
  isLoading,
  isVisible,
  onToggleVisibility,
  highRiskCount,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-[99999] font-sans antialiased text-white flex flex-col items-end selection:bg-faceit-orange selection:text-black">
      {/* Expanded quick action pill */}
      {isExpanded && (
        <div className="mb-2.5 p-2 rounded-2xl glass-panel border border-white/10 shadow-2xl flex items-center gap-2 animate-fade-in bg-gradient-to-b from-[#18181C]/95 to-[#121214]/95">
          {highRiskCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-500/20 text-red-300 text-xs font-bold font-mono border border-red-500/40 animate-pulse">
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              <span>{highRiskCount} Risk</span>
            </div>
          )}

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 border border-white/10 text-xs font-bold text-zinc-200 hover:text-white transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-faceit-orange' : 'text-zinc-400'}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={onToggleVisibility}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 border border-white/10 text-xs font-bold text-zinc-200 hover:text-white transition active:scale-95"
          >
            {isVisible ? <EyeOff className="w-3.5 h-3.5 text-zinc-400" /> : <Eye className="w-3.5 h-3.5 text-faceit-orange" />}
            <span>{isVisible ? 'Hide HUD' : 'Show HUD'}</span>
          </button>
        </div>
      )}

      {/* Main trigger button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#16161A]/95 hover:bg-[#1C1C22] border border-faceit-orange/50 hover:border-faceit-orange text-white shadow-glow-orange transition-all duration-200 group active:scale-95"
        title="f-insight Match HUD Controls"
      >
        <div className="w-2.5 h-2.5 rounded-full bg-faceit-orange animate-pulse shadow-glow-orange" />
        <span className="font-extrabold text-xs tracking-wider flex items-center gap-1">
          <Zap className="w-3 h-3 text-faceit-orange fill-faceit-orange" />
          f-insight
        </span>
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-transform" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-transform" />
        )}
      </button>
    </div>
  );
};
