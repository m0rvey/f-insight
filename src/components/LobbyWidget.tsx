import React, { useState } from 'react';
import { LobbyAnalysisPayload } from '../types/messages';
import { LobbySummaryBar } from './LobbySummaryBar';
import { VetoMatrix } from './VetoMatrix';

interface LobbyWidgetProps {
  payload: LobbyAnalysisPayload;
  isLoading: boolean;
  onRefresh: () => void;
}

export const LobbyWidget: React.FC<LobbyWidgetProps> = ({
  payload,
  isLoading,
  onRefresh,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const isVoting = payload.match.status === 'VOTING' || !payload.match.selected_map;
  const [showVetoMatrix, setShowVetoMatrix] = useState(isVoting);

  return (
    <div className="f-insight-scope font-sans antialiased text-white w-full">
      <LobbySummaryBar
        payload={payload}
        onRefresh={onRefresh}
        isLoading={isLoading}
        isVisible={isVisible}
        onToggleVisibility={() => setIsVisible((prev) => !prev)}
        showVetoMatrix={showVetoMatrix}
        onToggleVetoMatrix={() => setShowVetoMatrix((prev) => !prev)}
      />

      {isVisible && showVetoMatrix && (
        <VetoMatrix
          match={payload.match}
          playersStats={payload.playersStats}
        />
      )}
    </div>
  );
};
