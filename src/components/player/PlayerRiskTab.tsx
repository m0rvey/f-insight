import React from 'react';
import { RiskAnalysisResult } from '../../types/risk';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

interface PlayerRiskTabProps {
  risk?: RiskAnalysisResult;
}

export const PlayerRiskTab = React.memo<PlayerRiskTabProps>(({ risk }) => {
  if (!risk) {
    return (
      <div className="p-4 rounded-xl border border-faceit-border/80 bg-faceit-card flex items-center gap-3">
        <ShieldAlert className="w-5 h-5 text-zinc-500 flex-shrink-0" />
        <p className="text-xs text-zinc-400">
          Red flag analysis is disabled or no data is available for this player.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="p-4 rounded-xl border flex items-center justify-between"
        style={{
          backgroundColor: `${risk.color}15`,
          borderColor: `${risk.color}40`,
        }}
      >
        <div className="flex items-center gap-3">
          <ShieldAlert
            className="w-6 h-6"
            style={{ color: risk.color }}
          />
          <div>
            <div className="font-bold text-sm text-white">
              Risk Level: {risk.level} ({risk.score}% Risk Score)
            </div>
            <div className="text-xs text-zinc-300 mt-0.5">
              {risk.score === 0
                ? 'Account metrics are completely consistent with normal play.'
                : 'Algorithmic analysis of FACEIT & Steam historical metrics.'}
            </div>
          </div>
        </div>
      </div>

      {risk.flags.length > 0 && (
        <div className="space-y-2 mt-3">
          <h4 className="text-xs font-bold text-faceit-muted uppercase tracking-wider">
            Triggered Indicators ({risk.flags.length})
          </h4>

          {risk.flags.map((flag) => (
            <div
              key={flag.id}
              className="p-3 rounded-lg bg-faceit-card border border-faceit-border flex items-start gap-3"
            >
              <AlertTriangle
                className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  flag.severity === 'danger'
                    ? 'text-red-400'
                    : flag.severity === 'warning'
                    ? 'text-amber-400'
                    : 'text-blue-400'
                }`}
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-zinc-200">{flag.title}</span>
                  {flag.weight > 0 && (
                    <span className="text-[10px] font-mono font-bold text-red-400">
                      +{flag.weight} Risk
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">{flag.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
PlayerRiskTab.displayName = "PlayerRiskTab";