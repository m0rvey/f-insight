export interface ExtensionSettings {
  enableRedFlags: boolean;
  enableVetoHelper: boolean;
  enablePremadeDetection: boolean;
  enableFloatingControls: boolean;
  compactMode: boolean;
  theme: 'dark' | 'midnight';
  // Matchmaking Automation Features
  autoReadyUp: boolean;
  autoAcceptParty: boolean;
  autoCopyConnectIp: boolean;
  autoDismissAfk: boolean;
  autoContinueQueue: boolean;
  autoDismissCaptain: boolean;
  autoHideClientBanner: boolean;
  autoVetoMaps: boolean;
  // Tactical Performance Analytics
  showFcrRating: boolean;
  showFormIndicators: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enableRedFlags: true,
  enableVetoHelper: true,
  enablePremadeDetection: true,
  enableFloatingControls: true,
  compactMode: false,
  theme: 'dark',
  // Automation defaults
  autoReadyUp: true,
  autoAcceptParty: true,
  autoCopyConnectIp: true,
  autoDismissAfk: true,
  autoContinueQueue: true,
  autoDismissCaptain: true,
  autoHideClientBanner: true,
  autoVetoMaps: false,
  // Tactical Analytics defaults
  showFcrRating: true,
  showFormIndicators: true,
};

export interface PremadeGroup {
  id: string;
  tag: string; // e.g. 'Party A', 'Party B'
  color: string; // Hex color for the tag
  playerIds: string[];
}
