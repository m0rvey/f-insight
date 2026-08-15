import React from 'react';
import { FaceitPlayerFullStats } from '../../types/faceit';

interface PlayerRadarChartProps {
  stats: FaceitPlayerFullStats;
}

export const PlayerRadarChart = React.memo<PlayerRadarChartProps>(({ stats }) => {
  const kd30 = stats.last30Kd ?? stats.overallKd;
  const adr30 = stats.last30Adr ?? stats.overallAdr ?? 75;
  // Normalize each metric to a 0 - 100 scale for clean pentagon geometry
  const kdNorm = Math.min(100, Math.max(5, ((kd30 - 0.6) / 1.0) * 100));
  const adrNorm = Math.min(100, Math.max(5, ((adr30 - 50) / 60) * 100));
  const hsNorm = Math.min(100, Math.max(5, ((stats.overallHsPercent - 20) / 50) * 100));
  const wrNorm = Math.min(100, Math.max(5, ((stats.overallWinRate - 35) / 40) * 100));
  
  const fcrVal = stats.fcrContributionPercent ?? 20;
  const formBonus = stats.formStatus === 'HOT' ? 15 : stats.formStatus === 'COLD' ? -15 : 0;
  const impactNorm = Math.min(100, Math.max(5, ((fcrVal - 10) / 20) * 100 + formBonus));

  const axes = [
    { label: 'Winrate', value: `${Math.round(stats.overallWinRate)}%`, raw: wrNorm, sub: 'WIN' },
    { label: 'K/D', value: kd30.toFixed(2), raw: kdNorm, sub: 'K/D' },
    { label: 'HS%', value: `${Math.round(stats.overallHsPercent)}%`, raw: hsNorm, sub: 'HS%' },
    { label: 'ADR', value: Math.round(adr30).toString(), raw: adrNorm, sub: 'ADR' },
    { label: 'Kills', value: `${fcrVal}%`, raw: impactNorm, sub: 'FCR' },
  ];

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState(240);

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize(Math.max(180, Math.min(240, el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const center = size / 2;
  const maxRadius = (size / 240) * 75;

  // Compute pentagon coordinates for background rings and data points
  const getCoordinates = (radius: number, index: number) => {
    const angle = (Math.PI * 2 * index) / 5 - Math.PI / 2;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    return { x, y };
  };

  const rings = [0.25, 0.5, 0.75, 1.0];

  const polygonPoints = axes
    .map((axis, i) => {
      const r = (axis.raw / 100) * maxRadius;
      const { x, y } = getCoordinates(r, i);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="p-3.5 rounded-xl bg-faceit-card border border-faceit-border/80 flex flex-col items-center justify-center font-sans relative overflow-hidden">
      <div className="w-full flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold text-zinc-200 uppercase tracking-wider">
          Player Skill Matrix
        </span>
        <span className="text-[10px] font-mono text-faceit-orange font-semibold">
          Pentagon Radar
        </span>
      </div>

      <div ref={containerRef} className="relative w-full max-w-[240px] aspect-square flex items-center justify-center">
        <svg width={size} height={size} className="overflow-visible">
          {/* Background Grid Rings */}
          {rings.map((ring, idx) => {
            const points = [0, 1, 2, 3, 4]
              .map((i) => {
                const { x, y } = getCoordinates(maxRadius * ring, i);
                return `${x},${y}`;
              })
              .join(' ');
            return (
              <polygon
                key={idx}
                points={points}
                fill={idx === rings.length - 1 ? '#00000030' : 'none'}
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="1"
              />
            );
          })}

          {/* Radial Spokes */}
          {[0, 1, 2, 3, 4].map((i) => {
            const { x, y } = getCoordinates(maxRadius, i);
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
            );
          })}

          {/* Data Polygon */}
          <polygon
            points={polygonPoints}
            fill="rgba(255, 85, 0, 0.25)"
            stroke="#FF5500"
            strokeWidth="2"
            strokeLinejoin="round"
            className="transition-all duration-300 drop-shadow-[0_0_8px_rgba(255,85,0,0.4)]"
          />

          {/* Vertex Dots */}
          {axes.map((axis, i) => {
            const r = (axis.raw / 100) * maxRadius;
            const { x, y } = getCoordinates(r, i);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="3.5"
                fill="#FF5500"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            );
          })}
        </svg>

        {/* Outer Axis Labels */}
        {axes.map((axis, i) => {
          const { x, y } = getCoordinates(maxRadius + 14, i);
          return (
            <div
              key={i}
              className="absolute text-center transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: `${x}px`, top: `${y}px` }}
            >
              <div className="text-[9px] font-extrabold uppercase text-zinc-300 tracking-tight leading-none">
                {axis.label}
              </div>
              <div className="text-[10px] font-black font-mono text-faceit-orange leading-none mt-0.5">
                {axis.value}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
PlayerRadarChart.displayName = "PlayerRadarChart";