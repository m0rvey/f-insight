import React from 'react';
import { LobbyAnalysisPayload } from '../types/messages';
import { ExtensionSettings } from '../types/settings';
import { LobbySummaryBar } from './LobbySummaryBar';
import { VetoMatrix } from './VetoMatrix';
import { MapVetoRankItem } from '../services/forecastEngine';

import { DetectedCurrentUser } from '../services/currentUserDetector';

interface LobbyWidgetProps {
  payload: LobbyAnalysisPayload;
  isLoading: boolean;
  onRefresh: () => void;
  isVisible: boolean;
  onToggleVisibility: () => void;
  showVetoMatrix: boolean;
  onToggleVetoMatrix: () => void;
  currentUser?: DetectedCurrentUser;
  settings?: ExtensionSettings;
  rankedMaps?: MapVetoRankItem[];
}

export const LobbyWidget: React.FC<LobbyWidgetProps> = ({
  payload,
  isLoading,
  onRefresh,
  isVisible,
  onToggleVisibility,
  showVetoMatrix,
  onToggleVetoMatrix,
  currentUser,
  settings,
  rankedMaps,
}) => {
  const vetoEnabled = settings?.enableVetoHelper !== false;

  return (
    <div className="f-insight-scope font-sans antialiased text-white w-full">
      <LobbySummaryBar
        payload={payload}
        onRefresh={onRefresh}
        isLoading={isLoading}
        isVisible={isVisible}
        onToggleVisibility={onToggleVisibility}
        showVetoMatrix={showVetoMatrix && vetoEnabled}
        onToggleVetoMatrix={onToggleVetoMatrix}
        currentUser={currentUser}
        settings={settings}
        rankedMaps={rankedMaps}
      />

      {isVisible && showVetoMatrix && vetoEnabled && (
        <VetoMatrix
          match={payload.match}
          playersStats={payload.playersStats || {}}
          currentUser={currentUser}
          rankedMaps={rankedMaps}
        />
      )}
    </div>
  );
};
