import React, { useState } from 'react';
import { LobbyAnalysisPayload } from '../types/messages';
import { LobbySummaryBar } from './LobbySummaryBar';
import { VetoMatrix } from './VetoMatrix';

interface LobbyWidgetProps {
  payload: LobbyAnalysisPayload;
  isLoading: boolean;
  onRefresh: () => void;
  showVetoMatrix?: boolean;
  onToggleVetoMatrix?: () => void;
}

export const LobbyWidget: React.FC<LobbyWidgetProps> = ({
  payload,
  isLoading,
  onRefresh,
  showVetoMatrix: controlledVetoMatrix,
  onToggleVetoMatrix: controlledToggleVeto,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const isVoting = payload.match.status === 'VOTING' || !payload.match.selected_map;
  const [internalShowVetoMatrix, setInternalShowVetoMatrix] = useState(isVoting);

  const showVeto = controlledVetoMatrix !== undefined ? controlledVetoMatrix : internalShowVetoMatrix;
  const toggleVeto = controlledToggleVeto || (() => setInternalShowVetoMatrix((prev) => !prev));

  return (
    <div className="f-insight-scope font-sans antialiased text-white w-full">
      <LobbySummaryBar
        payload={payload}
        onRefresh={onRefresh}
        isLoading={isLoading}
        isVisible={isVisible}
        onToggleVisibility={() => setIsVisible((prev) => !prev)}
        showVetoMatrix={showVeto}
        onToggleVetoMatrix={toggleVeto}
      />

      {isVisible && showVeto && (
        <VetoMatrix
          match={payload.match}
          playersStats={payload.playersStats}
        />
      )}
    </div>
  );
};
