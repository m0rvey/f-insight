import React from 'react';

interface TeamCardProps {
  factionId: 1 | 2;
  teamName: string;
  winChance: number;
  projectedWin: number;
  projectedLoss: number;
  avgElo: number;
  avgKd: number;
  avgAdr: number;
  avgHsPercent: number;
  topMap: { name: string; wr: number } | null;
  isUserTeam?: boolean;
}

export const TeamCard = React.memo<TeamCardProps>(({
  factionId,
  teamName,
  winChance,
  projectedWin,
  projectedLoss,
  avgElo,
  avgKd,
  avgAdr,
  avgHsPercent,
  topMap,
  isUserTeam,
}) => {
  const isF1 = factionId === 1;

  return (
    <div className={`md:col-span-5 bg-faceit-card/90 hover:bg-faceit-card-hover/95 rounded-xl p-4 border transition-all duration-200 shadow-sm ${
      isUserTeam
        ? 'border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.12)] bg-cyan-950/10'
        : isF1
        ? 'border-white/10 hover:border-blue-500/40'
        : 'border-white/10 hover:border-faceit-orange/40'
    }`}>
      {isF1 ? (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-3.5 h-3.5 rounded-full bg-blue-500 ring-2 ring-blue-500/30" />
            <span className="font-extrabold text-sm text-zinc-100 min-w-0 flex-1 truncate">{teamName}</span>
            {isUserTeam && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 font-black">
                YOU
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-mono font-extrabold">
              +{projectedWin} / -{projectedLoss} ELO
            </span>
            <span className="text-xs font-black text-blue-400 font-mono">
              {winChance}% Win
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-orange-400 font-mono">
              {winChance}% Win
            </span>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300 font-mono font-extrabold">
              +{projectedWin} / -{projectedLoss} ELO
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="font-extrabold text-sm text-zinc-100 min-w-0 flex-1 truncate">{teamName}</span>
            {isUserTeam && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 font-black">
                YOU
              </span>
            )}
            <div className="w-3.5 h-3.5 rounded-full bg-faceit-orange ring-2 ring-faceit-orange/30" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-5 gap-2 text-center font-mono">
        <div className="stat-cell p-2">
          <div className="text-[9px] text-zinc-400 uppercase font-sans font-bold">Avg Elo</div>
          <div className="text-sm font-bold text-zinc-100 mt-0.5">{avgElo}</div>
        </div>
        <div className="stat-cell p-2">
          <div className="text-[9px] text-zinc-400 uppercase font-sans font-bold">Avg K/D</div>
          <div className="text-sm font-bold text-zinc-100 mt-0.5">{avgKd}</div>
        </div>
        <div className="stat-cell p-2">
          <div className="text-[9px] text-zinc-400 uppercase font-sans font-bold">Avg ADR</div>
          <div className="text-sm font-bold text-zinc-100 mt-0.5">{avgAdr}</div>
        </div>
        <div className="stat-cell p-2">
          <div className="text-[9px] text-zinc-400 uppercase font-sans font-bold">Avg HS%</div>
          <div className="text-sm font-bold text-zinc-100 mt-0.5">{avgHsPercent}%</div>
        </div>
        <div className="stat-cell p-2">
          <div className="text-[9px] text-zinc-400 uppercase font-sans font-bold">Top Map</div>
          <div className={`text-sm font-bold mt-0.5 capitalize truncate ${isF1 ? 'text-blue-400' : 'text-orange-400'}`}>
            {topMap ? topMap.name : '—'}
          </div>
        </div>
      </div>
    </div>
  );
});
TeamCard.displayName = "TeamCard";